# Local Development

This guide owns detailed setup, configuration, and verification commands. The root [README](../README.md) intentionally stays limited to the product overview, screenshots, public app link, quick start, and documentation links.

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

## Account deletion

Set `SUPABASE_AUTH_ADMIN_KEY` in **backend/.env only** to a Supabase secret API key (or legacy service-role key) from the same project as `AUTH_ISSUER`. The backend derives the Auth administration endpoint from that issuer. This credential is used only for identity deletion; application data still goes through the ordinary PostgreSQL connection. Never use it in a `VITE_` value, browser code, or logs. Without it, deletion returns a recoverable 503 and preserves the account.

After exact `DELETE` confirmation, the backend atomically removes the user's inventory, favorites and display name and marks the local identity as deleted. All subsequent API requests using that subject are denied, including requests with otherwise-valid old tokens. The browser clears its local session. A background worker processes up to 25 pending identities every minute, hard-deleting the Supabase login; provider failures remain pending for the next pass. A provider 404 is treated as already deleted, making retries safe after a lost response. The backend must remain running for retries to progress.

A minimal local identity record (opaque IDs and lifecycle timestamps, no name/inventory/favorites) remains to reject old sessions and record completion. Existing backups retain their normal retention period. Review any future retention change against token-replay protection before purging these records.

For operations, inspect pending deletions using the trusted database connection:

```sql
SELECT count(*) AS pending_deletions, min(deletion_requested_at) AS oldest_request
FROM app_user
WHERE deletion_requested_at IS NOT NULL AND identity_deleted_at IS NULL;
```

Repeated `Account identity deletion pending` warnings indicate a provider/configuration issue. Correct the server credential or provider availability and leave the worker running; do not clear pending markers manually. `bar-buddy.account-deletion.worker-enabled=false` is reserved for isolated tests. Verify real deletion with disposable accounts and the public configuration during the release gate; local tests use a fake identity provider and never delete real users.

## Catalog and API generation

Spring startup applies pending Flyway migrations: V2 creates the catalog tables, V3 creates user-owned Have/Out inventory, V4 adds searchable ingredient aliases, V5 creates per-user cocktail preferences, and V6 adds the optional profile name and account-deletion lifecycle. Import is an explicit operator action; normal application startup does not load or overwrite catalog data.

Stop a backend running from this checkout before rebuilding or generating API artifacts, or use an isolated checkout. Restart it after the build so it loads the current classes and migrations. For this usability update, import the revised catalog to populate aliases and the three new rum ingredients; restarting alone does not populate them.

With Node 24 available on `PATH`, build the backend, then run this command from `backend/` using the intended server-only database settings in `.env` or the process environment:

```sh
./mvnw --batch-mode --no-transfer-progress verify
java -Dloader.main=com.barbuddy.catalog.CatalogImportApplication \
  -cp target/bar-buddy-0.0.1-SNAPSHOT.jar \
  org.springframework.boot.loader.launch.PropertiesLauncher catalog/cocktails.json
```

The command validates a snapshot of the complete input using the bundled catalog validator before opening the database. It then applies pending Flyway migrations and imports in one transaction, prints a completion message and exits. It starts no web listener and needs no Auth configuration. Invalid input or import failure produces a nonzero exit; failed catalog writes roll back together. Flyway migrations are a separate preceding operation and remain applied if a later import fails.

