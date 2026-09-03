# Bar Buddy

Track a home bar, find makeable cocktails, and see missing ingredients.

Public repository: [mrnoahjwilliams/bar-buddy](https://github.com/mrnoahjwilliams/bar-buddy).

Start with [AGENTS.md](AGENTS.md) for the document map and task-specific reading. Developers follow [Development Workflow](docs/07-development-workflow.md); [Plan](docs/06-plan.md) provides the next work unit and [Documentation](docs/05-documentation.md) records implementation.

## Setup

The local foundation includes a Spring backend, PostgreSQL, a React development shell, generated API contracts/clients, and GitHub Actions checks. Authentication and application features begin in Release 1.

### Prerequisites

- JDK 25 (`java -version`; verified with OpenJDK 25.0.2). Set `JAVA_HOME` to that JDK when multiple versions are installed.
- Node.js 24.20.0 and npm 11.19.0, pinned in [.nvmrc](.nvmrc), [.node-version](.node-version), and [package.json](frontend/package.json). With nvm installed, run `nvm install` and `nvm use` from the repository root.
- A running Docker engine with Docker Compose v2 support (`docker info` and `docker compose version`). Verified with Docker Desktop 29.5.3. Testcontainers uses the same engine.
- Internet access for the first Maven/npm install and PostgreSQL image pull. Maven 3.9.16 is downloaded by the committed wrapper; a separate Maven installation is unnecessary.

Commands below use a POSIX shell from the repository root unless a directory change is shown. No Supabase account or production credentials are needed.

### Clean checkout

```sh
git clone https://github.com/mrnoahjwilliams/bar-buddy.git
cd bar-buddy
```

Select the prerequisite Node version in this checkout before installing dependencies, then confirm `node --version` and `npm --version`. A new terminal or checkout may otherwise use your version manager's default. Follow Database, Backend, Frontend, and API generation below in order, using separate terminals for the running apps. The default local ports are `54329`, `8080`, and `5173`; ensure they are available before starting another copy.

### Database

```sh
docker compose up -d --wait
docker compose ps
```

The local PostgreSQL 17.11 database listens on `127.0.0.1:54329`. [compose.yml](compose.yml) and [the backend example](backend/.env.example) contain matching local-only credentials. Its named volume preserves data across stops. Stop it with `docker compose down`; start it again with `docker compose up -d --wait`. Inspect failures with `docker compose logs postgres`.

### Backend

In a separate terminal, create the ignored environment file on first setup:

```sh
cd backend
cp .env.example .env
```

After that one-time setup, start the backend from `backend/` with:

```sh
./mvnw spring-boot:run
```

Spring reads `backend/.env` automatically when started from that directory; no shell export or sourcing step is needed. Use unquoted `KEY=value` lines, as in the example, without `export`. Existing environment variables take precedence over the file. The file remains ignored by Git and is optional when runtime environment variables provide the settings instead.

Check `http://127.0.0.1:8080/actuator/health` with a browser or:

```sh
curl --fail http://127.0.0.1:8080/actuator/health
```

Expect status `UP`. Database details are hidden. Other requests are denied until authentication is implemented. Stop the backend with Ctrl+C. The example binds it to loopback; runtime settings are in [application.yml](backend/src/main/resources/application.yml). Flyway currently creates only its schema-history metadata, and its “No migrations found” warning is expected. There are no application migrations or tables yet.

From `backend/`:

```sh
./mvnw --batch-mode --no-transfer-progress verify
./mvnw spotless:apply
```

`verify` checks Java/POM formatting (Spotless), selected static rules (Checkstyle), compiles and packages the app, runs security tests, and runs PostgreSQL Testcontainers integration checks for startup and OpenAPI export. Docker is required; database tests fail if Docker is unavailable. They use disposable containers and require neither Compose nor a loaded `.env`. `./mvnw test` runs only the tests without containers and is not the full verification command. The executable package is `backend/target/bar-buddy-0.0.1-SNAPSHOT.jar`.

### Frontend

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

`npm ci` is needed on first setup or when dependencies change. For ordinary restarts, run only `npm run dev` from `frontend/` using the required Node version.

Open `http://127.0.0.1:5173`. The shell needs no environment variables or running API. Stop it with Ctrl+C. It displays the development status and handles unknown URLs with a return link; authenticated navigation comes later.

From `frontend/`:

```sh
npm run check
npm run format
npm run test:watch
npm run preview
```

`check` runs Prettier, ESLint, Vitest/React Testing Library routing and transport tests, API artifact-checker tests, TypeScript, and the production build. Individual commands are `format:check`, `lint`, `test`, `test:api-tooling`, `typecheck`, and `build`. Build output is in `frontend/dist/`; `preview` serves that output at `http://127.0.0.1:4173` after a successful build. shadcn/ui is configured in [components.json](frontend/components.json); add needed components with `npx --no-install shadcn add <component>`.

### API generation and drift

After installing frontend dependencies, run from `frontend/` with the prerequisite Java/Node versions and Docker running:

```sh
npm run api:generate
npm run check
```

Generation starts with a clean backend build and `OpenApiGenerationIT`, using a disposable PostgreSQL container and no listening application server. The test disables the local `.env` import, enables springdoc only in its test context, and reads the schema in-process without changing runtime security. Normal application startup still disables `/v3/api-docs`.

The pipeline copies the exported schema to [contracts/openapi.json](contracts/openapi.json) and uses [Orval configuration](frontend/orval.config.ts) to generate `frontend/src/api/generated/`. These two locations contain generated output only and are replaced by `api:generate`; review and commit them with the backend changes. Never edit generated files by hand. The current contract intentionally has no product paths; types and query hooks appear when real controllers/DTOs arrive in Release 1.

Review and stage the output, then run the drift check:

```sh
git -C .. add contracts frontend/src/api/generated
npm run api:check
```

`api:check` independently rebuilds the contract and client in temporary storage, compares them with working files and Git tracking, and exits nonzero for missing, stale, modified, unstaged, untracked, or obsolete generated output. It does not repair working files. Generation failures also fail the command; old output cannot make a failed generation pass. Keep other backend builds/generation runs sequential because they share `backend/target/`. This check is separate from `npm run check` because it also requires Java and Docker. `npm run test:api-tooling` tests the drift checker using temporary Git repositories without Docker.

The [request adapter](frontend/src/api/http.ts) preserves Orval request options/cancellation, returns successful JSON or empty bodies, and rejects HTTP errors with their status and response body. Requests use relative URLs. API origin routing and JWT attachment arrive with the first authenticated flow in unit 1.1.2.

### GitHub Actions

[CI](.github/workflows/ci.yml) runs three independent jobs for every pull request targeting `main`, including documentation changes, and for pushes to `main`. Each uses the same commands documented above:

| Check | Commands and environment |
|---|---|
| `backend-checks` | In `backend/`: `./mvnw --batch-mode --no-transfer-progress verify`; Java 25.0.2 and disposable PostgreSQL Testcontainers |
| `frontend-checks` | In `frontend/`: `npm ci` then `npm run check`; Node from `.node-version` |
| `api-contract` | In `frontend/`: `npm ci` then `npm run api:check`; the same Java, Node and Docker environment |

Jobs use Ubuntu 24.04, immutable GitHub Action revisions, dependency caches, read-only repository permissions, and timeouts. Superseded runs for the same PR or branch are canceled. CI requires no repository secrets, Compose database, or production services.

View a branch's checks with `gh pr checks` or the PR's Checks tab. After the workflow is merged into `main`, rerun it from the Actions tab or with:

```sh
gh workflow run ci.yml --ref main
```

[Documentation](docs/05-documentation.md#repository-and-ci) records verified CI and branch protection. [Workflow](docs/07-development-workflow.md#finish-and-review) owns merge authority.

### Development status

[Documentation](docs/05-documentation.md#foundation-acceptance) records clean-checkout acceptance. [Plan](docs/06-plan.md#021--catalog-decisions-and-format) owns the next catalog decisions and work.
