# Implementation Plan

## How to execute

Follow releases and work units in order. A heading ending in three numbers is a child unit; where there are no children, the two-number milestone is the unit. Units are implementation and verification checkpoints; Workflow defines how to group them into coherent PRs with multiple commits. A milestone may take one PR or several. Parent milestones finish only when all children and applicable verification finish. The roadmap includes every scheduled feature in Requirements.

Each unchecked unit names an outcome, its work and its distinguishing verification. **Decide** marks choices to settle and record before dependent implementation, not permission to invent a rule. Routine tooling choices within Design may be made by the implementer. Read the corresponding Requirements release/domain rules and Design model/API sections; use Workflow for Git/approval/docs and Guidelines for implementation conventions.

For every unit: implement its full stated scope, run meaningful checks, update affected docs and check it only when verified. A checkbox is not proof of merge; Workflow distinguishes prerequisites on the base from verified work included in the same PR. Preserve partial completion as smaller checkboxes within the unit if needed. Do not duplicate the product specification in this plan.

### Shared verification

Apply these checks wherever the changed behavior depends on them; unit-specific cases below supplement them:

- Backend rule/validation tests, consistent errors, authenticated ownership and cross-user reference protection; shared catalog remains read-only. Check indirect counts/calculations for private-data leaks.
- Fresh migrations plus upgrades preserving existing data and provider access restrictions when database objects change; PostgreSQL mappings/queries, referential integrity and representative query cost without per-row/N+1 work.
- API contracts, regenerated client and affected existing or currently scheduled UI flows; cache refresh after mutations, account-switch isolation, persistence after reload, accessible mobile/desktop controls and loading/error/empty states.
- Follow Workflow's required local/CI checks. Never count unrun checks as passing or add tests that merely mirror implementation.

### Release gate

Every **publish** unit includes: relevant full backend/integration/frontend regressions; clean setup and fresh/upgrade migrations/imports as applicable; representative performance and responsive UI review; approved deployment; public critical journeys with two accounts, including login/recovery, isolation and denial of alternate client access to application data; documented deployment/recovery instructions and actual deployed status. A failing gate leaves publication incomplete. Later releases preserve earlier behavior and data.

### Completed preparation

- [x] Prepared agent instructions, workflow/authority, README, Git ignore rules and PR template; selected GitHub/GitHub Actions and verified the original instructions with a fresh agent. Later routing changes use Workflow verification. This completes no application milestone.
- [x] Named the app Bar Buddy and selected `com.barbuddy`; assigned the former enhancement list to releases. Repository bootstrap publishes the reviewed documents as one initial commit before application work.

## Release 0 — Environment and catalog foundation

No public app or application entity schema yet.

### 0.1 — Project foundation

#### 0.1.1 — Application roots

- [x] Create Bar Buddy backend/frontend roots and initial needed feature boundaries using `com.barbuddy`; preserve the prepared documents. Use the existing GitHub repository and open the first development PR under Workflow. **Verify:** structure/package identity, remote/base and PR are correct; no later-release features are scaffolded as implemented behavior.

#### 0.1.2 — Runnable backend and local database

- [x] Configure the accepted Java/Spring dependencies and compatible versions, Maven wrapper, runtime/example configuration, local PostgreSQL and backend test runners. Add selected formatting/static checks. Document prerequisites, startup, database lifecycle and commands in README. **Verify:** backend starts, package/unit checks run, and a real PostgreSQL Testcontainers check works without production credentials; do not create future application tables for a smoke test.

#### 0.1.3 — Runnable frontend

- [x] Configure React/TypeScript/Vite and the accepted frontend libraries, providers, package manager/lockfile, formatting/lint/type checks and behavioral test runner. Document install/start/build/test commands. **Verify:** clean installation, app startup, meaningful shell test and production build; leave authenticated navigation to 1.1.

#### 0.1.4 — Generated API pipeline

- [x] Configure springdoc and Orval; choose tracked contract/client locations and narrow transport integration. Document deterministic generation using local/test configuration. **Verify:** generation runs and frontend compiles; the drift check detects missing/stale/modified/untracked output. Demonstrate a disposable contract change and remove it; do not add a permanent fake product endpoint or handwritten duplicate client.

#### 0.1.5 — Executable CI and protection

