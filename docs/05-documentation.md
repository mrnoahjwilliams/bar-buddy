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

The approved source-neutral catalog contains 113 canonical ingredients, 102 cocktails, 102 default recipes, and 416 ordered recipe lines. It preserves recipe wording, reviewed US/metric measurements, optional non-exclusive styles, and stable namespaced identifiers. The runtime does not use it yet; persistence and repeatable import remain plan unit 1.2.1.

Dependency-free validation covers the exact versioned structure, required fields, duplicate identity/name checks, references, controlled values, compatible measurement pairs, and array/display order. Known-result fixtures verify valid optional and qualitative data plus precise failures. [`catalog/README.md`](../catalog/README.md) owns the format, curation decisions, provenance archive, and future import/correction contract.

## Application foundation and API generation

The backend uses Java 25, Spring Boot 4.1, PostgreSQL 17, Flyway, formatting/static checks, JUnit, and Testcontainers. The frontend uses React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind, shadcn/ui, ESLint, Prettier, Vitest, and React Testing Library. Exact versions are pinned in manifests, lockfiles, images, and wrappers. The Maven distribution has a committed checksum.

springdoc exports the real application contract from an isolated Spring/Testcontainers context. Orval generates the tracked client and TanStack Query hook through the narrow shared Fetch adapter. Drift verification rejects missing, modified, unexpected, ignored, or untracked generated artifacts; generated output is retained because it is the compile-time boundary between the backend contract and frontend consumers, not a disposable build artifact.

## Repository and CI

GitHub Actions runs required `backend-checks` and `frontend-checks` for pull requests to `main` and pushes to `main`. The backend job runs the full Maven verification. The frontend job installs once, then validates the catalog, frontend, and independently regenerated API artifacts. Jobs use pinned actions, minimum read permissions, disposable services, no hosted credentials, timeouts, and cancellation of superseded runs.

Protected `main` requires a pull request, resolved conversations, an up-to-date branch, and both required checks; force pushes and deletion are disabled, linear history is required, and only squash merges are enabled. Weekly Dependabot configuration covers Maven, npm, GitHub Actions, and Docker dependencies. GitHub vulnerability alerts, automated security updates, secret scanning, and push protection are enabled.

Bar Buddy has not been deployed. Public hosting, production email, observability, recovery, and release verification remain in plan unit 1.6.
