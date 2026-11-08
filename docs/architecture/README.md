# Learning Platform architecture documentation

This directory is a technical reference for the Central Admin Portal and the wider Learning Platform. It describes the implementation found in local working trees on **8 November 2026**. It is written for a software engineer who needs to review the architecture, join the project, or extend it safely.

These notes sit beside the shorter repository documents in `docs/*.md`. Where those documents and the source disagree, the discrepancy is recorded here. The older single file `docs/architecture.md` remains the portal’s own summary. This directory is the cross-repository reference.

## How this was verified

| Check | Result |
| --- | --- |
| Admin Portal source | Read on branch `fix/phase-3-5-request-leakage`. `tests/results-hub.test.ts` had an uncommitted local edit. |
| Backend schema | Read from `learning-platform-backend` migrations on branch `chore/publish-tlevel-week7-0.4.47`. The hosted database was not queried. |
| Shared packages and hubs | Read from the sibling checkouts listed in [01 System overview](01_SYSTEM_OVERVIEW.md). |
| Automated tests | Commands are documented. **They were not executed for this exercise**, so this set does not claim that any suite is currently green. |
| Secrets | Environment variable names are listed. Values, publishable keys, service-role keys, tokens and learner records are not. |

A name, function, view or table appears here only when it was found in source or in a migration. Planned behaviour is labelled as planned. A missing workflow is labelled as a gap.

## Reading order

1. [01 System overview](01_SYSTEM_OVERVIEW.md) — repositories, stack, and how the pieces depend on each other.
2. [02 Admin Portal architecture](02_ADMIN_PORTAL_ARCHITECTURE.md) — the staff application: startup, routing, modules, state.
3. [03 Backend integration](03_BACKEND_INTEGRATION.md) — every `admin_api` view and RPC the portal calls.
4. [04 Database architecture](04_DATABASE_ARCHITECTURE.md) — schemas, relationships, functions, and where business rules live.
5. [05 Authentication and security](05_AUTHENTICATION_AND_SECURITY.md) — Auth, roles, Row Level Security, and five access scenarios.
6. [06 Hub integration](06_HUB_INTEGRATION.md) — how a learner submission becomes a row the portal can read.
7. [07 Shared components and tools](07_SHARED_COMPONENTS_AND_TOOLS.md) — Core, Content, UI, Results, and supporting tools.
8. [08 Development and deployment](08_DEVELOPMENT_AND_DEPLOYMENT.md) — local run, migrations, Pages, tests.
9. [09 Engineering decisions](09_ENGINEERING_DECISIONS.md) — trade-offs, with inferred rationale labelled as such.
10. [10 Implementation status and roadmap](10_IMPLEMENTATION_STATUS_AND_ROADMAP.md) — what works, what is partial, what is not built. No dates are invented.
11. [11 End-to-end workflows](11_END_TO_END_WORKFLOWS.md) — call chains for the workflows that exist.
12. [12 Technical reference](12_TECHNICAL_REFERENCE.md) — a lookup table of files, functions, views and commands.

## Terminology used throughout

| Term | Meaning in this platform |
| --- | --- |
| Hub | A learner-facing application for one course or unit. Hubs do not own the database. |
| Central Admin Portal | The staff application in this repository (`learning-platform-admin`). |
| Learner | A person with a `learning.students` row, usually linked to `auth.users`. The portal type name is often `LearnerRecord`; the table is `students`. |
| Staff | A person with a `learning.teachers` row. Authority comes from `platform.staff_roles` and, for group teaching, `learning.teacher_group_access`. |
| Teaching group | `learning.groups`. A class on a course in an academic year. |
| Classroom grouping session | `learning.grouping_sessions`. A temporary join-code exercise from Group Generator. It is not a teaching group. |
| Activity | A curriculum item with a stable key and one or more immutable published versions. |
| Attempt | A stored submission in `learning.attempts`, with child `learning.responses`. |
| Progress | A derived read model (`api.my_activity_progress`, `api.my_hub_activity_progress`, and portal analytics views). There is no progress table. |
| Contract | The `api` schema for hubs and the `admin_api` schema for the portal. Browsers are not meant to query `learning` or `platform`. |

## Repository names

Paths in these documents are relative to the repository being discussed. The repository is named in the sentence when the path is not in this Admin Portal. Local folders inspected:

| Repository | Local path | Remote verified |
| --- | --- | --- |
| learning-platform-admin | this repository | `https://github.com/Acerosa/learning-platform-admin.git` |
| learning-platform-backend | sibling checkout | `https://github.com/Acerosa/learning-platform-backend.git` |
| learning-platform-core | sibling checkout | `https://github.com/Acerosa/learning-platform-core.git` |
| learning-platform-content | sibling checkout | `https://github.com/Acerosa/learning-platform-content.git` |
| learning-platform-ui | sibling checkout | `https://github.com/Acerosa/Acerosa-learning-platform-ui.git` |
| learning-platform-results | sibling checkout | `https://github.com/Acerosa/learning-platform-results.git` |
| learning-platform-reports | sibling checkout | `https://github.com/Acerosa/learning-platform-reports.git` |
| learning-platform-cli | sibling checkout | `https://github.com/Acerosa/learning-platform-cli.git` |
| unit-3-Cyber-Security-Hub | sibling checkout | `git@github.com:Acerosa/unit-3-Cyber-Security-Hub.git` |
| tlevel-software-development-hub | sibling checkout | `https://github.com/Acerosa/tlevel-software-development-hub.git` |
| Emerging-Digital-Technologies-Hub | sibling checkout | `git@github.com:Acerosa/Emerging-Digital-Technologies-Hub.git` |
| unit-14-software-engineering-for-business-hub | sibling checkout | `git@github.com:Acerosa/unit-14-software-engineering-for-business-hub.git` |
| level-3-it-year-1-readiness-hub | sibling checkout | `https://github.com/Acerosa/level-3-it-year-1-readiness-hub.git` |
| classroom-group-generator | sibling checkout | `https://github.com/Acerosa/classroom-group-generator.git` |
| doc-generator | sibling checkout | `https://github.com/Acerosa/doc-generator.git` |

`l2e-exploring-emerging-digital-technologies-hub` is another working tree of `Emerging-Digital-Technologies-Hub`, not a separate product. `tlevel-software-development-api` and `tlevel-software-development-notion-template` are local git repositories with **no GitHub remote** in `.git/config`. The folder `agents` is an unrelated course checkout and is not part of the platform.