- [ ] Implement the Workflow CI contract using the verified local commands: backend/PostgreSQL checks, frontend checks/build and API drift. Run a controlled failure and a final successful GitHub run; enable real required checks and supported branch protections. **Verify:** failures propagate, required checks appear for docs PRs too, and enforcement works where supported. Record actual check names and any protection limitation; surface unavailable account features without buying/changing visibility.

#### 0.1.6 — Foundation acceptance

- [ ] Follow README from a clean checkout: configure examples, install dependencies, start both apps/database, run checks/builds and generate the API client. **Verify:** foundation PR checks pass, setup requires no undocumented secrets/manual steps, and relevant configuration/status documentation is accurate. Source hosting and CI now exist; production hosting remains in 1.6.

### 0.2 — Curated catalog

#### 0.2.1 — Catalog decisions and format

- [ ] **Decide:** catalog size, sources/use rights, curation/update process and the initial recipe for each cocktail before preferences exist. Define the import format, stable ingredient/cocktail/recipe identifiers and correction/matching rules before bulk curation. **Verify:** a reviewed sample represents canonical ingredients, required versus optional lines, units, order, instructions, glassware and garnish without bottle/SKU dependencies.

#### 0.2.2 — Reviewed dataset

- [ ] Curate the agreed ingredient names/categories and cocktail recipes in that format; resolve ambiguous measurements, duplicates and broken references. AI-assisted data still requires review. **Verify:** sample makeable/one-away/multiple-missing cases, repeated ingredients and optional garnishes are correct; source/use-rights and curation records accompany the data.

### 0.3 — Validation and import readiness

- [ ] Build repeatable validation for required fields, references, duplicates, measurements, requirement types and display order, with useful errors. Prepare small known-result fixtures separate from the full catalog. Define repeatable import/stable matching and correction behavior preserving identities and future references. **Verify:** valid and deliberately invalid fixtures, full catalog validation and documented import instructions. Persistence arrives in 1.2.

## Release 1 — Publishable Home Bar MVP

### 1.1 — Authentication and application shell

#### 1.1.1 — Backend identity

- [ ] Configure Supabase Auth and normal PostgreSQL connections with Design's provider access restrictions; add AppUser/Flyway migration uniquely linked to validated JWT `sub`; implement Spring Security and `GET /me`. **Verify:** valid/invalid/expired tokens, identity persistence and concurrent first access without duplicate users; client-supplied ownership is ignored/rejected. Confirm anonymous and two users' Auth credentials cannot read/write application data through Supabase REST/GraphQL; inspect application-object grants and confirm database credentials are absent from browser configuration. Auth and authorized Spring access must work. Document the actual settings and checks.

#### 1.1.2 — Session and navigation

- [ ] Build signup/login/logout/recovery and expired-session/error handling; attach JWTs through generated-client transport and create responsive Home/Bar/Drinks/More navigation. **Verify:** signed-in/out transitions, recovery, API authorization, account switching and removal of previous-user cached data. This is the first authenticated frontend → API → database journey.

### 1.2 — Catalog persistence and browsing

#### 1.2.1 — Persist and import catalog

- [ ] Add Ingredient, Cocktail, Recipe and RecipeIngredient with separate cocktail/recipe models, constraints and migrations. Import reviewed data with stable matching/correction rules. **Verify:** empty-database setup, repeat import without duplication, relationships and preserved references; normal users cannot edit system records.

#### 1.2.2 — Browse and inspect

- [ ] Implement ingredient/cocktail list, text search and detail contracts/screens, with ingredient category and cocktail primary-spirit filters. Show recipe quantities/units/order, instructions, glassware/garnish, and ingredient detail's **related cocktail list plus distinct usage count** in this release. **Verify:** filter/search combinations, reset/empty/invalid inputs, repeated recipe lines do not inflate counts, and selecting a related cocktail opens its detail through generated-client flows. Availability/favorites filters arrive in 1.4/1.5; filtering cocktails by any recipe ingredient waits for 2.1, and photos/visuals for Release 2.

### 1.3 — Have/Out inventory

#### 1.3.1 — Inventory API

- [ ] Add InventoryItem with owner, canonical ingredient, optional bottle label and Have/Out. Implement validated list/create/update/delete; allow multiple items per ingredient. **Verify:** ownership, duplicate-ingredient bottles, status transitions and reload persistence. Out remains different from removal or never-owned catalog content; quantities/Wishlist remain deferred.

