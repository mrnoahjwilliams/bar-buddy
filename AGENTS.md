# Agent entry point

Build Bar Buddy from repository context. Read selectively; do not load every document for every task or ask the user to repeat recorded decisions.

## Route the request

| Request | Read |
|---|---|
| Understand the product | [Definition](docs/01-definition.md); relevant [Requirements](docs/02-requirements.md) |
| “What's next?” / progress | [Documentation](docs/05-documentation.md), the first incomplete work unit in [Plan](docs/06-plan.md), and Git/PR state |
| Implement / fix / continue | Selected Plan unit; relevant Requirements and [Design](docs/03-design.md) sections; [Guidelines](docs/04-development-guidelines.md); [Workflow](docs/07-development-workflow.md); affected code/tests |
| Review | Changed code/docs, applicable requirements/design, Guidelines, and the review rules below |
| Setup, commands, Git, CI, or permissions | [README](README.md), Workflow, and relevant foundation Plan units |
| Edit a document | That document and its affected references; use the ownership map below |

Use headings/search to load relevant sections, expanding for dependencies or conflicts. For unfamiliar implementation work, also read Definition and Requirements sections Domain rules, Security and integration, and Quality and platform. Within a session, reuse context and reread changed or relevant sections. Inspect applicable nested instructions before editing. The intended application roots are `backend/` and `frontend/`; do not assume they exist.

## Document ownership

Definition owns purpose, terminology, and scope boundaries. Requirements owns product obligations, business rules, and release assignments. Design owns architecture, stack, domain relationships, and API shape. Guidelines owns engineering conventions. Documentation records implemented behavior. Plan owns work order, decision gates, and completion. Workflow owns execution, Git/CI, and agent authority. README owns verified setup commands.

Link to the owning document instead of copying its content. Resolve contradictions explicitly. Current user instructions take precedence over repository guidance, subject to higher-priority agent instructions.

## Act on the request

- Inspect the relevant files and Git state; preserve unrelated changes. Planned behavior is not implementation evidence.
- “What's next?” requests guidance, not edits. Identify the first incomplete executable Plan unit, its outcome, and any blocking decision.
- “Continue development” authorizes that unit under Workflow. Default to one smallest numbered work unit; do not silently start another. Follow an explicitly requested scope instead when provided.
- Before dependent work, verify the preceding work is merged into the base. If its PR is pending, report that state instead of rebuilding or skipping it. The user normally merges before returning.
- Make routine choices within accepted design. Ask only for unresolved decisions affecting the current task, complete independent authorized work, and record answers before dependent implementation.
- Follow Workflow's standing authority: commits, feature-branch pushes, and PRs are allowed for requested work; merges and deployments need user approval.
- Report changes, actual verification, Git/PR status, and blockers briefly. Never invent passing checks or update completion based only on intent.

## Code Review Rules

Flag incorrect behavior, missing ownership checks, private-data exposure, unsafe migrations/transactions, duplicated generated clients, and missing required verification. Give actionable locations and consequences. Apply the current release's scope; leave formatting to configured checks.
