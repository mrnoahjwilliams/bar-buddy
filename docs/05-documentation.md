# Documentation

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

Full clean-checkout foundation acceptance remains 0.1.6. See [Plan](06-plan.md) for completion. Nothing has been deployed.
