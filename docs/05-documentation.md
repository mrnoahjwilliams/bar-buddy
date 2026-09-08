# Documentation

This document records implemented and verified behavior. [Requirements](02-requirements.md) owns obligations, [Design](03-design.md) owns technical decisions, [Plan](06-plan.md) owns progress and sequence, and [Local development](08-local-development.md) owns operational instructions.

## Authentication and navigation

The React application uses the official Supabase browser client for persisted email/password sessions, automatic token refresh, signup, login, logout, and password recovery. Only the project URL and publishable key are browser configuration. Missing, copied-placeholder, malformed, or insecure non-local configuration produces an unavailable login state instead of initializing the provider.

The application-facing authentication gateway exposes provider-neutral session events and stable user-facing errors. Protected Home, Bar, Drinks, and More routes wait for session restoration and return signed-out users to their complete requested path, query, and fragment after login. Feature pages live in their feature folders and route modules load lazily.

The generated-client transport attaches the access token, preserves request options and cancellation, and performs one refresh-and-retry after HTTP 401. Concurrent unauthorized requests share the same refresh and sign-out transition. Account changes and logout clear user-specific TanStack Query state before another account can populate it.

Frontend behavior and transport tests cover configuration validation, provider adaptation, signed-in/out routing, complete requested-location return, bearer attachment, concurrent refresh, expired sessions, account switching, cache isolation, logout, signup confirmation, password recovery, error handling, and unknown routes.

Hosted browser acceptance completed on September 4, 2026 against the accepted `bar-buddy` Supabase project and Spring/PostgreSQL environment. Signup with email confirmation, logout/login, password recovery, account switching, and the authenticated `GET /api/v1/me` flow passed. Supabase's default development email delivery is not suitable for public launch; release 1.6 still owns custom SMTP, templates, sender authentication, appropriate limits, and public-recipient verification.

## Backend identity and security

Flyway migration V1 creates `app_user` with an application UUID, unique nonblank Supabase subject, and creation time. `GET /api/v1/me` derives the subject only from the validated bearer token, creates the local identity atomically on first access, and returns only `id` and `createdAt`. Concurrent first requests converge on one row, and client input cannot select another user.

When authentication is enabled, Spring accepts asymmetric ES256/RS256 tokens from an absolute configured issuer/JWKS URL and validates signature, issuer, `authenticated` audience, lifetime, and bounded nonblank subject. Non-local issuer and JWKS URLs must use HTTPS. Spring receives no signing secret. Health remains public; application paths require authentication; unrelated paths and runtime API documentation remain denied.

Authentication and authorization failures use the shared RFC 9457-style `application/problem+json` response contract while retaining the bearer challenge. The OpenAPI document describes the protected `GET /api/v1/me` operation, success response, bearer scheme, and problem response. Tests assert those semantics rather than only checking that a document was emitted.

Migration V1 revokes current and default privileges from `PUBLIC` and provider Data API roles. PostgreSQL integration tests prove those roles cannot access the identity table or subsequently created objects while the backend can migrate and use the schema. Identity integration tests cover missing, malformed, invalid-signature, expired, wrong-issuer, wrong-audience, and blank-subject tokens; stable and isolated identities; ignored ownership input; and concurrent first access.

Hosted backend acceptance completed September 3, 2026 using Supabase's East US (Ohio) Free-plan project, its ECC P-256/ES256 signing key, TLS database connection, and disabled Data API. Provider roles lacked application privileges; genuine tokens for two temporary users remained isolated through Spring; anonymous and user-token REST/GraphQL attempts could not access application data. Temporary users and rows were removed afterward. Credentials remained only in ignored owner-readable backend environment files.

## Curated catalog

The approved source-neutral catalog contains 116 canonical ingredients, 102 cocktails, 102 default recipes, and 416 ordered recipe lines. It preserves recipe wording, reviewed US/metric measurements, optional non-exclusive styles, and stable namespaced identifiers. An explicit operator command loads it into PostgreSQL; normal web-server startup does not import.

Dependency-free validation covers the exact versioned structure, required fields, duplicate identity/name checks, references, controlled values, compatible measurement pairs, and array/display order. Known-result fixtures verify valid optional and qualitative data plus precise failures. [`catalog/README.md`](../catalog/README.md) owns the format, curation decisions, provenance archive, and future import/correction contract.

Migration V2 adds empty Ingredient, Cocktail, Recipe and RecipeIngredient tables with UUID database identities and unique catalog IDs on the first three. JPA maps lazy relationships and independent US/metric decimal measurements. Constraints protect references, positive unique recipe positions, controlled categories/requirements/units, compatible measurement pairs and valid quantities. Repeated ingredients at different positions are supported. Optional styles remain in the reviewed source for Release 2.

PostgreSQL integration tests verify fresh schema validation, upgrading V1 while preserving an existing user, migration reruns, relationship/measurement reads, invalid-data rejection and denied table privileges for all three provider Data API roles. These checks use disposable PostgreSQL; V2 was subsequently observed on the development database on September 8, 2026.

