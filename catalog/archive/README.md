# Catalog provenance archive

This directory preserves the one-time materials used to prepare Bar Buddy's initial
cocktail catalog:

- `sources/iba-2026-09-03.json` is the unmodified source snapshot retrieved on
  September 3, 2026.
- `tools/scrape_iba.py` is the scraper used to capture that snapshot.
- `tools/build_catalog.py` records the corrections, matching, measurements, styles,
  and other decisions used for the final cleanup pass.

These files are historical provenance, not maintained product tooling. The
application, database import, and CI do not depend on them. The scraper may stop
working as the source site changes, and upstream changes do not update Bar Buddy's
catalog. [`../cocktails.json`](../cocktails.json) is the proposed permanent dataset and
becomes the source of truth after product-owner review.

The archived builder can reproduce the current review candidate from the frozen
snapshot if historical inspection is needed:

```sh
python3 catalog/archive/tools/build_catalog.py \
  --source catalog/archive/sources/iba-2026-09-03.json \
  --output catalog/cocktails.json
```
