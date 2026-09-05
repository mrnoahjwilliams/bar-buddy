# Local Development

This guide owns detailed setup, configuration, and verification commands. The root [README](../README.md) intentionally stays limited to the project overview, quick start, and current status.

## Prerequisites

- JDK 25. The project has been verified with OpenJDK 25.0.2.
- Node.js 24 and npm 11. The repository pins the versions in [`.nvmrc`](../.nvmrc), [`.node-version`](../.node-version), and the frontend package manifest.
- A running Docker engine with Docker Compose v2. Docker is required for local PostgreSQL and backend integration tests.
- Internet access for the initial Maven/npm dependency download and PostgreSQL image pull. The committed Maven wrapper downloads Maven 3.9.16 and verifies its archive checksum.

Run commands from the repository root unless a section changes directories. Default local ports are PostgreSQL `54329`, Spring `8080`, Vite `5173`, and Vite preview `4173`.

## Database

Start and inspect PostgreSQL:

```sh
docker compose up -d --wait
docker compose ps
```

The named volume preserves data across restarts. Stop the service without removing data using `docker compose down`, and inspect startup problems with `docker compose logs postgres`.

## Backend

Create an ignored, owner-readable environment file once:

```sh
cd backend
install -m 600 .env.example .env
```

Start Spring from `backend/` so it can read that file:

```sh
./mvnw spring-boot:run
```

The file uses unquoted `KEY=value` entries without `export`. Process environment variables take precedence. Check startup at <http://127.0.0.1:8080/actuator/health>; the expected response is `UP` without database details.

Run the complete backend verification with Docker available:

```sh
./mvnw --batch-mode --no-transfer-progress verify
```

This checks formatting and static rules, compiles/packages the application, runs unit tests, and runs PostgreSQL/Testcontainers integration tests. `./mvnw test` runs the faster unit-test subset. Apply Java and POM formatting with `./mvnw spotless:apply`.

## Frontend

Install dependencies and create the ignored browser configuration once:

```sh
cd frontend
cp .env.example .env
npm ci
```

Start Vite with `npm run dev`. It proxies relative `/api` requests to Spring at `127.0.0.1:8080`.

Run all frontend checks with `npm run check`. Individual commands include `format:check`, `lint`, `test`, `test:watch`, `test:api-tooling`, `typecheck`, `build`, and `preview`. Build output under `frontend/dist/` is disposable and ignored.

## Authentication

Authentication is disabled in the backend example and unavailable when the frontend settings are blank. To use the completed authentication flow, configure a Supabase project that uses an asymmetric JWT signing key:

1. In `backend/.env`, set `AUTH_ENABLED=true`, `AUTH_ISSUER`, and `AUTH_JWK_SET_URI`. Keep `AUTH_AUDIENCE=authenticated`.
2. In `frontend/.env`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the same project.
3. In Supabase Auth URL Configuration, set the local site URL to `http://127.0.0.1:5173` and allow `http://127.0.0.1:5173/reset-password` as a redirect.
4. Disable the Supabase Data API for application schemas. The browser must never access application tables directly.

Only the project URL and publishable key belong in `VITE_` settings. Never place database credentials, a service-role/secret key, or signing material in frontend files. Keep hosted database credentials only in the backend environment and use TLS.

The backend accepts only absolute HTTPS issuer and JWKS URLs, except loopback HTTP during local development. It verifies the token signature, issuer, audience, lifetime, and subject before deriving the current application user.

After both apps are running, authenticated `GET /api/v1/me` requests create or return the caller's local identity. Runtime API documentation remains disabled.

## Catalog and API generation

Spring startup applies Flyway V2 to create the empty catalog tables. No catalog is loaded automatically and no import command exists yet; the remaining import work is tracked in [Plan 1.2.1](06-plan.md#121--persist-and-import-catalog).

Validate the maintained catalog without installing extra dependencies:

```sh
cd catalog
npm run check
```

After backend DTO or controller changes, regenerate the tracked OpenAPI contract and Orval client:

```sh
cd frontend
npm run api:generate
npm run check
```

Review and stage the generated changes, then run `npm run api:check`. Generation and drift verification use a disposable PostgreSQL container, do not start a listening backend, and require no hosted credentials. Do not hand-edit files under `contracts/openapi.json` or `frontend/src/api/generated/`.

## CI and credential hygiene

GitHub Actions runs `backend-checks` and `frontend-checks` for pull requests to `main`, pushes to `main`, and manual runs. CI uses disposable services and no production credentials. Dependabot checks Maven, npm, GitHub Actions, and Docker dependencies weekly; vulnerability alerts and automated security updates are enabled in the repository settings.

Backend `.env` files containing credentials should remain ignored and owner-readable (`chmod 600 backend/.env`). Frontend `VITE_` values are shipped to the browser and therefore must never be treated as secrets. Build output, dependency directories, caches, and generated temporary files are not source artifacts and should remain untracked.