#### 1.3.2 — Bar interaction

- [ ] Build Have/Out sections and add/edit/remove/status controls. Connect Add to Bar to searchable/filterable catalog and reuse owned/unowned ingredient detail with related drinks. **Verify:** complete add → label → Out → Have → remove journey, empty/error states, account isolation and refresh of affected views.

### 1.4 — Availability and Drinks

#### 1.4.1 — Availability service

- [ ] Calculate makeability and distinct missing required ingredients from current Have inventory; add results and the agreed MVP availability filters to cocktail APIs without storing derived state. **Verify:** empty/full bars, repeated ingredients, optional garnishes, several bottles including mixed Have/Out, different users and filter/search combinations; avoid per-cocktail queries.

#### 1.4.2 — Availability presentation

- [ ] Show You Can Make, then Other Drinks ordered by missing count with one-away first. Add the All / Can Make / Exactly One Ingredient Away selector alongside primary-spirit filtering and search. Keep unavailable details openable and missing ingredients explicit. **Verify:** grouping, combined filters/reset/empty results, details and automatic refresh after inventory changes without losing navigation context.

### 1.5 — Preferences and discovery

#### 1.5.1 — Favorites

- [ ] Add UserCocktailState and preference API favorite/unfavorite; wire card/detail controls and a favorites-only Drinks filter that combines with search, primary spirit and availability. **Verify:** persistence, isolation, repeated updates, combined filters/empty results and affected-view refresh when favorites change. This completes the seven-entity MVP model.

#### 1.5.2 — Random cocktail

- [ ] **Decide:** eligible filters/availability and no-match behavior. Implement random API and UI action opening an eligible cocktail. **Verify:** eligibility, filter combinations, empty candidate set and failure feedback.

#### 1.5.3 — Home and MVP integration

- [ ] Build Home bar information and links to existing flows. Review responsive navigation, long content, loading/error/empty states and the end-to-end MVP journey. **Verify:** signup → Bar → makeability/missing ingredients → favorite/random → reload/logout. History statistics and recommendations wait for their releases.

### 1.6 — Publish the MVP

#### 1.6.1 — Hosting and deployment setup

- [ ] **Decide:** frontend/backend hosting, production deployment approach and Bar Buddy public URLs/branding assets within the near-$0 constraint. Implement deploy/build configuration (backend container where used), runtime settings, Flyway execution, secure transport, database access, browser/API origins and Auth redirect/recovery settings. **Verify:** build/configuration checks and documented deployment/recovery steps; reuse established CI. Actual public verification occurs in 1.6.3.

#### 1.6.2 — PWA and deployed navigation readiness

- [ ] Add installability assets/configuration and route-refresh/navigation support. **Verify:** responsive layouts and supported installation behavior locally; do not imply unspecified offline functionality. Deployment-specific installation checks remain in 1.6.3.

#### 1.6.3 — Release 1 acceptance and publication

- [ ] Complete the release gate, including catalog loading and the public two-account signup → inventory → availability/missing detail → favorite/random → reload/logout journey, recovery, PWA installation and deep-link refresh. Record actual published status; later scheduled releases remain incomplete.

## Release 2 — Bar Explorer

### 2.1 — Ingredient-based discovery

- [ ] Extend existing related-cocktail detail with category/inventory context and cocktail filtering by any chosen recipe ingredient. Combine it with existing search/MVP filters; link to filtered Drinks with change/clear controls. **Verify:** distinct counts across repeated lines/recipes, correct matching, availability groups, missing explanations and detail/back/filter-clear navigation. Preserve the MVP primary-spirit filter and related list; do not add unlocks early.

### 2.2 — Catalog enrichment and discovery

#### 2.2.1 — Tags, aliases and mocktails

- [ ] **Decide:** general/seasonal/occasion tag vocabulary, ingredient/search alias matching and alcohol-free/mocktail classification/coverage. Extend existing catalog fields and reviewed data; support combined search/filtering without new persistent entities. **Verify:** aliases such as OJ → Orange Juice, duplicate matches, tags and mocktail results with normal availability grouping; do not infer precise strength before Release 7.

#### 2.2.2 — Filters and sorting

- [ ] Extend existing search/filter combinations with the new metadata and alphabetical/ingredient-count sorting. Define distinct-count treatment of optional ingredients, stable ties and invalid/empty parameters. Extend mobile controls, active indicators and reset. **Verify:** combinations/ties/empty results, makeable/one-away grouping, cache/navigation state and query cost. Frequency, rating and strength sorts arrive in 4, 6 and 7 respectively.

