#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateCatalog, summarizeCatalog } from "./catalog-validator.mjs";

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error(
    "Usage: node scripts/validate-catalog.mjs <catalog.json> [...]",
  );
  process.exitCode = 2;
} else {
  for (const inputPath of paths) {
    const resolvedPath = resolve(inputPath);
    let catalog;
    try {
      catalog = JSON.parse(await readFile(resolvedPath, "utf8"));
    } catch (error) {
      console.error(
        `${inputPath}: could not read valid JSON: ${error.message}`,
      );
      process.exitCode = 1;
      continue;
    }

    const errors = validateCatalog(catalog);
    if (errors.length > 0) {
      console.error(
        `${inputPath}: catalog validation failed with ${errors.length} error(s):`,
      );
      for (const error of errors) {
        console.error(`- ${error}`);
      }
      process.exitCode = 1;
      continue;
    }

    const summary = summarizeCatalog(catalog);
    console.log(
      `${inputPath}: valid catalog (${summary.ingredients} ingredients, ${summary.cocktails} cocktails, ${summary.recipes} recipes, ${summary.recipeLines} recipe lines)`,
    );
  }
}
