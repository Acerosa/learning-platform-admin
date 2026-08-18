# Integration

## learning-platform-core

The portal depends on the sibling `@learning-platform/core` package through a local package reference during foundation development.

It consumes:

- shared semantic tokens;
- light/dark theme CSS;
- `createThemeService()` for persisted system/light/dark behaviour;
- `applyBranding()` for administration-specific platform colours.

## learning-platform-results

The Results module maps `admin_api` rows through `@learning-platform/results`.
Admin does not reimplement scoring, progress, diagnostics or markbook maths.

Data flow:

```text
admin_api.attempts + admin_api.responses
        │
        ▼
@learning-platform/results
        │
        ▼
Admin Results / Markbook presentation
```

## Markbook workflow

Staff open Results, choose a group, inspect learners and activities, open an
attempt, then view evidence, automatic feedback and the requires-review queue.
Editing and exports are out of scope.

## learning-platform-backend

The documented administrative boundary is `admin_api` version 0.2.0.

| Portal service | Backend contract |
| --- | --- |
| Current staff authority | `admin_api.current_staff_context` |
| Hubs | `admin_api.hubs` |
| Hub/course associations | `admin_api.hub_course_links` |
| Courses | `admin_api.courses` |
| Contracts | `admin_api.platform_contracts` |
| Staff roles | `admin_api.staff_roles` |
| Audit | `admin_api.audit_events` |
| Health | `admin_api.operational_health` |
| Learners | `admin_api.learners` |
| Groups | `admin_api.groups` |
| Enrolments | `admin_api.enrolments` |
| Assignments | `admin_api.assignments` |
| Attempts | `admin_api.attempts` |
| Responses | `admin_api.responses` |
| Dashboard counts | `admin_api.dashboard_summary` |
| Activity analytics | `admin_api.activity_performance` |
| Assessment overview | `admin_api.assessment_overview` |
| Group performance | `admin_api.group_performance` |
| Learner performance | `admin_api.learner_performance` |
| Activity analytics (assignment-level) | `admin_api.activity_analytics` |
| Question performance | `admin_api.question_performance` |
| Topic performance | `admin_api.topic_performance` |
| Skill performance | `admin_api.skill_performance` |
| Curriculum publications | `admin_api.curriculum_publications` |
| Hub registration | `admin_api.register_hub` |
| Hub update | `admin_api.update_hub` |
| Curriculum publication | `admin_api.publish_curriculum` |
| Teacher review | `admin_api.review_response` |

Assessment analytics views expose summary counts and percentages only. They do
not return response payloads or answer keys. “Needs attention” signals are
interpreted in `@learning-platform/results` from those aggregates and are never
clinical/predictive risk scores.

All views rely on backend RLS. The portal must use an authenticated staff session and the public browser credential only. A service-role key must never be placed in this application.

## Live client integration

The environment contract is:

```text
NEXT_PUBLIC_ADMIN_DATA_MODE=demo|live
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The local legacy anon key is also browser-safe. Live mode rejects missing or
non-public keys. It restores the Auth session, reads current staff context,
checks the active backend role, and loads all MVP views through the extended
`AdminReadService`. Errors become safe access-denied or unavailable states;
raw backend errors are not rendered.

For local demonstration, reset/start the sibling backend, use its reported URL
and publishable key, then request an email sign-in link for
`platform.admin@local.invalid` and open it in local Mailpit. Hosted Auth must
separately allow the deployed portal callback URL before live deployment.

## Pending backend dependencies

- Narrow mutation RPCs for groups, enrolments, assignments and staff roles.
- Course catalogue administration.
- Teacher administration read model.
- Certification and review-history model.
- External monitoring/event ingestion and deployment-status contracts.
- Learner-hub consumption of published curriculum metadata.

## Canonical curriculum authoring

Admin authors canonical `lp.content.*` objects locally. Validation, block registry, Excel sheet names and preview rendering come from `@learning-platform/content` 0.1.0. Drafts remain browser storage. After local Publish, **Publish to Platform** calls `admin_api.publish_curriculum`.

See [Curriculum authoring](curriculum-authoring.md), [Publication workflow](publication-workflow.md) and [Backend publication](backend-publication.md).
