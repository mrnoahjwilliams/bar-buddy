# Documentation

## Local application foundation

The application roots now exist under `backend/` and `frontend/`. [README](../README.md#setup) records verified setup, database lifecycle, startup and check commands; [Design](03-design.md#architecture-and-stack) owns toolchain choices.

- **Backend:** Java 25/Spring Boot 4.1.1 starts against local PostgreSQL 17.11. Only `GET /actuator/health` is permitted, with database details hidden. Other requests are denied, including synthetic authenticated requests; no default development user is created. JPA validates schema rather than creating application tables. Flyway initializes its own history metadata with no application migrations. Backend formatting/static checks, two security tests, executable packaging, and a real PostgreSQL Testcontainers startup/schema/HTTP check pass.
- **Frontend:** React 19 with routing, a per-provider TanStack Query client, Tailwind and a shadcn/ui button. The development shell provides a skip link and an unknown-page return path. Clean npm installation, formatting/lint, TypeScript, the behavioral routing test, and production build pass. Browser review confirmed desktop/mobile rendering and return navigation without console warnings or errors.
- **Scope:** no application entities, catalog, identity, product navigation, or frontend/backend data flow exists yet. springdoc and Orval are installed; generation is still unit 0.1.4. No production services or credentials were used for verification, and nothing has been deployed.

## Repository and remaining setup

Source is hosted at [mrnoahjwilliams/bar-buddy](https://github.com/mrnoahjwilliams/bar-buddy). GitHub permits squash merges only. Executable CI, required checks, and branch protection remain unit 0.1.5; local checks do not establish GitHub CI success. Full clean-checkout foundation acceptance remains 0.1.6. See [Plan](06-plan.md) for completion and [Workflow](07-development-workflow.md) for merge/deployment authority.
