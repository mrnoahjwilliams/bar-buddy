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

The drift command also rejected missing, modified, and unexpected files without repairing them, and rejected untracked generated output. Its temporary-Git tests cover staged modifications, unstaged corrections, ignored extra files and symlinks. Transport tests cover request options/cancellation, JSON, empty success bodies, and structured/malformed/non-JSON HTTP failures. Final generation and a separate drift check reproduced identical tracked artifacts. Full backend verification and frontend formatting, lint, tests, TypeScript and build pass. GitHub CI remains the next unit.

## Repository and remaining setup

Source is hosted at [mrnoahjwilliams/bar-buddy](https://github.com/mrnoahjwilliams/bar-buddy). GitHub permits squash merges only. Executable CI, required checks, and branch protection remain unit 0.1.5; local checks do not establish GitHub CI success. Full clean-checkout foundation acceptance remains 0.1.6. See [Plan](06-plan.md) for completion and [Workflow](07-development-workflow.md) for merge/deployment authority.
