import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "../scripts/catalog-validator.mjs";

async function readFixture(relativePath) {
  const fixtureUrl = new URL(`fixtures/${relativePath}`, import.meta.url);
  return JSON.parse(await readFile(fileURLToPath(fixtureUrl), "utf8"));
}

test("accepts a known valid catalog with required and optional recipe lines", async () => {
  const catalog = await readFixture("valid/minimal-catalog.json");

  assert.deepEqual(validateCatalog(catalog), []);
});

test("reports all known errors from a deliberately invalid catalog", async () => {
  const catalog = await readFixture("invalid/broken-catalog.json");

  assert.deepEqual(validateCatalog(catalog), [
    "$.ingredients[1].id: duplicate ingredient id 'ingredient:fixture-spirit' (first used at $.ingredients[0].id)",
    "$.ingredients[1].name: duplicate normalized ingredient name 'fixture spirit' (first used at $.ingredients[0].name)",
    '$.ingredients[1].category: unsupported value "pantry"',
    "$.cocktails[0].id: expected 'cocktail:broken-drink' to match the stable slug",
    "$.cocktails[0].styles[1]: duplicate style 'sour'",
    '$.cocktails[0].styles[2]: unsupported value "unknown-style"',
    "$.cocktails[0].recipes[0].id: expected 'recipe:broken-drink:default' for the version 1 default recipe",
    "$.cocktails[0].recipes[0].ingredients[0].position: expected 1 to match array display order",
    "$.cocktails[0].recipes[0].ingredients[0].measurements.us.quantity: may be null only for a qualitative unit",
    "$.cocktails[0].recipes[0].ingredients[0].measurements.us.maximumQuantity: requires a numeric quantity",
    "$.cocktails[0].recipes[0].ingredients[0].measurements.metric.maximumQuantity: must be greater than or equal to quantity",
    "$.cocktails[0].recipes[0].ingredients[0].measurements.metric.modifier: is supported only for US ounce measurements",
    "$.cocktails[0].recipes[0].ingredients[0].measurements: incompatible US/metric unit pair 'ounce' and 'teaspoon'",
    '$.cocktails[0].recipes[0].ingredients[0].requirement: unsupported value "sometimes"',
    "$.cocktails[0].primarySpiritId: unknown ingredient 'ingredient:missing-spirit'",
    "$.cocktails[0].recipes[0].ingredients[0].ingredientId: unknown ingredient 'ingredient:missing-ingredient'",
  ]);
});

test("allows repeated ingredient references while requiring consecutive display positions", async () => {
  const catalog = await readFixture("valid/minimal-catalog.json");
  const repeatedLine = structuredClone(
    catalog.cocktails[0].recipes[0].ingredients[0],
  );
  repeatedLine.position = 3;
  catalog.cocktails[0].recipes[0].ingredients.push(repeatedLine);

  assert.deepEqual(validateCatalog(catalog), []);
});

test("rejects missing required and unexpected fields", async () => {
  const catalog = await readFixture("valid/minimal-catalog.json");
  delete catalog.cocktails[0].recipes[0].glassware;
  catalog.unexpected = true;

  const errors = validateCatalog(catalog);
  assert.ok(errors.includes("$.unexpected: unexpected field"));
  assert.ok(
    errors.includes(
      "$.cocktails[0].recipes[0]: missing required field 'glassware'",
    ),
  );
});
