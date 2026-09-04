const ROOT_KEYS = ["schemaVersion", "catalog", "ingredients", "cocktails"];
const CATALOG_KEYS = ["id", "name", "defaultMeasurementSystem"];
const INGREDIENT_KEYS = ["id", "name", "category"];
const COCKTAIL_KEYS = [
  "id",
  "slug",
  "name",
  "primarySpiritId",
  "styles",
  "recipes",
];
const RECIPE_KEYS = [
  "id",
  "name",
  "ingredients",
  "instructions",
  "glassware",
  "garnish",
];
const RECIPE_INGREDIENT_KEYS = [
  "position",
  "ingredientId",
  "recipeDisplayName",
  "measurements",
  "requirement",
  "preparation",
];
const MEASUREMENT_SYSTEM_KEYS = ["us", "metric"];
const MEASUREMENT_KEYS = ["quantity", "maximumQuantity", "unit", "modifier"];

const INGREDIENT_CATEGORIES = new Set([
  "spirit",
  "liqueur",
  "fortified_wine",
  "bitters",
  "syrup",
  "juice",
  "mixer",
  "fruit",
  "herb",
  "garnish",
  "other",
]);
const COCKTAIL_STYLES = new Set([
  "old-fashioned",
  "martini",
  "manhattan",
  "negroni",
  "sour",
  "daisy",
  "collins",
  "fizz",
  "highball",
  "spritz",
  "julep",
  "smash",
  "swizzle",
  "cobbler",
  "flip",
  "punch",
  "duo-and-trio",
  "tiki",
]);
const MEASUREMENT_UNITS = new Set([
  "barspoon",
  "cube",
  "dash",
  "drop",
  "leaf",
  "milliliter",
  "ounce",
  "piece",
  "pinch",
  "shot",
  "slice",
  "splash",
  "sprig",
  "tablespoon",
  "teaspoon",
  "to-taste",
  "top-up",
  "wheel",
]);
const QUANTITY_OPTIONAL_UNITS = new Set([
  "dash",
  "drop",
  "splash",
  "to-taste",
  "top-up",
]);
const REQUIREMENTS = new Set(["required", "optional"]);
const MODIFIERS = new Set(["scant", "heavy"]);
const INGREDIENT_ID_PATTERN = /^ingredient:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COCKTAIL_ID_PATTERN = /^cocktail:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RECIPE_ID_PATTERN =
  /^recipe:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizedName(value) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function validateExactKeys(value, path, expectedKeys, errors) {
  const actualKeys = Object.keys(value);
  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      errors.push(`${path}: missing required field '${key}'`);
    }
  }
  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) {
      errors.push(`${path}.${key}: unexpected field`);
    }
  }
}

function validateObject(value, path, expectedKeys, errors) {
  if (!isObject(value)) {
    errors.push(`${path}: must be an object`);
    return false;
  }
  validateExactKeys(value, path, expectedKeys, errors);
  return true;
}