Re-running the same file preserves database identities and does not duplicate records. Corrections update display data and synchronize ordered recipe lines. Missing stable entities, changed cocktail slugs or recipe membership require a reviewed migration; they are not automatic retirements or renames. See the [catalog correction contract](../backend/catalog/README.md#import-and-correction-contract). Only run against the intended database; hosted catalog import remains a separately authorized operator action; routine code deployment follows the continuous-delivery policy. Node is required for this operator command and its backend integration tests, but not for normal backend startup.

Validate the maintained catalog without installing extra dependencies:

```sh
cd backend/catalog
npm run check
```

After backend DTO or controller changes, regenerate the tracked OpenAPI contract and Orval client:

```sh
cd frontend
npm run api:generate
npm run check
```

Review and stage the generated changes, then run `npm run api:check`. Generation and drift verification use a disposable PostgreSQL container, do not start a listening backend, and require no hosted credentials. Do not hand-edit files under `backend/contracts/openapi.json` or `frontend/src/api/generated/`.

## CI and credential hygiene

GitHub Actions runs `backend-checks` and `frontend-checks` for pull requests to `main`, pushes to `main`, and manual runs. CI uses disposable services and no production credentials. Dependency updates are reviewed manually. Dependabot version-update configuration is removed and automated security-update PRs are disabled; vulnerability alerts remain enabled.

Backend `.env` files containing credentials should remain ignored and owner-readable (`chmod 600 backend/.env`). Frontend `VITE_` values are shipped to the browser and therefore must never be treated as secrets. Build output, dependency directories, caches, and generated temporary files are not source artifacts and should remain untracked.

## Production hosting

[Design](03-design.md#mvp-hosting-decision) owns provider selection. Keep every
service on its ongoing free plan. Do not add a payment method to Render: its
[free limits](https://render.com/docs/free) can otherwise produce bandwidth/build
overages. No paid trials, disks, databases, workers, scheduled keep-alives, or
upgrades. Vercel Hobby is for personal/non-commercial use. Supabase Free can pause
after inactivity; Resend Free currently limits sending to 100/day and 3,000/month.
Review provider dashboards before launch and after usage alerts. Exhausted or
withdrawn free capacity means suspend/migrate, not purchase. Domain renewal is
separate from application hosting. These are policy/configuration choices, not a
promise that providers will offer free service forever.

### Backend deployment

1. Merge reviewed PRs after required CI passes. `render.yaml` sets `plan: free`
   and `autoDeployTrigger: checksPass`.
   Creating a Blueprint can perform an initial deploy, so do it only when ready.
2. Create one Render Docker web service from this repository using the Blueprint,
   or its equivalent settings: Dockerfile `backend/Dockerfile`, context `backend`,
   branch `main`, Free instance, health path `/actuator/health`, auto-deploy After CI Checks Pass.
   Choose a region close to the existing Supabase project. Do not create Render
   PostgreSQL; its free database expires.
3. Supply `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `AUTH_ISSUER`,
   `AUTH_JWK_SET_URI`, and `SUPABASE_AUTH_ADMIN_KEY` using Render's environment UI.
   Copy from the intended existing Supabase project, never browser build variables.
   Use the session pooler (port 5432, IPv4 compatible), its displayed username, and
   a JDBC URL with `sslmode=require`. Do not use the transaction pooler for Flyway.
   Keep the Data API disabled and existing application/default grants restricted.
4. `production` binds `0.0.0.0:$PORT` (default 10000), always enables JWT validation,
   limits the JDBC pool to three connections and disables local `.env` import.
   The image runs as an unprivileged user with a bounded heap. Render terminates
   public HTTPS; the application exposes only the existing health endpoint publicly.
5. Startup applies Flyway then validates JPA mappings. Check logs and health before
   routing browser traffic. Never bypass a failed migration or enable automatic DDL.
   Copy Render's actual HTTPS service origin for Vercel's `BACKEND_ORIGIN`.
6. Import the catalog with the existing operator command in
   [Catalog and API generation](#catalog-and-api-generation), using the same reviewed
   revision and the explicitly selected hosted database. The runtime container has
   no Node or catalog data and Render Free has no shell/one-off jobs. Do not add a
   public import endpoint. Existing reviewed catalog imports need no overwrite.

Local container verification:

```sh
docker build -t bar-buddy:hosting backend
```

Full tests run separately with `./mvnw verify`; the container package step skips
execution of tests because a build environment has no disposable database engine.
The image installs unzip to preserve verification of the wrapper's pinned ZIP
checksum (the wrapper otherwise selects a tar archive on minimal images).

### Frontend and DNS

1. Import this GitHub repository into Vercel **Hobby**, root directory `frontend`,
   Node 24. The committed configuration uses the Build Output API and enables
   automatic Git deployments only for `main`. Set Production branch to `main`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the existing
   project, and `BACKEND_ORIGIN` to the Render HTTPS origin without paths or secrets.
   Scope production settings to Production; do not give preview builds production
   credentials. Reviewed merges deploy automatically.
3. `npm run build:vercel` builds static assets and generates `.vercel/output`.
   Missing/insecure backend origins fail packaging. `/api/**` proxies before static
   lookup and SPA fallback, with no-store headers. Other GET/HEAD routes load the
   SPA, including `/reset-password` and copied drink details. No CORS wildcard or
   backend custom domain is required. API calls remain protected by Spring JWTs.
4. Add `barbuddy.projects.williamsestate.net` to the Vercel project. In Cloudflare,
   add **CNAME** name `barbuddy.projects`, target **the exact value Vercel displays**,
   TTL Auto, proxy **DNS only**. Add a Vercel ownership TXT only if requested.
   Do not change nameservers or unrelated records. Vercel issues the HTTPS
   certificate for the exact nested hostname; Cloudflare Universal SSL's ordinary
   wildcard does not cover it. Wait for Vercel's Valid Configuration/TLS result.
5. Review installation at the canonical HTTPS URL. The manifest includes 192/512px
   maskable icons and an Apple touch icon. The service worker passes all requests
   to the network and stores nothing. Browser installation UI varies; no offline
   data access is promised. Review deep-link refresh and reset links on mobile.

### Auth email delivery

The owner completed and verified production email setup on September 10, 2026.
The steps below are the rebuild/reference procedure; use current provider-displayed DNS values.

1. Add `barbuddy.projects.williamsestate.net` in Resend Domains. Use manual DNS
   setup and add only the displayed DKIM TXT plus sending SPF TXT/MX records in
   Cloudflare. Keep receiving disabled and preserve existing domain mail records.
   The sending MX is for the `send` subdomain, not the root domain. Resend must
   show Verified before SMTP is enabled. No Cloudflare account-wide access needed.
2. Create a Resend **sending-only** API key restricted to this domain. Store it as
   the SMTP password in Supabase Auth custom SMTP, never in Git/Render/Vercel.
   Host `smtp.resend.com`, port `465`, username `resend`, sender name `Bar Buddy`,
   sender address `noreply@barbuddy.projects.williamsestate.net`.
3. Supabase Site URL becomes `https://barbuddy.projects.williamsestate.net`.
   Allow the exact `/reset-password` URL there. Retain exact local development
   redirect entries if needed; do not allow wildcard preview domains. Enable email
   confirmation. Custom SMTP must deliver to public recipients before publication.
4. Paste [confirmation](../deploy/auth/confirmation.html) into Confirm signup
   (subject `Confirm your Bar Buddy email`) and
   [recovery](../deploy/auth/recovery.html) into Reset password
   (subject `Reset your Bar Buddy password`). Preserve `{{ .ConfirmationURL }}`:
   Supabase verifies the token and redirects to the configured app. Branding is in
   sender/content; verification links still use Supabase's domain. No paid custom
   Auth domain. Disable Resend click/open tracking for authentication emails.
5. Start with Supabase's custom-SMTP email limit of 30/hour and a 60-second per-user
   interval, staying within Resend's daily/monthly caps. These hourly limits alone
   do not guarantee staying below the daily cap; check both dashboards and leave
   the provider on Free so exceeding quotas cannot silently buy more delivery.
6. Test signup confirmation and password recovery with disposable public recipient
   accounts, including expired/used links. Inspect Resend delivery/bounce status.
   Quota, unverified sender or bad SMTP credentials are delivery failures, not a
   reason to disable confirmation. Never paste credentials into PRs or chat.

### Recovery and release checks

Render may sleep after 15 idle minutes; its next request can take about a minute.
Do not add synthetic traffic to prevent sleep. Requests can time out while waking;
existing retry controls should work once healthy. Pending account deletions remain
in PostgreSQL and resume when the backend wakes. Inspect pending markers as described
in [Account deletion](#account-deletion); do not promise immediate provider deletion
while the service is asleep. A sustained memory failure within the free allowance
blocks publication until resolved without a paid upgrade.

Before production migrations, take an encrypted local database backup using the
trusted operator connection (`pg_dump --format=custom`) and verify restoration into
a disposable database. Keep the credential in an owner-readable password file,
never a command URL or repository. Supabase Free does not provide the same backup
recovery guarantees as paid plans; schedule operator backups before releases and
important data changes. Account for separately managed Auth identities on restore.

If a deploy fails, retain the last working frontend/backend revision. Roll back code
only when compatible with the applied schema; Flyway migrations are not undone by
container rollback. Prefer a reviewed forward fix. Restore a backup only after
explicitly approving data loss and validating it in isolation. Unpause Supabase in
its dashboard if needed; then check database TLS, backend health, issuer/JWKS and
proxy origin. Rotate compromised credentials in their owning service and update only
the server-side destination that uses them.

The owner confirmed MVP publication and verification complete on September 10, 2026.
Repeat the applicable Plan release gates for later product releases.


### Continuous delivery

- GitHub: preserve protected `main` and required `backend-checks` / `frontend-checks`. Review the completed PR, wait for green checks, then squash-merge in GitHub. No second Codex turn is required.
- Render: existing Blueprint **Bar Buddy** → Settings → Auto Sync **Yes**, branch **main**, path **render.yaml**. Its Free `bar-buddy-api` service uses **After CI Checks Pass**. The Blueprint applies the committed deployment setting after merge. Check Syncs if service settings diverge; a manually created replacement service must be configured equivalently.
- Vercel: existing **bar-buddy** project → Git must remain connected to **mrnoahjwilliams/bar-buddy**; Production tracks **main**, root is **frontend**, with existing Production environment settings. `frontend/vercel.json` enables `main` and disables other branches, including slash-containing feature branches. Do not override it with an Ignored Build Step that skips production. No deploy hooks or Actions secrets are needed.
- Observe deployment in Vercel Deployments and Render Deploys/Events. Match both revisions to the merged `main` commit, require Vercel Ready and Render Live/healthy, then check the public app and `/api/v1/me` rejects anonymous access. The first merge of this configuration is the first full automatic-delivery test; do not claim that future run has already passed.
- Builds and startup take minutes and finish independently. Refresh an existing tab for new frontend assets. Follow [Workflow's compatibility rules](07-development-workflow.md#continuous-delivery) and the recovery procedure above if either provider fails; a GitHub Release or passing CI is not evidence that both services are live.