#### 2.2.3 — Recently viewed cocktails

- [ ] **Decide:** device/account persistence, retention and recency ordering within client storage or existing user state. Record successful detail views and expose recently viewed drinks. **Verify:** repeat views, empty/removed results, reload/account changes and privacy; browsing must not change drink history or inventory.

### 2.3 — Visuals, recipe tools and publication

#### 2.3.1 — Photos and preparation information

- [ ] **Decide:** image source/use rights, initial catalog coverage/fallbacks and glassware/technique vocabulary. Add cocktail photos, ingredient photos, glassware icons/visuals and preparation-technique information; retain required garnish instructions. Use existing entities/assets and adapt both catalog/detail contexts. **Verify:** reviewed asset attribution, missing-image fallback, accessible descriptions, responsive display and usable recipe/garnish/technique guidance.

#### 2.3.2 — Dark mode

- [ ] Define appearance preference persistence within existing client/user settings and implement accessible light/dark themes, including system preference behavior. **Verify:** controls, contrast, reload/account behavior, images, forms and all primary/detail views.

#### 2.3.3 — Print and mixing view

- [ ] Add print recipe and full-screen recipe/mixing mode with quantities, units, instructions and garnish/technique details. Add optional user-controlled screen-awake behavior where supported, releasing it on exit and providing a clear unsupported/denied fallback. **Verify:** print layout, long recipes, responsive mixing controls, focus/back navigation and screen-awake lifecycle; neither viewing nor printing logs or consumes a drink.

#### 2.3.4 — Share a catalog cocktail

- [ ] **Decide:** link/text mechanism, recipient access/login behavior and shared recipe identity. Implement sharing for system catalog cocktails with the agreed clipboard/native-share fallback. **Verify:** another user's opening/copying/cancel flow and useful recipe context; exclude private content, notes and inventory. Public sharing of custom content remains deferred.

#### 2.3.5 — Polish and publish

- [ ] Fix browse/detail/back, filter usability, long-content layouts and shared ingredient detail. Complete the release gate for ingredient/alias/tag/mocktail discovery, sorting/recent views, photos/guidance, dark mode, print/mixing and sharing, preserving inventory/favorite refresh, normal availability and isolation.

## Release 3 — Shopping

### 3.1 — Wishlist

- [ ] Extend inventory status/constraints and APIs/UI for Wishlist and transitions, preserving Have/Out records. Add Bar section and ingredient-detail actions. **Verify:** migration, ownership, mixed statuses/multiple bottles and refresh; Wishlist-only items never satisfy availability.

### 3.2 — Unlock impact

- [ ] Calculate hypothetical before/after availability for a candidate without changing inventory; expose distinct newly makeable cocktail count through the ingredient API and detail. Distinguish personal unlocks from catalog usage. **Verify:** owned/Out/Wishlist candidates, already-makeable/still-missing drinks, repeated requirements, optional garnishes, user differences and inventory refresh.

### 3.3 — Next-ingredient ranking

- [ ] **Decide:** deterministic basic ranking, candidates, ties and no-benefit/empty behavior. Implement purchase advice from unlocks and show explained Home suggestions linked to detail, Wishlist and Add to Bar. **Verify:** rankings/ties/fallbacks, isolation, query cost and refresh. Viewing guidance must not mutate inventory; advanced personalization waits for 7.

### 3.4 — Help Me Shop and publication

#### 3.4.1 — Shopping selection mode

- [ ] Implement shopping-plan API for selected cocktails under the current recipe convention; validate empty/repeated/invalid selections. Build Drinks selection mode with selected cards, running bottom list and enter/exit controls. **Verify:** deduplicated overlapping missing requirements, already-makeable selections, Out/Wishlist, optional garnishes and refresh after selection/inventory changes; no saved shopping entity or inventory mutation.

#### 3.4.2 — Publish shopping

- [ ] Complete the release gate with Wishlist → ingredient unlock/ranking → cocktail selection → combined shopping-list journeys and regressions for normal Drinks navigation/availability.

## Release 4 — Make & Track

Logging does not deduct inventory in this release.

### 4.1 — Made This Drink

#### 4.1.1 — Logging and retry contract

