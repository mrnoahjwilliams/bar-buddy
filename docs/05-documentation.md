# Documentation

## Catalog curation draft

The 0.2 branch contains a dated machine-readable snapshot of all 102 cocktails on the IBA official list as retrieved on September 3, 2026, plus a normalized JSON review candidate. The offline scraper verifies the expected unique page count and preserves every source URL, ingredient line, method and garnish. The builder currently resolves 416 ordered recipe lines against 113 practical canonical ingredients, retains recipe-specific IBA ingredient wording and source measurements, converts ordinary metric quantities to US bar notation, and records corrections and judgment conversions. [`catalog/README.md`](../catalog/README.md) owns the draft format, provenance, matching rules and review procedure.

The normalized catalog remains `pending-human-review`. It is not a database seed, no application runtime uses it, and Plan units 0.2.1 and 0.2.2 remain incomplete until product-owner review resolves the catalog decisions and content. Automated validation/import readiness remains separately scheduled in 0.3.

## Local application foundation

The application roots now exist under `backend/` and `frontend/`. [README](../README.md#setup) records verified setup, database lifecycle, startup and check commands; [Design](03-design.md#architecture-and-stack) owns toolchain choices.

Starting the backend from `backend/` automatically imports its optional, Git-ignored `.env` file as Java properties. A fresh-process startup with the example file and no exported database variables returned health `UP`; an environment port override took precedence over the file. No additional dependency or shell setup is needed after the one-time file copy. Existing backend verification still passes.

- **Backend:** Java 25/Spring Boot 4.1.1 starts against local PostgreSQL 17.11. Only `GET /actuator/health` is permitted, with database details hidden. Other requests are denied, including synthetic authenticated requests; no default development user is created. JPA validates schema rather than creating application tables. Flyway initializes its own history metadata with no application migrations. Backend formatting/static checks, two security tests, executable packaging, and a real PostgreSQL Testcontainers startup/schema/HTTP check pass.
- **Frontend:** React 19 with routing, a per-provider TanStack Query client, Tailwind and a shadcn/ui button. The development shell provides a skip link and an unknown-page return path. Clean npm installation, formatting/lint, TypeScript, the behavioral routing test, and production build pass. Browser review confirmed desktop/mobile rendering and return navigation without console warnings or errors.
- **Scope:** no application entities, catalog, identity, product navigation, or frontend/backend product data flow exists yet. No production services or credentials were used for verification, and nothing has been deployed.

## API generation

springdoc now exports the real application contract from an isolated Spring/Testcontainers context. Orval generates the tracked frontend artifacts through a narrow Fetch adapter. [Design](03-design.md#repository-structure) owns the locations and integration choices; [README](../README.md#api-generation-and-drift) owns the commands. The contract currently has empty paths because no product endpoints have been implemented. Runtime documentation stays disabled and security checks still deny documentation access.

Verification included a disposable controller/DTO that generated a typed client and TanStack Query hook, passed TypeScript/build, and passed a temporary hook test through the real request adapter. The controller and test were then removed; the drift command rejected the stale contract/client and obsolete model. Clean generation removed all probe output. Nothing from that example remains as application behavior.

The drift command also rejected missing, modified, and unexpected files without repairing them, and rejected untracked generated output. Its temporary-Git tests cover staged modifications, unstaged corrections, ignored extra files and symlinks. Transport tests cover request options/cancellation, JSON, empty success bodies, and structured/malformed/non-JSON HTTP failures. Final generation and a separate drift check reproduced identical tracked artifacts. Full backend verification and frontend formatting, lint, tests, TypeScript and build pass.

## Repository and CI

Source is hosted at [mrnoahjwilliams/bar-buddy](https://github.com/mrnoahjwilliams/bar-buddy). [CI](../.github/workflows/ci.yml) implements `backend-checks`, `frontend-checks`, and `api-contract` on all pull requests targeting `main` and pushes to `main`, with no path filters. It also defines manual runs, available once the workflow is on the default branch. [README](../README.md#github-actions) owns commands and runner/toolchain details.

The first [GitHub run](https://github.com/mrnoahjwilliams/bar-buddy/actions/runs/33775795173) passed all three jobs, including real PostgreSQL integration, frontend installation/tests/build, and independent API regeneration. A [controlled failure](https://github.com/mrnoahjwilliams/bar-buddy/actions/runs/33776065052) temporarily removed a tracked generated model index: `api-contract` exited with a missing/untracked-artifact error while the other jobs passed. With protection active, GitHub reported the PR's merge state as `BLOCKED`, compared with `CLEAN` on the passing revision. The artifact was restored byte-for-byte in the following commit, and the [recovery run](https://github.com/mrnoahjwilliams/bar-buddy/actions/runs/33776253383) passed all three checks and returned the PR to `CLEAN`. The final diff contains no probe changes.

`main` requires a pull request, resolved conversations, an up-to-date branch, and all three checks from the GitHub Actions app. Protection applies to administrators, disallows force pushes/deletion, and requires linear history. GitHub permits squash merges only. The public repository supports these protections; no account upgrade or visibility change was needed. The required approval count is zero for the solo-owner workflow; user review and merge authorization remain governed by [Workflow](07-development-workflow.md#finish-and-review).

## Foundation acceptance

Unit 0.1.6 was verified on 2026-09-03 from a fresh clone of merged foundation commit `3bf8908`, with no existing `.env`, frontend dependencies, or build output. [README](../README.md#setup) provides the setup sequence. The acceptance run used the pinned Java 25.0.2, Node 24.20.0, npm 11.19.0, and a fresh npm cache; Maven used its existing dependency cache. Selecting Node before installation is necessary when a new checkout inherits another default version; the engine check correctly rejected Node 26 before the pinned version was selected.

The existing development session remained running. The acceptance copy used a separate Compose project and fresh volume, changing only the temporary Compose host port to `54330`, the copied backend example's database/server ports to `54330`/`8081`, and the frontend startup port to `5174`. These temporary settings are not application changes. No hosted services or production credentials were required.

- PostgreSQL became healthy from an empty volume. Backend startup loaded the copied example without exported database/server settings; health returned `UP` without database details, and application and API-documentation requests returned HTTP 401. Only Flyway's schema-history table existed. Compose stop/start reused the volume and retained that metadata.
- Full backend verification passed formatting/static checks, packaging, two security tests and two PostgreSQL integration tests, with no skipped tests.
- Clean frontend installation, formatting/lint, eight behavioral/transport tests, the API-tooling test, TypeScript and production build passed. Browser review confirmed the shell at desktop and mobile sizes, direct unknown-page loading and the return link, with no captured warnings or errors.
- API generation, a subsequent frontend check, and independent API drift verification passed. Regenerated contract/client files were identical to the tracked files, and the clone's tracked working tree remained clean. Local settings, installed dependencies and build output were ignored by Git.
- All three checks passed on the merged foundation PR [#6](https://github.com/mrnoahjwilliams/bar-buddy/pull/6) and on the [base commit's CI jobs](https://github.com/mrnoahjwilliams/bar-buddy/actions/runs/33777244132). Current acceptance-PR checks remain visible on its Checks tab.

No application changes were needed for acceptance. Temporary app processes and the disposable database were removed after verification. Foundation is complete; [Plan](06-plan.md#021--catalog-decisions-and-format) next requires catalog decisions and format review. Nothing has been deployed.