The packaged import command validates a file snapshot with the bundled existing Node validator before opening Spring/database connections. A transactional service serializes imports, rejects missing stable entities or incompatible identity changes, and performs bulk upserts preserving Ingredient/Cocktail/Recipe IDs. Recipe lines match by recipe and position; obsolete positions are removed. Reviewed US/metric quantities are copied independently. The command starts no web listener and has no browser-accessible import operation.

Integration tests load all 116 ingredients, 102 cocktails, 102 recipes and 416 lines; verify identical and concurrent repeats without identity/data drift; preserve external reference probes during corrections; synchronize repeated and removed recipe lines; reject missing identities and invalid snapshots; and prove rollback after a late database failure. The packaged command succeeds with disposable database credentials and rejects an invalid catalog before connecting to an unreachable database. The original 113-ingredient catalog was observed in the development database on September 8, 2026; the revised 116-ingredient catalog was explicitly imported there later that day. [Local development](08-local-development.md#catalog-and-api-generation) owns the exact command and Node requirement.

## Catalog browsing API

Authenticated `GET /api/v1/ingredients` returns compact, alphabetically ordered summaries. `/cocktails` returns summaries ordered by missing required ingredient count, then case-insensitive name and UUID. Both accept `search` as a trimmed, case- and accent-insensitive literal name substring (maximum 200 characters). Ingredient lists also accept `category`; cocktail lists accept `primarySpiritId`, which must identify a canonical spirit. Empty search/category resets that input; omitted spirit filtering returns all cocktails. Unknown categories, malformed IDs, nonexistent/non-spirit filter IDs and oversized searches return consistent problem responses with HTTP 400.

`GET /ingredients/{id}` includes the related cocktail summaries and their distinct usage count, including optional recipe lines. Repeated ingredient lines do not duplicate cocktails or inflate the count. `GET /cocktails/{id}` returns the single imported default recipe with ordered canonical ingredient references, recipe display names, requirement/preparation fields, reviewed US/metric measurements, instructions, glassware and garnish. Missing detail IDs return HTTP 404. These read-only operations share the existing authentication boundary. Cocktail summaries/details include availability derived only from the caller’s inventory, including related cocktails on ingredient detail; bottle labels and inventory records remain on the inventory API.

PostgreSQL integration tests verify full-catalog search/filter/reset behavior, literal wildcard characters, invalid inputs, authentication, identical shared results for two users, unavailable writes, related-detail navigation contracts, repeated-line counts and recipe ordering. Hibernate statement counts confirm two queries for the unfiltered cocktail list, four for cocktail detail and three for ingredient detail, without per-row relationship loads. OpenAPI and Orval provide the four operations and query hooks.

## Catalog browsing screens

Drinks now lists the cocktail catalog with submitted text search and a canonical primary-spirit filter. Bar links to the ingredient catalog with text search and category filtering. Search/filter values live in the URL, survive reload and browser history, and are preserved through detail-return links, including ingredient → related cocktail → ingredient navigation. Reset removes both filters. Both catalogs use the generated query hooks and authenticated transport; no separate fetch client or catalog DTOs were added.

Ingredient detail shows the API's distinct usage count and related cocktail links. Cocktail detail presents the default recipe's ordered US measurements, ranges/modifiers, canonical ingredient links, preparation text, optional lines, instructions, glassware and garnish. These screens have labeled controls, responsive layouts and loading, retryable error, invalid-input, missing-detail and empty states. Inventory actions and availability filtering are implemented below; favorites remain in their scheduled unit.

Frontend behavior tests cover combined filters, URL restoration, reset, empty results, authenticated generated requests, related navigation, recipe order/measurements and failure recovery. Browser layout review used disposable fixture responses at desktop, phone and tablet widths; the user subsequently confirmed working Bar and Drinks pages against the development database on September 8, 2026.

## Have/Out inventory and drink availability

Flyway V3 adds InventoryItem with a required AppUser owner, canonical ingredient, optional bottle label (200 characters maximum), and Have/Out status. Separate records may reference the same ingredient. Foreign keys preserve users and catalog references; owner/ingredient/status indexes support inventory and availability queries. The migration revokes PUBLIC and provider Data API role privileges. Fresh migrations and V2 upgrades preserving existing user/ingredient identities passed against disposable PostgreSQL. V3 was applied to the development database on September 8, 2026 during local runtime recovery.

Authenticated `GET /api/v1/inventory` lists only the caller’s items in ingredient-name/UUID order. `POST /inventory` requires ingredientId and status; label is optional and whitespace-only labels become null. `PATCH /inventory/{id}` replaces the editable label/status pair (status required, omitted/null label clears it); ingredient and owner stay fixed. `DELETE /inventory/{id}` removes one item. Ownership comes from JWT subject; foreign and nonexistent item IDs both return 404. Invalid bodies, status values, references and oversized labels return problem responses with 400. POST returns 201, PATCH 200 and DELETE 204. Duplicate creates are separate bottles; no retry-deduplication contract is claimed.

Cocktail list/detail and ingredient-related cocktail summaries include canMake, missingCount and distinct missing canonical ingredient summaries. A bounded query across the relevant cocktails excludes required ingredients satisfied by any caller-owned Have item. Repeated recipe lines, optional garnishes and additional Out bottles do not inflate missing counts or negate a Have bottle. No availability state is stored. Cocktail `availability` accepts omitted/empty/`all`, `can_make` and `one_away`; unknown values return 400. Search and primary spirit combine with this filter. Missing-count ordering places makeable drinks first and exactly-one-away before larger counts, with stable name/UUID ties.

Bar shows Have and Out sections with add, label editing, status changes and confirmed removal. Add to Bar opens the existing searchable/category-filtered ingredient catalog; shared ingredient detail shows owned items and an add/another-bottle form alongside related cocktails. Drinks shows You Can Make and Other Drinks groups, the All / Can Make / Exactly One Ingredient Away selector and availability labels. Unavailable details stay openable and link missing ingredients to ingredient detail. Successful mutations invalidate inventory, cocktail and ingredient query families while preserving URL filters and return navigation. Account changes clear cached data and remount protected routes to discard private form drafts and mutation state.

Backend integration checks cover authenticated CRUD, duplicate bottles, ownership tampering and cross-user failures, input rejection without changes, Have/Out/removal persistence, fresh/upgrade schema constraints, all provider-role table privileges, empty/full bars, repeated/optional lines, mixed bottles, user-specific related results, combined filters and bounded query counts (one for the inventory list and two for the full cocktail list). Frontend behavior checks exercise add/edit/Out/Have/remove, duplicate preservation, failed load/save retry, account/draft isolation, related/detail/list refresh and filtered return navigation. Browser review used disposable fixture data at desktop, 390px phone and 768px tablet widths, including long labels and adding a missing ingredient. No hosted inventory or availability acceptance has been performed.

## Approved catalog usability follow-up

Ingredient search also matches reviewed aliases and returns `matchedAlias` only
when the canonical name does not match. Triple sec finds Orange liqueur; creme de
cacao finds Crème de cacao. Flyway V4 adds aliases and a restricted normalization
function. Versioned imports synchronize aliases without replacing inventory IDs.
The three distinct rum additions and curation rules are recorded in the catalog
README. On September 8, 2026, V4 was confirmed already applied in the development
database, but the old 113-ingredient catalog had no aliases. An explicitly authorized
import loaded the revised 116-ingredient catalog. Database verification confirmed
all three new rums, the Triple sec aliases and a `trip` search matching Orange
liqueur; the inventory count remained 11. Browser reload is needed to discard cached
catalog responses. This is development data, not a public deployment.

Catalog cards open a large modal over the retained list. Repeated `detail` query
parameters support nested ingredient/recipe navigation, copied URLs and history.
One accessible dialog retains the mounted detail panels and their scroll/form state;
Close/Escape returns one level and restores focus. Standalone detail URLs still work.
Drink cards show up to two missing names plus a remaining count. Recipes highlight
missing required ingredients with an amber Missing tag; available lines have no
status label and optional lines retain a muted Optional annotation, with one compact
availability summary. When no
cocktails are makeable, Drinks offers a static juice/mixer reminder and catalog link;
adding ingredients is always explicit. The reminder checks global makeability even
when filters are active and refreshes after inventory changes.

Regression checks cover alias/accent filtering, duplicate-free results, migration
permissions and existing inventory, no implicit rum substitutions, nested dialog
focus/history/direct links, account/draft isolation and mutation refresh. Full backend verification, all 40 frontend behavior tests and tooling/build checks, catalog validation and API drift checks passed. Disposable browser review covered 390px phone, 768px tablet and 1280px desktop layouts and nested add-to-bar refresh.

## Application foundation and API generation

The backend uses Java 25, Spring Boot 4.1, PostgreSQL 17, Flyway, formatting/static checks, JUnit, and Testcontainers. The frontend uses React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind, shadcn/ui, ESLint, Prettier, Vitest, and React Testing Library. Exact versions are pinned in manifests, lockfiles, images, and wrappers. The Maven distribution has a committed checksum.

springdoc exports the real application contract from an isolated Spring/Testcontainers context. Orval generates the tracked client and TanStack Query hook through the narrow shared Fetch adapter. Drift verification rejects missing, modified, unexpected, ignored, or untracked generated artifacts; generated output is retained because it is the compile-time boundary between the backend contract and frontend consumers, not a disposable build artifact.

## Repository and CI

GitHub Actions runs required `backend-checks` and `frontend-checks` for pull requests to `main` and pushes to `main`. The backend job runs the full Maven verification. The frontend job installs once, then validates the catalog, frontend, and independently regenerated API artifacts. Jobs use pinned actions, minimum read permissions, disposable services, no hosted credentials, timeouts, and cancellation of superseded runs.

Protected `main` requires a pull request, resolved conversations, an up-to-date branch, and both required checks; force pushes and deletion are disabled, linear history is required, and only squash merges are enabled. Weekly Dependabot configuration covers Maven, npm, GitHub Actions, and Docker dependencies. GitHub vulnerability alerts, automated security updates, secret scanning, and push protection are enabled.

Bar Buddy has not been deployed. Public hosting, production email, observability, recovery, and release verification remain in plan unit 1.6.
