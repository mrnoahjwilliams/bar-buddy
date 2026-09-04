# Bar Buddy

Track a home bar, find makeable cocktails, and see missing ingredients.

Public repository: [mrnoahjwilliams/bar-buddy](https://github.com/mrnoahjwilliams/bar-buddy).

Start with [AGENTS.md](AGENTS.md) for the document map and task-specific reading. Developers follow [Development Workflow](docs/07-development-workflow.md); [Plan](docs/06-plan.md) provides the next work unit and [Documentation](docs/05-documentation.md) records implementation.

## Setup

The local foundation includes a Spring backend, PostgreSQL, a React development shell, generated API contracts/clients, and GitHub Actions checks. The backend identity flow, `AppUser` schema and hosted Supabase boundary are implemented and verified; browser signup, login and session handling follow in unit 1.1.2.

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

### Catalog

Validate the maintained catalog and its known-result fixtures without installing any
additional dependencies:

```sh
cd catalog
npm run check
cd ..
```

The check reports all invalid JSON paths together and prints the verified catalog
counts on success. [`catalog/README.md`](catalog/README.md#validation) owns the format,
validation coverage, and repeatable import/correction contract. Database import is
implemented later in unit 1.2.1.

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

Spring reads `backend/.env` automatically when started from that directory; no shell export or sourcing step is needed. Use unquoted `KEY=value` lines, as in the example, without `export`. Existing environment variables take precedence over the file. The file remains ignored by Git and is optional when runtime environment variables provide the settings instead. Authentication is disabled in the local example until the Supabase settings below are configured; application API requests return HTTP 401 while it is disabled.

Check `http://127.0.0.1:8080/actuator/health` with a browser or:

```sh
curl --fail http://127.0.0.1:8080/actuator/health
```

Expect status `UP`. Database details are hidden. Application requests require a valid configured bearer token; unrelated routes remain denied. Stop the backend with Ctrl+C. The example binds it to loopback; runtime settings are in [application.yml](backend/src/main/resources/application.yml). Flyway migration V1 creates the `app_user` identity table and hardens its current and future provider-role privileges.

From `backend/`:

```sh
./mvnw --batch-mode --no-transfer-progress verify
./mvnw spotless:apply
```

`verify` checks Java/POM formatting (Spotless), selected static rules (Checkstyle), compiles and packages the app, runs security tests, and runs PostgreSQL Testcontainers integration checks for migrations, identity, provider-role access, startup and OpenAPI export. Docker is required; database tests fail if Docker is unavailable. They use disposable signing keys and containers and require neither Compose, a Supabase project nor a loaded `.env`. `./mvnw test` runs only the tests without containers and is not the full verification command. The executable package is `backend/target/bar-buddy-0.0.1-SNAPSHOT.jar`.

### Supabase backend identity

Use a Supabase project with an asymmetric JWT signing key. Existing projects still using the legacy shared JWT secret must [rotate to an asymmetric key](https://supabase.com/docs/guides/auth/signing-keys) before enabling Bar Buddy authentication; the signing secret is neither needed nor accepted by the backend. In the project dashboard:

1. Keep Supabase Auth enabled and record the project URL. The issuer is `<project-url>/auth/v1` and the public key set is `<issuer>/.well-known/jwks.json`.
2. Because every application request goes through Spring, [disable the Data API](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api). Do not expose `public` or another application schema through REST or GraphQL.
3. Use the dashboard's Connect instructions to set `DB_URL`, `DB_USERNAME` and `DB_PASSWORD` for a normal PostgreSQL connection with TLS. These are server-only values; never use them, a database password or a Supabase secret/service-role key in `frontend/` or browser configuration.
4. Set `AUTH_ENABLED=true`, `AUTH_ISSUER`, `AUTH_JWK_SET_URI` and `AUTH_AUDIENCE=authenticated`. Run the backend so Flyway applies the `app_user` migration and its current/default privilege revocations.

With a real access token issued by that project, verify the Spring boundary:

```sh
curl --fail \
  --header "Authorization: Bearer $BAR_BUDDY_ACCESS_TOKEN" \
  http://127.0.0.1:8080/api/v1/me
```

The first request creates one local identity linked to the token's `sub`; later requests return the same `id` and `createdAt`. Tokens with an invalid signature, issuer, audience, expiry or subject return HTTP 401. Query parameters and other client input cannot select another user.

Then inspect the hosted database as an administrator. The following must return `false` for every listed role and privilege before the provider check is accepted:

```sql
select
    role_name,
    has_table_privilege(role_name, 'public.app_user', 'select') as can_select,
    has_table_privilege(role_name, 'public.app_user', 'insert') as can_insert,
    has_table_privilege(role_name, 'public.app_user', 'update') as can_update,
    has_table_privilege(role_name, 'public.app_user', 'delete') as can_delete
from unnest(array['anon', 'authenticated', 'service_role']) as role_name;
```

Finally, call both Supabase REST and GraphQL with no token and with access tokens for two test users. The disabled Data API must not permit either user to read or modify `app_user`. Confirm that both users can call Spring's `/api/v1/me`, receive distinct local IDs, and still cannot select one another through client input. Record these actual results in [Documentation](docs/05-documentation.md); local simulations do not substitute for the hosted checks.

The accepted hosted environment is the `bar-buddy` Free-plan project in Supabase's East US (Ohio) region. It uses the free IPv4 session pooler with required TLS for the server's ordinary PostgreSQL connection, an ECC P-256 current signing key exposed as ES256 through JWKS, and a disabled Data API. Flyway V1, current/default grant inspection, genuine two-user Supabase token access through Spring, concurrent first access, ownership isolation and anonymous/two-user REST and GraphQL denial passed on September 3, 2026. Temporary Auth identities and application rows were removed afterward. The database password remains only in an ignored owner-readable local environment file; tests, CI, tracked files and browser configuration contain no database or signing secrets.

### Frontend

In another terminal:

```sh
cd frontend
cp .env.example .env
npm ci
npm run dev
```

`npm ci` is needed on first setup or when dependencies change. For ordinary restarts, run only `npm run dev` from `frontend/` using the required Node version.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the copied file from the same Supabase project used by the backend. These are browser-facing Auth settings; never put the database password, JWT signing secret, service-role key or Supabase secret key in a `VITE_` variable. In Supabase Auth URL Configuration, use `http://127.0.0.1:5173` as the local Site URL and allow `http://127.0.0.1:5173/reset-password` as a redirect URL. Add production URLs only when deployment is configured.

Enable backend authentication for that project and start it on `127.0.0.1:8080`, then open `http://127.0.0.1:5173`. Vite proxies `/api` to that backend during local development; deployed hosting must route `/api` to Spring on the same public origin. The app supports email signup, login, logout and password recovery, protects Home/Bar/Drinks/More routes, and verifies a signed-in session through `GET /api/v1/me`. If the browser settings are absent, the login screen explains the configuration problem without attempting authentication. Stop the frontend with Ctrl+C.

From `frontend/`:

```sh
npm run check
npm run format
npm run test:watch
npm run preview
```

`check` runs Prettier, ESLint, Vitest/React Testing Library routing and transport tests, API artifact-checker tests, TypeScript, and the production build. Individual commands are `format:check`, `lint`, `test`, `test:api-tooling`, `typecheck`, and `build`. Build output is in `frontend/dist/`; `preview` serves that output at `http://127.0.0.1:4173` after a successful build. shadcn/ui is configured in [components.json](frontend/components.json); add needed components with `npm run ui:add -- <component>`. The command downloads the pinned generator only when UI scaffolding is requested, keeping it out of normal installs and CI.

### API generation and drift

After installing frontend dependencies, run from `frontend/` with the prerequisite Java/Node versions and Docker running:

```sh
npm run api:generate
npm run check
```

Generation starts with a clean backend build and `OpenApiGenerationIT`, using a disposable PostgreSQL container and no listening application server. The test disables the local `.env` import, enables springdoc only in its test context, and reads the schema in-process without changing runtime security. Normal application startup still disables `/v3/api-docs`. The generated contract includes bearer authentication and `GET /api/v1/me`; JWT attachment to the shared request adapter remains in unit 1.1.2.

The pipeline copies the exported schema to [contracts/openapi.json](contracts/openapi.json) and uses [Orval configuration](frontend/orval.config.ts) to generate `frontend/src/api/generated/`. These two locations contain generated output only and are replaced by `api:generate`; review and commit them with the backend changes. Never edit generated files by hand. The current contract intentionally has no product paths; types and query hooks appear when real controllers/DTOs arrive in Release 1.

Review and stage the output, then run the drift check:

```sh
git -C .. add contracts frontend/src/api/generated
npm run api:check
```

`api:check` independently rebuilds the contract and client in temporary storage, compares them with working files and Git tracking, and exits nonzero for missing, stale, modified, unstaged, untracked, or obsolete generated output. It does not repair working files. Generation failures also fail the command; old output cannot make a failed generation pass. Keep other backend builds/generation runs sequential because they share `backend/target/`. This check is separate from `npm run check` because it also requires Java and Docker. `npm run test:api-tooling` tests the drift checker using temporary Git repositories without Docker.

The [request adapter](frontend/src/api/http.ts) preserves Orval request options/cancellation, returns successful JSON or empty bodies, and rejects HTTP errors with their status and response body. Requests use relative `/api` URLs so local Vite and deployed same-origin routing remain outside generated clients. The adapter attaches the current Supabase access token, attempts one provider refresh after HTTP 401 and expires the local session when authorization still fails. Account changes and logout clear TanStack Query's user-specific cache.

### GitHub Actions

[CI](.github/workflows/ci.yml) runs two independent jobs for every pull request targeting `main`, including documentation changes, and for pushes to `main`. Each uses the same commands documented above:

| Check | Commands and environment |
|---|---|
| `backend-checks` | In `backend/`: `./mvnw --batch-mode --no-transfer-progress verify`; Java 25.0.2 and disposable PostgreSQL Testcontainers |
| `frontend-checks` | In `catalog/`: `npm run check`; then in `frontend/`: `npm ci --prefer-offline --no-audit --no-fund`, `npm run check`, and `npm run api:check`; Node from `.node-version`, Java 25.0.2 and disposable PostgreSQL Testcontainers |

Jobs use Ubuntu 24.04, immutable GitHub Action revisions, dependency caches, read-only repository permissions, and timeouts. Superseded runs for the same PR or branch are canceled. The combined web job installs frontend dependencies once instead of once for frontend verification and again for API drift. CI requires no repository secrets, Compose database, or production services.

View a branch's checks with `gh pr checks` or the PR's Checks tab. After the workflow is merged into `main`, rerun it from the Actions tab or with:

```sh
gh workflow run ci.yml --ref main
```

[Documentation](docs/05-documentation.md#repository-and-ci) records verified CI and branch protection. [Workflow](docs/07-development-workflow.md#finish-and-review) owns merge authority.

### Development status

[Documentation](docs/05-documentation.md#backend-identity) records the implemented and hosted-verified identity behavior. [Plan](docs/06-plan.md#112--frontend-authentication) identifies frontend signup, login and session handling as the next development unit.
