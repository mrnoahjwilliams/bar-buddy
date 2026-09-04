# Requirements

Product obligations live here. [Definition](01-definition.md) owns terminology/scope boundaries; [Design](03-design.md) owns the accepted technical means; [Plan](06-plan.md) assigns work and unresolved decisions. Scheduled Releases 1–7 must remain achievable without replacing the cocktail/recipe model. Release 1 must be independently publishable.

## Scheduled capabilities

| Release | Required outcome |
|---|---|
| **1 — Home Bar / MVP** | Curated ingredient/cocktail/recipe catalogs; ingredient and cocktail browse/search/MVP filters/details as specified below; per-user inventory add/update/remove and Have/Out states; calculated makeability and distinct missing ingredients; one-ingredient-away results; ingredient detail listing cocktails that use it; recipe quantities, units, instructions, glassware and garnish; favorites and a random eligible cocktail. |
| **2 — Bar Explorer** | Cocktail filtering by any recipe ingredient and reviewed optional cocktail style, plus richer ingredient-based discovery; cocktail/ingredient photos, glassware visuals and preparation-technique guidance; general/seasonal/occasion tags, alcohol-free/mocktail support and ingredient/search aliases; alphabetical/ingredient-count sorting, recently viewed drinks, dark mode, print/share catalog cocktail, and full-screen mixing with supported screen-awake controls. Use existing entities. |
| **3 — Bar Expansion / Shopping** | Wishlist; personal unlock counts; ranked next-ingredient guidance; Help Me Shop selection mode combining missing ingredients for desired cocktails. |
| **4 — Make & Track** | Made This Drink records user, cocktail, selected recipe, servings and time; user history and calculated statistics, including sorting drinks by frequency made. |
| **5 — Smart Inventory** | Optional bottle size/remaining quantity; compatible volume normalization; manual or untracked inventory; transactional logging and deductions; derived low stock, servings remaining and limiting ingredients; user selection between reviewed US/metric recipe measurements, compatible measurement conversion where a pair is unavailable, multiple-serving recipe scaling and batch cocktail mode. |
| **6 — Personal Bar** | Ratings, notes, hidden/never-recommend controls, preferred recipes and variations; private user-created ingredients/cocktails/recipes; named, ordered menus with calculated available/missing inventory; sorting by personal rating. |
| **7 — Recommendation Engine** | Flavor/intensity metadata, advanced flavor/strength filters and strength sorting, Home drink/ingredient recommendations, similar drinks and cocktail of the day, using deterministic application logic with practical explanations. |

## Navigation and interaction

- **Home:** dashboard with bar summary in Release 1; headline history statistics and recommendations as their releases arrive.
- **Bar:** deliberately tracked Have, Out and, from Release 3, Wishlist items. Item detail shows inventory context and cocktails using the ingredient. Add to Bar opens a searchable/filterable canonical catalog; unowned ingredient detail reuses the presentation with appropriate actions and catalog usage, adding personal unlock impact in Release 3.
- **Drinks:** You Can Make first, then Other Drinks. Visually distinguish makeable/unavailable cards and keep unavailable details openable with missing requirements; order exactly-one-away results before larger missing counts. Detail shows the selected recipe and preparation information. Add Made This Drink in Release 4 and recipe selection/preferred defaults in Release 6.
- **More:** secondary history (or Profile) and menus. Headline statistics stay on Home.
- **MVP filters:** ingredient category; cocktail primary spirit, availability (All / Can Make / Exactly One Ingredient Away), and a favorites-only toggle. Text search remains available in both catalogs and combines with filters; resetting shows all results, still grouped/ordered by availability on Drinks. Availability and favorites filters arrive with their underlying features. Filtering cocktails by any recipe ingredient or reviewed optional style starts in Release 2.
- Help Me Shop is a mode within Drinks, with selected cards and a running combined missing-ingredient list at the bottom; no new primary Shopping page.
- Release 2 adds photo/visual fallbacks and accessible light/dark presentation, printable recipes, a focused mixing view and screen-awake behavior where supported. Sharing covers catalog cocktails; settle mechanism and recipient access before implementation. Private custom content, inventory and personal notes must not become public through sharing.
- Release 5 display/scaling/batch tools use the selected recipe without changing its reviewed measurement pairs. US is the initial catalog default; a later user preference selects US or metric presentation. Viewing or preparing a batch preview does not log drinks or deduct stock; explicit Made This Drink uses the agreed servings/consumption rules.

