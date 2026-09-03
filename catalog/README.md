# Curated cocktail catalog

The catalog is an offline, reviewable input to Bar Buddy. The application does not
scrape or depend on the IBA website at runtime. Database persistence and repeatable
import arrive in Plan milestone 0.3 and Release 1 unit 1.2.1; this catalog must be
approved before either is implemented.

## Current files

- `sources/iba-2026-09-03.json` is the dated source snapshot. It retains the IBA
  name, category, ingredient lines, method, garnish, and URL for all 102 cocktails.
- `cocktails.json` is the normalized review candidate. Its status remains
  `pending-human-review`; it is not a database seed.
- `tools/scrape_iba.py` discovers the official list pages and captures each cocktail
  page. It deliberately stops if the official list does not contain exactly 102
  unique cocktails so a source change cannot silently alter the catalog.
- `tools/build_catalog.py` applies the recorded corrections, canonical ingredient
  matching, glassware choices, and measurement presentation rules.

The source is the [International Bartenders Association Official Cocktail List](https://iba-world.com/cocktails/all-cocktails/),
retrieved on September 3, 2026. The product owner approved use of the publicly
available official recipe facts for this catalog. Each normalized recipe retains its
source page and retrieval date, and every normalized measurement retains the original
IBA line. The repository does not copy IBA photography or video.

## Format and identifiers

`cocktails.json` contains catalog metadata, a canonical ingredient array, and a
cocktail array. Every cocktail has exactly one initial IBA recipe for the MVP. A
recipe contains ordered ingredient references, instructions, glassware, garnish, and
source metadata.

Identifiers are lowercase namespaced strings:

- cocktails: `cocktail:<iba-slug>`
- recipes: `recipe:<iba-slug>:iba`
- ingredients: `ingredient:<canonical-slug>`

Accepted identifiers are immutable. A spelling or display-name correction changes
the label without changing the identifier; `INGREDIENT_ID_OVERRIDES` exists for an
ingredient rename that would otherwise produce a new slug. A source slug is not
changed merely to improve punctuation in a cocktail name. A genuinely different
cocktail, recipe, or canonical ingredient receives a new identifier.

Recipe ingredient fields have these meanings:

| Field | Meaning |
|---|---|
| `position` | One-based display order within the recipe. |
| `ingredientId` | Reference to one canonical ingredient. |
| `quantity`, `maximumQuantity` | Structured amount; the maximum is present only for a source range. |
| `unit` | Normalized unit such as `ounce`, `barspoon`, `dash`, `piece`, or `top-up`. |
| `quantityModifier` | `scant`, `heavy`, or null. |
| `displayQuantity` | Reviewed US bar notation shown to a user. |
| `requirement` | `required` or `optional`; optional lines never affect availability. |
| `preparation` | Ingredient-specific preparation that would be lost by canonical matching. |
| `sourceMeasurement` | Original IBA text plus its parsed amount and unit. |
| `curationNotes` | Local correction or judgment record when the normalized value is not mechanical. |

Ingredient categories use the Design vocabulary in JSON-safe form:
`spirit`, `liqueur`, `fortified_wine`, `bitters`, `syrup`, `juice`, `mixer`,
`fruit`, `herb`, `garnish`, and `other`.

## Matching and corrections

Matching ignores capitalization, accents, freshness wording, and minor spelling
variation. Equivalent source terms such as `Sugar Syrup` and `Simple Syrup` share one
canonical ingredient. Product names remain canonical when bartenders ordinarily use
them as the recipe ingredient, such as Campari, Aperol, Cointreau, and Grand Marnier.
Bottle-specific source entries are matched to a functional ingredient when the named
bottle is not required by the recipe model; examples include Smirnoff to Vodka,
Goslings to Dark rum, and Lagavulin 16 to Islay Scotch whisky. The original wording
remains in `sourceMeasurement.text` for review.

When an IBA line offers alternatives, the initial recipe uses its first-listed option
so availability has one deterministic ingredient reference. The recipe records that
choice in `curationNotes`; later recipe variations can represent another option
without changing this recipe. The current source contains five such choices.

The builder records nine corrected output lines: two missing `ml` units and two
missing spaces around `ml`, two lines created from a concatenated source line, and
three seasonings created from the Bloody Mary source's combined line. It also treats
`6/8` and `5/6` mint leaves as source ranges. No correction changes the raw snapshot.

## Measurement presentation

The source measurement remains authoritative. Milliliters use `1 oz = 29.5735 ml`
and normally round to the nearest quarter ounce. A 5 ml amount is shown as one
barspoon. Existing practical source units such as dashes, drops, teaspoons, pieces,
splash, top-up, and to-taste are retained.

All 59 occurrences of 10 ml, 20 ml, or 50 ml received an explicit recipe-line
judgment and note:

- 10 ml is currently a heavy quarter ounce.
- 20 ml is currently a scant three-quarter ounce.
- 50 ml is currently 2 oz except for the Bellini's peach purée, Canchanchara's water,
  and Irish Coffee's cream. Those three are a heavy 1 1/2 oz to keep a modifier,
  dilution, or topping from becoming an oversized 2 oz pour.

These are review decisions, not general conversion rules. They may be changed on an
individual recipe without changing the source measurement.

## Refresh and review

To intentionally create a new source snapshot and review candidate from the project
root:

```sh
python3 catalog/tools/scrape_iba.py \
  --output catalog/sources/iba-YYYY-MM-DD.json \
  --retrieved-on YYYY-MM-DD
python3 catalog/tools/build_catalog.py \
  --source catalog/sources/iba-YYYY-MM-DD.json \
  --output catalog/cocktails.json
```

Review all cocktail names, canonical ingredients/categories, ordered lines,
required/optional status, instructions, glassware, garnish, and source links. Give
special attention to every `curationNotes` entry and the top-level `review.focus`
list. Only after review should the catalog status change and Plan unit 0.2.2 be
marked complete.
