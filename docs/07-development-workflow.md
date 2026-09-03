# Development Workflow

Execution and Git/CI policy live here. Use [AGENTS.md](../AGENTS.md) to load only task-relevant context. Plan is the ordered backlog; Documentation records actual implementation. No separate session handoff/log or duplicate issue tracker is required.

## Before

1. Inspect files, applicable instructions, branch/status, staged/unstaged work and relevant history. With a remote, fetch and inspect related PRs. Preserve unrelated changes; do not reset, clean, stash or switch away from another person's work without understanding ownership.
2. For development, select the earliest incomplete **smallest numbered work unit** in Plan, reconcile it with actual implementation, and read its requirements/design and Guidelines. An explicit user task overrides the default selection. “What's next?” requests guidance only.
3. The user normally merges PRs before returning. Still verify prerequisite work is present in current `origin/main`; a checked implementation item on an unmerged branch is not a usable dependency. If a prerequisite PR is pending, resume its checks/review or report the pending merge. Do not recreate the work or silently start dependent work from an older base. Without a remote, apply the same check against local `main`.
4. Ask only for decisions blocking the current action, record accepted answers in the owning document, and continue independent authorized work. Briefly state the unit/outcome and relevant checks. Missing tooling is expected until its foundation unit.
5. Continue the related task branch/PR or create a branch from the verified base with a safe working tree. Run the focused baseline checks needed to identify pre-existing failures. Report unavailable remote/check access rather than assuming success.

## During

1. Implement the selected unit under Guidelines and the accepted release scope. Make routine choices autonomously; never silently resolve a business decision or expand scope.
2. Apply Guidelines' API/client compatibility rule within the selected Plan unit; keep its tests and affected docs together. Verify risky behavior as it changes and fix introduced failures. Never weaken checks or disguise missing verification.
3. Give concise progress/blocker updates. Preserve useful partial work if blocked; leave incomplete Plan items unchecked and record implementation limitations in Documentation or the PR, without creating a handoff file.

## Finish and review

1. Review the complete diff against the base, including new/generated files, migrations and docs. Remove accidental secrets, debug residue and unrelated changes. Run the unit's checks and applicable shared release checks from Plan. Documentation-only work needs link/content/consistency review, not invented application tests.
2. Update only affected owners: Definition (purpose/terms); Requirements (obligations/releases/rules); Design (accepted technical decisions); Guidelines (engineering rules); Documentation (verified behavior/operational limits); Plan (completion/sequence); Workflow (execution/authority); AGENTS/README (routing/working setup commands). Link rather than duplicate.
3. Check only completed, verified Plan items. Record CI/publication-dependent items only after their actual checks succeed; use PR check status for transient CI results. Implementation, verification, merge and deployment are distinct. All child work units and shared obligations must be complete before their parent is complete.
4. Make focused commits, push the feature branch, and open/update a PR using the template. Use a draft for partial work. Inspect CI on the current PR commit and resolve findings before presenting the concrete result for merge approval. If no remote exists, keep the committed local branch reviewable and report that no PR exists.
5. Merge only with user approval and passing applicable checks; squash into `main`. If the user merged, verify that result. Safely remove merged task branches and fast-forward the local base; do not discard other work. Do not silently start the next unit.
6. Deploy only at the relevant release unit with user authorization. Verify the actual deployment and record its result through the normal documentation/PR process; CI success alone is not deployment. Report outcome, actual checks, Git/PR status, remaining blockers and the next unit briefly.

## Standing agent authority

| Action | Policy |
|---|---|
| Relevant reads, edits, local branches/checks/generation, focused commits, feature-branch pushes to the agreed remote, opening/updating PRs | Authorized for requested work; do not repeatedly ask |
| Merging/automatic merge, deployment/publication | User approval required; respect existing approval within its stated scope and surface material changes |
| Unresolved business choices or changes to accepted product scope/stack | Obtain the decision before dependent implementation |
| Remote creation | Confirm owner, name and visibility; check for an existing repository first |
| Paid services, destructive data changes, shared-history rewrites, unmerged-work deletion, relaxed access/protection | Specific authorization required |

Use configured Git author identity; ask if missing. Repository rules cannot bypass tool permissions. Explain actual access/approval blocks and complete unaffected work. Never modify instructions to manufacture permission.

## Git and GitHub

GitHub is the source/PR host; `main` is the base. Use short-lived `<type>/<work-unit>-<description>` branches (e.g. `feat/1.3.1-inventory`) or `docs/<description>` for unnumbered documentation work. Commit prefixes: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`. Stage only reviewed task files. One PR covers one coherent unit or explicit scope; issues are optional because Plan remains the backlog.

Avoid force pushes/shared-history rewrites; resolve conflicts carefully and keep branch-sync merge commits separate from product changes. Use squash merges and safe merged-branch cleanup. Keep `main` usable. The initial Bar Buddy repository starts with one reviewed documentation commit on `main`; subsequent work uses task branches/PRs. This one-time bootstrap does not authorize later history rewrites. Never overwrite existing remote history.

Foundation configures squash merging and, where supported, protected `main`: required PRs, resolved conversations, current passing checks, an up-to-date branch, and no force pushes/deletion. Enable required check names only after real jobs run. For this solo-owner workflow, the user reviews/authorizes merging; do not require a second GitHub account's approval until a separate reviewer is available. Authors cannot approve their own PRs. Verify account-specific [protection availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) and [review restrictions](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews). If enforcement is unavailable, record it and follow the policy manually; do not change visibility or buy an upgrade without approval.

## CI contract

**GitHub Actions**, implemented during foundation once local commands work. Use pinned compatible tooling, committed wrappers/lockfiles and the same commands locally and in CI. README owns exact commands; Documentation records the configured repository, actual check names and enforcement limits.

| Proposed check | Required work |
|---|---|
| `backend-checks` | Selected formatting/static checks, compilation/package, unit tests and PostgreSQL Testcontainers integration; migration checks as migrations arrive |
| `frontend-checks` | Lockfile install, formatting/lint, TypeScript, behavioral tests and production build |
| `api-contract` | Generate OpenAPI in isolated test configuration and regenerate Orval; fail for missing, stale, modified or unexpected untracked generated artifacts |

Run on PRs targeting `main` and pushes to `main`, with manual runs available. Initially run all required jobs for every PR, including docs, avoiding path filters that leave checks absent. Set timeouts, cancel superseded runs appropriately, and use minimum permissions starting with `contents: read`. Tests use disposable/local services without production credentials. Never run untrusted PR code in a privileged `pull_request_target` job. Follow the [workflow reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

Verify real passing and deliberate-failure cases on a temporary task-branch change, remove the deliberate failure, and confirm final checks pass and protection blocks failed checks where supported. No placeholder success jobs. Local success does not verify GitHub CI. Production deployment automation is separate publication work.

## Instruction verification

For routing/workflow changes, check representative requests: product question, “what's next?”, implementation and review. Verify they select necessary context, respect authority, and identify blockers without starting unrequested work. A fresh repository-aware agent check may be used when authorized; previous preparation passed one. Keep verification in the PR/commit evidence, not an application-documentation narrative.

Codex's [AGENTS.md guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md) explains discovery. Other clients may need an explicit instruction to open the entry file; a chat without repository access needs the relevant files supplied.