## Domain rules

- Support the eleven-entity target and release allocation in Design. Recipes reference canonical ingredients, not commercial bottles. A user may own multiple inventory items for one ingredient; each may have a bottle label.
- Through Release 4, availability uses distinct required recipe ingredients and the current user's Have inventory. Out/Wishlist never satisfy a requirement. Optional garnishes never change availability or one-ingredient-away status. Repeated recipe lines do not inflate missing-ingredient or distinct cocktail-usage counts.
- Release 5 must explicitly settle how quantities affect makeability, shopping, and unlock analysis before changing those results. Manual/untracked quantities remain valid for household or perishable items whose consumption is unreliable. Compatible volume measurements may be normalized; do not guess incompatible conversions or invent quantities for existing/untracked items.
- Initial catalog recipes retain reviewed US and metric measurements for each ingredient line. The metric values preserve exact milliliter recipes while the US values preserve the accepted practical bar presentation; neither is regenerated from the other during import.
- Unlock impact counts distinct currently unavailable cocktails made available by acquiring a candidate ingredient; exclude already-makeable cocktails and those still missing another requirement. Shopping combines distinct missing required ingredients for selected cocktails without persisting a shopping-plan entity or changing inventory.
- Availability, missing ingredients, unlocks, shopping plans, statistics, low-stock indicators, remaining servings, limiting ingredients and recommendations are calculated from authoritative records, never stored as independent authoritative entities/counters.
- Made This Drink is one backend operation. From Release 5, its log, all deductions and related status changes succeed or fail in one transaction; failures must leave no partial history/stock changes. Concurrency must not lose inventory updates. Decide safe retry behavior before logging is implemented, including a successful request whose response is lost; extend the same policy to deductions.
- System ingredients/cocktails/recipes are shared and read-only to normal users. From Release 6, optional ownership on those same entities distinguishes private custom content; only shared and the current user's content may appear in direct reads or derived results. Decide recipe edit/deletion and preference fallback policies before changing referenced content; preserve meaningful history.
- Recently viewed state follows an explicit device/account retention policy within the existing model; it must not leak between users. Media sources/use rights, tag/alias vocabulary and alcohol-free classification are decided before catalog enrichment.
- Recommendations use deterministic rules and practical reasons. Decide scoring, eligibility, exclusions, ties, missing-data and new-user fallbacks before implementation; no external probabilistic/AI service is required.

## Security and integration

- Support multiple users with isolation from the beginning. Supabase Auth supplies signup, login, password recovery and JWT issuance. React sends the JWT to Spring; Spring independently validates it and derives local identity from `sub`. Client-supplied user IDs never establish ownership.
- Enforce authorization on every user-owned query, mutation and reference, including indirect counts/recommendations. Normal users cannot modify system catalog content.
- Spring accesses Supabase-hosted PostgreSQL as ordinary PostgreSQL through the accepted persistence stack, not the Supabase Data API. Application logic, data access and authorization remain under project control.
- Anonymous and signed-in clients must not bypass Spring by reading or modifying application data through alternate Supabase APIs or direct database access. Verify this boundary when configuring the database, adding database objects and publishing; backend credentials remain server-only.
- Publish OpenAPI from backend contracts and use Orval-generated frontend types, client and TanStack Query hooks wherever generation covers the case.
- Inject secrets through environment/runtime configuration; never hardcode or commit them, log tokens, or require production credentials for tests/CI.

## Quality and platform

- Public, responsive, mobile-friendly web app and installable PWA where supported. No offline behavior is promised. Initial infrastructure cost stays at or near $0; native packaging may be reconsidered later.
- Follow the stack and feature-oriented modular monolith in Design. Keep business rules independently testable; organize APIs around resources/user actions, not mechanical table exposure. Do not introduce distributed services or Clean Architecture.
- Version reproducible schema changes; preserve valid catalog/user data during upgrades. Return consistent, useful validation/domain errors.
- Keep core views responsive at side-project scale, avoid per-row queries and unnecessary full-dataset transfers, and bound calculations to relevant data. Add server filtering/pagination when catalog size or measurement warrants it. No numeric latency, capacity or coverage target is accepted.
- Use the accepted query/cache workflow and meaningful behavior, authorization, migration and transaction tests. Foundation establishes reproducible local/CI checks; publication adds deployment verification. Workflow owns Git/PR/CI policy.