function validateArray(value, path, errors, { allowEmpty = false } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: must be an array`);
    return false;
  }
  if (!allowEmpty && value.length === 0) {
    errors.push(`${path}: must not be empty`);
  }
  return true;
}

function validateString(value, path, errors, { nullable = false } = {}) {
  if (nullable && value === null) {
    return true;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(
      `${path}: must be a non-empty string${nullable ? " or null" : ""}`,
    );
    return false;
  }
  if (value !== value.trim()) {
    errors.push(`${path}: must not have leading or trailing whitespace`);
    return false;
  }
  return true;
}

function validateEnum(value, path, allowed, errors) {
  if (!allowed.has(value)) {
    errors.push(`${path}: unsupported value ${JSON.stringify(value)}`);
    return false;
  }
  return true;
}

function validateId(value, path, pattern, errors) {
  if (!validateString(value, path, errors)) {
    return false;
  }
  if (!pattern.test(value)) {
    errors.push(`${path}: must be a lowercase namespaced identifier`);
    return false;
  }
  return true;
}

function recordUnique(seen, value, path, label, errors) {
  if (typeof value !== "string") {
    return;
  }
  const previousPath = seen.get(value);
  if (previousPath) {
    errors.push(
      `${path}: duplicate ${label} '${value}' (first used at ${previousPath})`,
    );
  } else {
    seen.set(value, path);
  }
}

function validateMeasurement(value, path, system, errors) {
  if (!validateObject(value, path, MEASUREMENT_KEYS, errors)) {
    return;
  }

  const unitValid = validateEnum(
    value.unit,
    `${path}.unit`,
    MEASUREMENT_UNITS,
    errors,
  );
  const quantity = value.quantity;
  const quantityValid =
    quantity === null ||
    (typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0);
  if (!quantityValid) {
    errors.push(`${path}.quantity: must be a positive finite number or null`);
  } else if (
    quantity === null &&
    unitValid &&
    !QUANTITY_OPTIONAL_UNITS.has(value.unit)
  ) {
    errors.push(`${path}.quantity: may be null only for a qualitative unit`);
  }

  const maximum = value.maximumQuantity;
  const maximumValid =
    maximum === null ||
    (typeof maximum === "number" && Number.isFinite(maximum) && maximum > 0);
  if (!maximumValid) {
    errors.push(
      `${path}.maximumQuantity: must be a positive finite number or null`,
    );
  } else if (maximum !== null && quantity === null) {
    errors.push(`${path}.maximumQuantity: requires a numeric quantity`);
  } else if (maximum !== null && quantityValid && maximum < quantity) {
    errors.push(
      `${path}.maximumQuantity: must be greater than or equal to quantity`,
    );
  }

  if (value.modifier !== null) {
    if (validateEnum(value.modifier, `${path}.modifier`, MODIFIERS, errors)) {
      if (system !== "us" || value.unit !== "ounce") {
        errors.push(
          `${path}.modifier: is supported only for US ounce measurements`,
        );
      }
    }
  }
}

function validateMeasurements(value, path, errors) {
  if (!validateObject(value, path, MEASUREMENT_SYSTEM_KEYS, errors)) {
    return;
  }
  validateMeasurement(value.us, `${path}.us`, "us", errors);
  validateMeasurement(value.metric, `${path}.metric`, "metric", errors);

  if (!isObject(value.us) || !isObject(value.metric)) {
    return;
  }
  const usUnit = value.us.unit;
  const metricUnit = value.metric.unit;
  const compatibleUnits =
    usUnit === metricUnit ||
    (usUnit === "ounce" && metricUnit === "milliliter") ||
    (usUnit === "barspoon" && metricUnit === "milliliter");
  if (
    MEASUREMENT_UNITS.has(usUnit) &&
    MEASUREMENT_UNITS.has(metricUnit) &&
    !compatibleUnits
  ) {
    errors.push(
      `${path}: incompatible US/metric unit pair '${usUnit}' and '${metricUnit}'`,
    );
  }
  if (
    usUnit === metricUnit &&
    (value.us.quantity !== value.metric.quantity ||
      value.us.maximumQuantity !== value.metric.maximumQuantity)
  ) {
    errors.push(
      `${path}: matching units must repeat the same quantity and range`,
    );
  }
}

function validateRecipeIngredient(value, path, expectedPosition, errors) {
  if (!validateObject(value, path, RECIPE_INGREDIENT_KEYS, errors)) {
    return;
  }
  if (!Number.isInteger(value.position) || value.position < 1) {
    errors.push(`${path}.position: must be a positive integer`);
  } else if (value.position !== expectedPosition) {
    errors.push(
      `${path}.position: expected ${expectedPosition} to match array display order`,
    );
  }
  validateId(
    value.ingredientId,
    `${path}.ingredientId`,
    INGREDIENT_ID_PATTERN,
    errors,
  );
  validateString(value.recipeDisplayName, `${path}.recipeDisplayName`, errors);
  validateMeasurements(value.measurements, `${path}.measurements`, errors);
  validateEnum(value.requirement, `${path}.requirement`, REQUIREMENTS, errors);
  validateString(value.preparation, `${path}.preparation`, errors, {
    nullable: true,
  });
}

function validateRecipe(value, path, cocktailSlug, context, errors) {
  if (!validateObject(value, path, RECIPE_KEYS, errors)) {
    return;
  }
  if (validateId(value.id, `${path}.id`, RECIPE_ID_PATTERN, errors)) {
    recordUnique(
      context.recipeIds,
      value.id,
      `${path}.id`,
      "recipe id",
      errors,
    );
    const expectedId = `recipe:${cocktailSlug}:default`;
    if (value.id !== expectedId) {
      errors.push(
        `${path}.id: expected '${expectedId}' for the version 1 default recipe`,
      );
    }
  }
  validateString(value.name, `${path}.name`, errors);
  if (validateArray(value.ingredients, `${path}.ingredients`, errors)) {
    value.ingredients.forEach((ingredient, index) =>
      validateRecipeIngredient(
        ingredient,
        `${path}.ingredients[${index}]`,
        index + 1,
        errors,
      ),
    );
  }
  validateString(value.instructions, `${path}.instructions`, errors);
  validateString(value.glassware, `${path}.glassware`, errors);
  validateString(value.garnish, `${path}.garnish`, errors, { nullable: true });
}

function validateIngredient(value, path, context, errors) {
  if (!validateObject(value, path, INGREDIENT_KEYS, errors)) {
    return;
  }
  if (validateId(value.id, `${path}.id`, INGREDIENT_ID_PATTERN, errors)) {
    recordUnique(
      context.ingredientIds,
      value.id,
      `${path}.id`,
      "ingredient id",
      errors,
    );
  }
  if (validateString(value.name, `${path}.name`, errors)) {
    recordUnique(
      context.ingredientNames,
      normalizedName(value.name),
      `${path}.name`,
      "normalized ingredient name",
      errors,
    );
  }
  validateEnum(
    value.category,
    `${path}.category`,
    INGREDIENT_CATEGORIES,
    errors,
  );
}

function validateCocktail(value, path, context, errors) {
  if (!validateObject(value, path, COCKTAIL_KEYS, errors)) {
    return;
  }
  if (validateId(value.id, `${path}.id`, COCKTAIL_ID_PATTERN, errors)) {
    recordUnique(
      context.cocktailIds,
      value.id,
      `${path}.id`,
      "cocktail id",
      errors,
    );
  }
  if (validateString(value.slug, `${path}.slug`, errors)) {
    if (!SLUG_PATTERN.test(value.slug)) {
      errors.push(`${path}.slug: must be a lowercase kebab-case slug`);
    } else {
      recordUnique(
        context.cocktailSlugs,
        value.slug,
        `${path}.slug`,
        "cocktail slug",
        errors,
      );
      const expectedId = `cocktail:${value.slug}`;
      if (typeof value.id === "string" && value.id !== expectedId) {
        errors.push(
          `${path}.id: expected '${expectedId}' to match the stable slug`,
        );
      }
    }
  }
  if (validateString(value.name, `${path}.name`, errors)) {
    recordUnique(
      context.cocktailNames,
      normalizedName(value.name),
      `${path}.name`,
      "normalized cocktail name",
      errors,
    );
  }
  if (value.primarySpiritId !== null) {
    validateId(
      value.primarySpiritId,
      `${path}.primarySpiritId`,
      INGREDIENT_ID_PATTERN,
      errors,
    );
  }
  if (
    validateArray(value.styles, `${path}.styles`, errors, { allowEmpty: true })
  ) {
    const styles = new Set();
    value.styles.forEach((style, index) => {
      validateEnum(style, `${path}.styles[${index}]`, COCKTAIL_STYLES, errors);
      if (styles.has(style)) {
        errors.push(`${path}.styles[${index}]: duplicate style '${style}'`);
      }
      styles.add(style);
    });
  }
  if (validateArray(value.recipes, `${path}.recipes`, errors)) {
    if (value.recipes.length !== 1) {
      errors.push(
        `${path}.recipes: version 1 requires exactly one default recipe`,
      );
    }
    value.recipes.forEach((recipe, index) =>
      validateRecipe(
        recipe,
        `${path}.recipes[${index}]`,
        value.slug,
        context,
        errors,
      ),
    );
  }
}

function validateReferences(catalog, context, errors) {
  if (!Array.isArray(catalog.cocktails)) {
    return;
  }
  for (const [cocktailIndex, cocktail] of catalog.cocktails.entries()) {
    if (!isObject(cocktail)) {
      continue;
    }
    const cocktailPath = `$.cocktails[${cocktailIndex}]`;
    if (
      typeof cocktail.primarySpiritId === "string" &&
      !context.ingredientIds.has(cocktail.primarySpiritId)
    ) {
      errors.push(
        `${cocktailPath}.primarySpiritId: unknown ingredient '${cocktail.primarySpiritId}'`,
      );
    } else if (
      typeof cocktail.primarySpiritId === "string" &&
      context.ingredientCategories.get(cocktail.primarySpiritId) !== "spirit"
    ) {
      errors.push(
        `${cocktailPath}.primarySpiritId: referenced ingredient must be a spirit`,
      );
    }
    if (!Array.isArray(cocktail.recipes)) {
      continue;
    }
    for (const [recipeIndex, recipe] of cocktail.recipes.entries()) {
      if (!isObject(recipe) || !Array.isArray(recipe.ingredients)) {
        continue;
      }
      for (const [lineIndex, ingredient] of recipe.ingredients.entries()) {
        if (
          isObject(ingredient) &&
          typeof ingredient.ingredientId === "string" &&
          !context.ingredientIds.has(ingredient.ingredientId)
        ) {
          errors.push(
            `${cocktailPath}.recipes[${recipeIndex}].ingredients[${lineIndex}].ingredientId: unknown ingredient '${ingredient.ingredientId}'`,
          );
        }
      }
    }
  }
}

export function validateCatalog(catalog) {
  const errors = [];
  if (!validateObject(catalog, "$", ROOT_KEYS, errors)) {
    return errors;
  }
  if (catalog.schemaVersion !== 1) {
    errors.push("$.schemaVersion: must equal 1");
  }
  if (validateObject(catalog.catalog, "$.catalog", CATALOG_KEYS, errors)) {
    if (catalog.catalog.id !== "catalog:bar-buddy") {
      errors.push("$.catalog.id: must equal 'catalog:bar-buddy'");
    }
    validateString(catalog.catalog.name, "$.catalog.name", errors);
    if (catalog.catalog.defaultMeasurementSystem !== "us") {
      errors.push("$.catalog.defaultMeasurementSystem: must equal 'us'");
    }
  }

  const context = {
    ingredientIds: new Map(),
    ingredientNames: new Map(),
    ingredientCategories: new Map(),
    cocktailIds: new Map(),
    cocktailSlugs: new Map(),
    cocktailNames: new Map(),
    recipeIds: new Map(),
  };
  if (validateArray(catalog.ingredients, "$.ingredients", errors)) {
    catalog.ingredients.forEach((ingredient, index) => {
      validateIngredient(
        ingredient,
        `$.ingredients[${index}]`,
        context,
        errors,
      );
      if (
        isObject(ingredient) &&
        typeof ingredient.id === "string" &&
        !context.ingredientCategories.has(ingredient.id)
      ) {
        context.ingredientCategories.set(ingredient.id, ingredient.category);
      }
    });
  }
  if (validateArray(catalog.cocktails, "$.cocktails", errors)) {
    catalog.cocktails.forEach((cocktail, index) =>
      validateCocktail(cocktail, `$.cocktails[${index}]`, context, errors),
    );
  }
  validateReferences(catalog, context, errors);
  return errors;
}

export function summarizeCatalog(catalog) {
  const cocktails = Array.isArray(catalog.cocktails) ? catalog.cocktails : [];
  return {
    ingredients: Array.isArray(catalog.ingredients)
      ? catalog.ingredients.length
      : 0,
    cocktails: cocktails.length,
    recipes: cocktails.reduce(
      (total, cocktail) =>
        total + (Array.isArray(cocktail.recipes) ? cocktail.recipes.length : 0),
      0,
    ),
    recipeLines: cocktails.reduce(
      (total, cocktail) =>
        total +
        (Array.isArray(cocktail.recipes)
          ? cocktail.recipes.reduce(
              (recipeTotal, recipe) =>
                recipeTotal +
                (Array.isArray(recipe.ingredients)
                  ? recipe.ingredients.length
                  : 0),
              0,
            )
          : 0),
      0,
    ),
  };
}
