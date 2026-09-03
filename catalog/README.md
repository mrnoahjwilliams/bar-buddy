# Bar Buddy cocktail catalog

[`cocktails.json`](cocktails.json) is the proposed permanent Bar Buddy dataset. It
contains 102 cocktails, one default recipe for each cocktail, and 113 canonical
ingredients. The application will import this file only after product-owner review
and the later validation/import work; it is not a database seed yet.

## Dataset shape

The root contains a schema version, minimal catalog identity, canonical ingredients,
and cocktails. The catalog declares `us` as its default measurement system.

Identifiers are lowercase namespaced strings:

- cocktails: `cocktail:<slug>`
- recipes: `recipe:<cocktail-slug>:default`
- ingredients: `ingredient:<canonical-slug>`

Each recipe ingredient contains its position, canonical ingredient reference,
recipe-specific display name, US and metric measurements, requirement type, and any
ingredient preparation. A measurement contains `quantity`, `maximumQuantity`,
`unit`, and `modifier`. The US measurement appears first and may use `scant` or
`heavy`; the metric measurement retains the reviewed milliliter amount. Practical
units such as dashes, pieces, barspoons, and top-ups are repeated for both systems so
the eventual display choice has one consistent shape.

`recipeDisplayName` preserves useful specificity without making the inventory match
too narrow. For example, a recipe may show Lagavulin 16y while referencing the
canonical Scotch whisky ingredient.

Ingredient categories are `spirit`, `liqueur`, `fortified_wine`, `bitters`, `syrup`,
`juice`, `mixer`, `fruit`, `herb`, `garnish`, and `other`.

## Optional cocktail styles

`styles` is a reviewed, non-exclusive list. A cocktail may have no style when a
recognized structure would be a forced fit, and the catalog has no `other` style.
Names and glassware alone do not determine style.

The controlled vocabulary is:

- `old-fashioned`
- `martini`
- `manhattan`
- `negroni`
- `sour`
- `daisy`
- `collins`
- `fizz`
- `highball`
- `spritz`
- `julep`
- `smash`
- `swizzle`
- `cobbler`
- `flip`
- `punch`
- `duo-and-trio`
- `tiki`

Styles are catalog metadata for later discovery. They do not affect ingredient
availability, recipe selection, or the primary-spirit classification.

## Curation decisions

Canonical ingredients represent practical inventory matches. Recipe-specific wording
retains country, style, blend, color, or named-product guidance where useful. The main
groups include:

- Orange liqueur for Cointreau, Triple Sec, Grand Marnier, and Curaçao.
- Sparkling wine for Champagne and Prosecco; Sherry for Amontillado and Palo Cortado;
  Aromatic bitters for Angostura and generic aromatic bitters.
- Rum, White rum, Aged rum, Dark rum, Overproof white rum, and Rhum agricole. Country,
  blend, and product wording remains visible on the individual recipe.
- Scotch whisky for blended, Islay, and named Islay Scotch. Bourbon, Rye whiskey,
  Irish whiskey, and Scotch whisky remain distinct.
- Agave syrup for agave nectar; Honey syrup for honey mix; Simple syrup for sugar
  syrups; and Sugar for powdered, superfine, white cane, and vanilla sugar.
- One canonical crème de cacao and one crème de menthe regardless of color, plus
  corresponding fruit liqueurs for the recipe's fruit brandies and schnapps.

Milliliters use `1 oz = 29.5735 ml` for the reviewed US presentation. Five milliliters
is one barspoon. Ten milliliters is a heavy quarter ounce, and 20 milliliters is a
scant three-quarter ounce. Fifty milliliters is 2 oz except for Bellini peach purée,
Canchanchara water, and Irish Coffee cream, which use a heavy 1 1/2 oz. Both systems
remain in the dataset so these presentation choices do not replace the metric recipe.

## Provenance archive

The catalog was initially curated from the publicly available
[International Bartenders Association cocktail list](https://iba-world.com/cocktails/all-cocktails/),
retrieved September 3, 2026. The dated snapshot and one-time acquisition/build tools
are retained under [`archive/`](archive/README.md) for provenance. They are not part of
the application, normal catalog maintenance, import, or CI contract. Bar Buddy now
maintains `cocktails.json` as its own fixed catalog; upstream list changes do not
automatically change it.

Review all names, canonical ingredients, optional styles, measurement pairs,
requirements, instructions, glassware, and garnish before approving the file for
validation and import work.
