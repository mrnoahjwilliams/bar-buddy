# Development Guidelines

Engineering conventions live here. Follow [Requirements](02-requirements.md) for business rules, [Design](03-design.md) for structure, and [Workflow](07-development-workflow.md) for the work routine and permissions. Do not implement later-release entities/features early or silently decide unresolved business rules.

## Backend

- Organize by feature; keep features relatively flat, adding `dto/` or other folders only when useful. `shared/` contains only cross-cutting config, errors, measurement and security.
- Controllers handle transport, basic validation coordination and delegation. Services own business decisions and transaction boundaries. Repositories answer persistence questions; MapStruct performs structural mapping, never policy.
- Use Jakarta Validation for input shape/basic constraints and consistent domain-aware errors for business failures. Expose deliberate request/response DTOs, never JPA entities.
- Keep Cocktail and Recipe distinct when the catalog schema is first introduced. Add only the current release's fields/entities; do not interpret the target model as an instruction to build it all now.
- Resolve the authenticated user from the validated JWT; scope queries and reference validation to the allowed owner. Test direct and indirect cross-user access failures. Log enough request/operation context to diagnose failures without JWTs, secrets or unnecessary personal data.

## Persistence and quantities

- Use Flyway for schema changes; no automatic schema mutation except disposable local development. Keep migrations reproducible from empty PostgreSQL and test upgrades with existing data.
- Add constraints/indexes for ownership, relationships, uniqueness, order and common queries. Test mappings/queries with PostgreSQL Testcontainers, not an assumed-equivalent in-memory database.
- Keep derived results in non-persistent result objects. Implement logging/deductions as a single service transaction when scheduled; protect against lost updates and implement the agreed retry policy.
- Normalize compatible units with controlled precision. Keep manual/untracked inventory valid and avoid invented conversions, remaining quantities or allocation policies.

## API and frontend

- When backend DTOs/controllers change, regenerate and commit springdoc OpenAPI and Orval types/client/query hooks in the same change, adapting affected existing React consumers so they remain compatible. Add new UI flows only when their scheduled Plan units are included in the selected PR scope. Do not hand-edit generated artifacts or maintain duplicate DTOs/fetch clients/hooks when generation covers the case. A necessary custom transport adapter must remain narrowly scoped to generation integration.
- Keep route setup/providers/layout in `app/`, behavior in feature folders, reusable UI in `components/ui/`, and generated clients in `api/generated/`.
- Reuse ingredient detail for owned/unowned contexts. Keep shopping logic in its feature module while presenting it as the Drinks mode. Follow Requirements for navigation, sorting and release timing.
- Refresh affected query data after mutations; clear user-specific caches on account changes. Preserve relevant filter/navigation state. Provide accessible controls and loading, error and empty states.

## Verification and maintenance

- Use risk-driven unit tests for business rules and meaningful frontend behavior tests; avoid styling/component-internal assertions and arbitrary coverage targets. Reproduce business-rule bugs with regression tests before fixes.
- Integration-test authentication/authorization, isolation, migrations, queries, endpoint contracts and transaction rollback. Cover retries/concurrency when those behaviors arrive.
- Check query cost as features are added, including N+1 behavior and representative catalog/inventory data. Use the performance boundary in Requirements rather than inventing pagination or numeric targets.
- Keep local checks and CI commands aligned, pin compatible tooling/dependencies, and document actual commands in README. Verify compatibility when selecting or upgrading versions.
- Update only affected canonical documents using Workflow's ownership rules. Record accepted decisions before relying on them and distinguish planned, implemented, verified, merged and deployed states.