- [ ] **Decide:** allowed/default servings and time inputs, whether availability is required, and safe retry semantics. Cover request identity/lifetime, reuse with changed input, concurrent duplicates, and a successful request whose response is lost; stay within the locked entity model. Implement DrinkLog and transactional POST with ownership and recipe/cocktail validation. **Verify:** persistence, invalid references/input, agreed duplicate/retry outcomes and rollback; inventory is unchanged.

#### 4.1.2 — Logging interaction

- [ ] Add Made This Drink on detail with servings/time inputs as decided, pending/success/failure feedback and prevention of repeated in-flight clicks. Preserve request identity across retries as required by the agreed contract. **Verify:** lost-response/retry and ordinary failure journeys, selected recipe/servings/time and refresh of affected data; do not rely on disabled buttons alone for duplicate protection.

### 4.2 — History

- [ ] Implement user-scoped chronological history with cocktail/recipe/servings/time, readable dates/timezones and boundaries/pagination only as needed. Build the secondary History page with detail links. **Verify:** ordering/time display, multiple users, empty/error/reload states and post-log refresh. Log editing/deletion is not in this unit.

### 4.3 — Statistics and publication

#### 4.3.1 — Derived statistics

- [ ] Define initial metrics, servings treatment, date boundaries and empty-history behavior. Calculate aggregates from logs and show Home headlines plus History detail; add Drinks sorting by frequency made using the agreed log/serving metric. **Verify:** hand-calculated examples, multiple servings/date boundaries, zero versus failed requests, sort ties/never-made drinks, availability grouping, isolation and post-log refresh; no stored counters.

#### 4.3.2 — Publish tracking

- [ ] Complete the release gate for logging → History → Home statistics, including retry behavior. Confirm existing inventory is unchanged by logging.

## Release 5 — Smart Inventory

### 5.1 — Measurements and stock

#### 5.1.1 — Quantity decisions and calculations

- [ ] **Decide:** units/precision, quantity-to-Have/Out relationships, low-stock meaning, unknown/insufficient amounts, and possession-based shopping versus quantity-aware makeability/unlocks. Implement compatible-volume normalization/value calculations. **Verify:** equivalent volumes, controlled precision and incompatible/ambiguous measurements without guessed conversions.

#### 5.1.2 — Quantity persistence and controls

- [ ] Extend InventoryItem with tracking choice, bottle size, remaining amount and units; extend APIs/Bar/detail for quantity entry and manual adjustment. **Verify:** validation, ownership, tracked/untracked transitions, status rules and migration defaults preserving existing items without invented quantities.

### 5.2 — Atomic consumption

#### 5.2.1 — Allocation policy and calculation

- [ ] **Decide:** bottle selection, allocation across bottles, shortages, untracked items and optional garnish consumption. Calculate required quantities from selected recipe/servings, combining repeated ingredients in compatible units, and allocate only eligible user inventory. **Verify:** multi-bottle/mixed-tracking cases, equivalent units, servings and shortages against agreed examples; do not invent a deduction policy.

#### 5.2.2 — Transaction and user feedback

- [ ] Extend Made This Drink to create the log, all deductions and related status updates atomically, preventing lost updates. Extend the Release 4 retry policy so duplicate/replayed successful requests cannot consume stock again. Update API/UI for success/stock failures and refresh Bar, availability, history and statistics. **Verify:** rollback after partial work, concurrent consumption, duplicate/lost-response retries, ownership, multiple servings and mixed tracking.

### 5.3 — Stock indicators and recipe quantities

#### 5.3.1 — Stock indicators

- [ ] Derive low stock, servings remaining and limiting ingredients under the agreed rules; expose them on Bar/detail and maintain shopping/unlock consistency. **Verify:** known/tied limits, zero/unknown stock, multiple bottles, repeated ingredients, incompatible units and optional garnishes; avoid falsely exact estimates and refresh after adjustments/consumption.

#### 5.3.2 — US/metric display and recipe scaling

- [ ] **Decide:** supported display units, automatic conversion/rounding, preference persistence, serving range and treatment of non-volume/optional ingredients. Add US/metric recipe display, compatible measurement conversion and multiple-serving scaling using shared measurement rules. **Verify:** equivalent quantities, repeated lines, incompatible units, fractional servings and round-trip display; preserve canonical recipes and keep logging servings explicit. Print/mixing/share outputs use the selected display/servings where supported by their agreed contracts.

