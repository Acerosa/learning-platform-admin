# Integration

## learning-platform-core

The portal depends on the sibling `@learning-platform/core` package through a local package reference during foundation development.

It consumes:

- shared semantic tokens;
- light/dark theme CSS;
- `createThemeService()` for persisted system/light/dark behaviour;
- `applyBranding()` for administration-specific platform colours.

It deliberately does not reuse learner header, learner account, learner onboarding, learner progress or learner activity components. Those surfaces belong in learner hubs.

## learning-platform-backend

The documented administrative boundary is `admin_api` version 0.2.0.

| Portal service | Backend view |
| --- | --- |
| Current staff authority | `admin_api.current_staff_context` |
| Hubs | `admin_api.hubs` |
| Hub/course associations | `admin_api.hub_course_links` |
| Contracts | `admin_api.platform_contracts` |
| Staff roles | `admin_api.staff_roles` |
| Audit | `admin_api.audit_events` |
| Health | `admin_api.operational_health` |
| Learners | `admin_api.learners` |
| Groups | `admin_api.groups` |
| Enrolments | `admin_api.enrolments` |
| Assignments | `admin_api.assignments` |
| Attempts | `admin_api.attempts` |
| Dashboard counts | `admin_api.dashboard_summary` |
| Activity analytics | `admin_api.activity_performance` |

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

- Narrow mutation RPCs for hubs, groups, enrolments, assignments, curriculum lifecycle and staff roles.
- Course and curriculum administration read models.
- Teacher administration read model.
- Certification and review-history model.
- External monitoring/event ingestion and deployment-status contracts.

## Canonical curriculum authoring

Admin authors the Unit 14 `lp.content.*` model locally. Validation, block registry, Excel sheet names and preview rendering come from the vendored engine in `vendor/learning-platform-content/0.1.0/`. Drafts are browser storage. No curriculum mutation RPCs were added in this phase.

See [Curriculum authoring](curriculum-authoring.md).
