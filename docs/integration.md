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

The documented administrative boundary is `admin_api` version 0.1.0.

| Portal service | Backend view |
| --- | --- |
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

All views rely on backend RLS. The portal must use an authenticated staff session and the public browser credential only. A service-role key must never be placed in this application.

## Live client integration sequence

1. Add an environment-driven Supabase URL and public browser credential.
2. Reuse the platform authentication/session component when a staff-ready contract exists.
3. Create an `AdminReadService` adapter that selects only from documented `admin_api` views.
4. Map backend errors to stable administrative error categories.
5. Retain the explicit demo/live data-source state.
6. Add hosted API and RLS integration tests before enabling a live mode.

## Pending backend dependencies

- Staff authentication/account surface suitable for the admin portal.
- Narrow mutation RPCs for hubs, groups, enrolments, assignments, curriculum lifecycle and staff roles.
- Course and curriculum administration read models.
- Teacher administration read model.
- Aggregated administrative analytics views.
- Certification and review-history model.
- External monitoring/event ingestion and deployment-status contracts.