#### 5.3.3 — Batch cocktail mode

- [ ] **Decide:** batch size, scaling limits, dilution/ice and preparation exceptions, garnish handling and how batch logging maps to servings. Implement a batch preview and instructions using the selected recipe and shared conversions. **Verify:** reviewed batch examples, unknown/non-scalable quantities and print/mixing integration; preview never consumes inventory, and an explicit made-batch action follows atomic logging/deduction and retry rules.

### 5.4 — Publish Smart Inventory

- [ ] Complete the release gate for entry → manual adjustment → indicators → multi-serving drink → stock/history/statistics refresh, with tracked/untracked accounts, plus US/metric conversion, recipe scaling and batch preparation/logging. Include consumption/concurrency/retry/rollback regressions and upgrades without retroactive deductions or invented quantities.

## Release 6 — Personal Bar

### 6.1 — Shared and private content

#### 6.1.1 — Ownership model and direct access

- [ ] Add nullable ownerUserId to Ingredient/Cocktail/Recipe, preserving system records as shared. Scope direct reads/references to shared plus current-user content; derive custom ownership from authentication. **Verify:** migrations, read-only system content and cross-user reference/access rejection. A user's recipe may attach to a visible cocktail without exposing private content to other users.

#### 6.1.2 — Derived visibility

- [ ] Apply the same visibility to lists, counts, availability, shopping/unlocks and existing guidance. Ensure shared responses do not reveal another user's private recipe/ingredient. **Verify:** indirect two-user leaks and existing public catalog results across all affected APIs/UI, without adding authoring early.

### 6.2 — Personal controls

- [ ] **Decide:** rating scale/reset and hidden visibility/unhide behavior. Extend UserCocktailState/API/detail and relevant card tags with ratings, notes, hidden and never-recommend; preserve favorite and untouched settings. Add personal-rating sorting with explicit unrated/tie behavior and existing availability grouping. **Verify:** combinations/resets/persistence, save failures, hide/unhide, ownership and favorite preservation. Never-recommend remains distinct from hidden; history is retained.

### 6.3 — Custom content

#### 6.3.1 — Recipe lifecycle decisions

- [ ] **Decide:** how variations determine availability, shopping and unlocks; how edits/deletions affect logs, preferred recipes and later menus; and default/fallback behavior when no preference exists or a recipe becomes unavailable. Record examples and a reference-retention policy before authoring; do not silently delete/rewrite history.

#### 6.3.2 — Authoring API

- [ ] Implement private ingredient creation (`POST /ingredients`), cocktail creation and recipe add/update/delete with existing entities. Validate content, visible ingredient/cocktail references and owner-authorized edits; apply lifecycle rules while leaving shared recipes unchanged. **Verify:** private ingredient use, cross-user references, invalid recipes and edits/deletions of referenced recipes.

#### 6.3.3 — Authoring UI

- [ ] Build ingredient/cocktail/recipe creation and recipe edit/delete flows connected to catalog/detail, with validation and post-save navigation/refresh. **Verify:** complete creation-to-use and edit/delete flows, applicable photo/tag/alias metadata, persistence, errors and privacy. Public sharing remains deferred.

### 6.4 — Preferred recipes everywhere

#### 6.4.1 — Preference and calculation integration

- [ ] Add preferred Recipe to UserCocktailState; validate visibility and cocktail membership. Apply the decided default/fallback/variation rules to availability, usage counts, unlocks, purchase advice and shopping. **Verify:** different requirements/quantities, no preference, unavailable preferred recipe and private visibility.

#### 6.4.2 — Selection and consumption integration

- [ ] Add recipe dropdown/preferred-default controls, separating temporary selection from saved preference. Recalculate quantity estimates and ensure logging/deductions use the selected recipe. **Verify:** views refresh after recipe/preference changes, actual selected-recipe consumption is correct, and past logs remain meaningful and unchanged.

### 6.5 — Menus

#### 6.5.1 — Menu model and API

- [ ] **Decide:** detailed UX, membership/order rules, recipe selection and servings/quantity assumptions. Add Menu/MenuCocktail and validated owner-scoped list/detail/create/update/delete plus membership/order operations. **Verify:** persistence, duplicates/order, invalid/private references and authorization.

#### 6.5.2 — Calculations and menu UI

