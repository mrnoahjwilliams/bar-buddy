# Agent entry point

Build Bar Buddy from repository context. These standing instructions apply in fresh chats as well as ongoing work. Read selectively; do not load every document for every task or ask the user to repeat recorded decisions or authorization.

## Route the request

| Request | Read |
|---|---|
| Understand the product | [Definition](docs/01-definition.md); relevant [Requirements](docs/02-requirements.md) |
| “What did you implement?” / explain a change | [Documentation](docs/05-documentation.md), relevant Git/PR diff and affected code; distinguish implemented behavior from plans |
| “What's next?” / progress | [Documentation](docs/05-documentation.md), the first incomplete work unit in [Plan](docs/06-plan.md), and Git/PR state |
| Implement / fix / start / continue | Plan units included in the selected scope; relevant Requirements and [Design](docs/03-design.md) sections; [Guidelines](docs/04-development-guidelines.md); [Workflow](docs/07-development-workflow.md); affected code/tests |
| Review | Changed code/docs, applicable requirements/design, Guidelines, and the review rules below |
| Setup, commands, Git, CI, or permissions | [README](README.md), [Local development](docs/08-local-development.md), Workflow, and relevant foundation Plan units |
| Edit a document | That document and its affected references; use the ownership map below |

Use headings/search to load relevant sections, expanding for dependencies or conflicts. For unfamiliar implementation work, also read Definition and Requirements sections Domain rules, Security and integration, and Quality and platform. Within a session, reuse context and reread changed or relevant sections. Inspect applicable nested instructions before editing. The intended application roots are `backend/` and `frontend/`; do not assume they exist.

## Document ownership

Definition owns purpose, terminology, and scope boundaries. Requirements owns product obligations, business rules, and release assignments. Design owns architecture, stack, domain relationships, and API shape. Guidelines owns engineering conventions. Documentation records implemented behavior. Plan owns work order, decision gates, and completion. Workflow owns execution, Git/CI, and agent authority. README owns the project overview, quick start, and development status. Local development owns detailed environment, service, authentication, generation, and verification instructions.

Link to the owning document instead of copying its content. Resolve contradictions explicitly. Current user instructions take precedence over repository guidance, subject to higher-priority agent instructions.

## Act on the request

- Inspect the relevant files and Git state; preserve unrelated changes. Planned behavior is not implementation evidence.
- “What's next?” requests guidance, not edits. Identify the first incomplete executable Plan unit, its outcome, and any blocking decision.
- “Start development” and “Continue development” authorize one coherent PR scope under Workflow, starting from the earliest incomplete work. Choose and announce its outcome, included units and stopping point; related units and multiple commits may share a PR. Follow an explicitly requested scope instead when provided.
- Verify prerequisites outside the selected PR scope are merged into the base. Included units may depend on verified earlier work on the same branch. If a separate prerequisite PR is pending, report that state instead of rebuilding or skipping it.
- Make routine choices within accepted design. Ask only for unresolved decisions affecting the current task, complete independent authorized work, and record answers before dependent implementation.
- Follow Workflow's standing authority: commits, feature-branch pushes, and PRs are allowed for requested work; merges and deployments need user approval.
- “Merge” explicitly authorizes squash-merging the current unambiguous PR, updating local `main`, and deleting that PR's development branch locally and on `origin` after verifying it is merged and contains no subsequent work. No separate cleanup approval is needed; follow [Workflow's standing merge authorization](docs/07-development-workflow.md#standing-merge-authorization), including when requesting tool approval. Ask which PR only when the target is unclear. Stop after the merge and cleanup.
- Report changes, actual verification, Git/PR status, blockers, and the concrete next user instruction briefly. Follow [Workflow's CI handoff rule](docs/07-development-workflow.md#finish-and-review) instead of keeping a turn active only to poll; never invent passing checks or update completion based only on intent.

## Code Review Rules

Flag incorrect behavior, missing ownership checks, private-data exposure, unsafe migrations/transactions, duplicated generated clients, and missing required verification. Give actionable locations and consequences. Apply the current release's scope; leave formatting to configured checks.
