# Modules

Admin Portal Simplification v1 organises the UI into **six primary areas**. Legacy module routes remain reachable for bookmarks and integrations; they map into these areas or retain hidden authoring routes.

Primary navigation (from `src/router/modules.ts`):

| Area | Route | Purpose |
| --- | --- | --- |
| Dashboard | `/` | Platform overview, hub readiness, health, recent attempts |
| Hubs & Curriculum | `/hubs` | Hub registry, course context, curriculum publication state, link to curriculum editor |
| People | `/people` | Learners, groups, staff (platform authority) and enrolment relationships |
| Assignments & Results | `/assessment` | Assignments and the results markbook (attempts drill down from Results) |
| Analytics | `/analytics` | Completion, performance and attention signals |
| System | `/system` | Status, audit, access and advanced configuration |

## Legacy routes (hidden from primary navigation)

These modules remain registered and resolve at their previous URLs:

| Legacy route | Resolves to |
| --- | --- |
| `/courses` | Hub registry (course shown per hub) |
| `/curriculum` | Curriculum editor |
| `/content-library`, `/composition` | Hidden authoring utilities |
| `/activities` | Deferred catalogue placeholder |
| `/learners`, `/teachers`, `/groups`, `/enrolments` | People area tabs |
| `/assignments`, `/results`, `/attempts` | Assignments & Results tabs |
| `/monitoring`, `/certification`, `/configuration`, `/audit` | System tabs |

Backend contracts are unchanged: `admin_api` RPCs, RLS, immutable curriculum publications, audit minimisation and learner-safe reads all remain authoritative.

Curriculum details: [Curriculum authoring](curriculum-authoring.md), [Publication workflow](publication-workflow.md), [Hub registration](hub-registration.md) and [Platform management](platform-management.md).