- [ ] Calculate combined required inventory and available/missing drinks using current rules; build named ordered collections under More. Refresh after membership, inventory, recipes or preferences change. **Verify:** overlapping requirements, mixed tracking, optional garnishes, order and cross-user privacy; do not persist inventory snapshots as menu results.

### 6.6 — Publish Personal Bar

- [ ] Complete the release gate for custom creation → personal controls → recipe choice → shopping → logging/stock → menu. Recheck direct/derived privacy, recipe lifecycle/history/defaults and multi-recipe/menu query cost; upgrades preserve catalog ownership, quantities, logs, favorites and preferences.

## Release 7 — Deterministic recommendations

### 7.1 — Flavor and strength

#### 7.1.1 — Metadata model and curation

- [ ] **Decide:** flavor vocabulary/intensity scale, curation, strength meaning/source/calculation and variation/unknown-data handling. Add CocktailFlavorProfile (eleventh entity), keeping other needed fields within existing entities; import reviewed metadata with shared/private ownership. **Verify:** valid/invalid/unknown examples, migrations and reviewed recipe-dependent values.

#### 7.1.2 — Metadata presentation and strength sorting

- [ ] Extend responses and appropriate cards/details with flavor/intensity/strength and add strength sorting under the agreed interpretation. **Verify:** ties, unknown placement, availability grouping, private visibility and selected-recipe changes; unknown strength must not appear as zero/low strength.

### 7.2 — Filtering and similar drinks

#### 7.2.1 — Recommendation rules

- [ ] **Decide:** similarity and personalized drink/ingredient formulas, signals, eligibility/exclusions, ties, recipe handling, cold-start/missing-data fallbacks and practical explanations. Define how personalized ingredient ranking relates to Release 3's basic ranking; decide cocktail-of-the-day eligibility/selection, day boundary/timezone, repeat behavior and fallbacks. Record hand-checkable input/output examples before implementing scoring.

#### 7.2.2 — Filters and similarity

- [ ] Add flavor/intensity/strength filters while preserving prior filters/availability grouping; implement deterministic similar-drink API and detail links with reasons. **Verify:** expected rankings/ties, unknown metadata, private candidates, combined filters and navigation.

### 7.3 — Home drink recommendations

#### 7.3.1 — Personalized suggestions

- [ ] Implement the agreed inventory/preference/history/recipe/metadata formula, respecting visibility, hidden/never-recommend and preferred-recipe rules. Expose ordered explained suggestions and Home links to detail/Made This Drink. **Verify:** deterministic changed-input results, exclusions, no candidates, new users/missing data and refresh after inventory/preference/recipe/log changes; retain bar summary/statistics.

#### 7.3.2 — Cocktail of the day

- [ ] Implement the agreed deterministic daily selection and expose it on Home through the recommendation contract. **Verify:** stable results within the defined day, boundary/timezone changes, exclusions/private visibility, unavailable/no-eligible candidates and links to the correct recipe. Keep it distinct from the immediate random-cocktail action.

### 7.4 — Personalized ingredient advice

- [ ] Rank ingredients from current stock, unlock impact and agreed preference signals; apply visibility/exclusions to contributing cocktails. Expose reasons and Home links to detail/Wishlist/Add to Bar, preserving agreed basic-shopping behavior. **Verify:** rankings/explanations, owned/Wishlist-only/limited bars, no-benefit/empty results, isolation, unlock consistency and refreshed advice; Home integrates drink suggestions, ingredient guidance, summary and statistics.

### 7.5 — Publish Release 7

- [ ] Complete the release gate for new/established users: recommendation → recipe choice → Made This Drink → updated stock/history/advice. Include explanation/exclusion/privacy/consumption/menu regressions, Home/filter/strength-sort/similarity/daily-selection/purchase query cost, and upgrades preserving all prior data. Confirm the eleven-entity model and calculated-state boundaries. Verify all scheduled features in Requirements are accounted for before completing Release 7.

## Maintenance

Every planned feature has a release assignment in [Requirements](02-requirements.md#scheduled-capabilities) and executable work above. [Definition](01-definition.md#boundaries) owns deferred Someday scope. Keep completed work visible; revise the roadmap only for accepted scope/design changes or a real sequencing issue. Record settled behavior in Requirements and technical decisions in Design; Workflow governs status/document maintenance. Do not create a separate unscheduled feature list or session handoff.
