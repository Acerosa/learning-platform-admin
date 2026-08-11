# Modules

All modules are registered in `src/router/modules.ts`. Their routes and navigation labels are derived from that registry.

| Module | Foundation behaviour | Backend state |
| --- | --- | --- |
| Dashboard | Hub readiness, contract state, health and attention queue | Partial |
| Hub Registry | Search, filter, view manifest details and prepare lifecycle actions | Read view available; writes pending |
| Courses | Reviewed course and hub associations | Hub-course links available; catalogue view pending |
| Curriculum | LHDS hierarchy, metadata readiness and lifecycle workflow | Admin contract pending |
| Activities | Reviewed manifest counts, evidence/version/lifecycle readiness | Curriculum admin view pending |
| Learners | Synthetic directory preview and privacy boundary | `admin_api.learners` available |
| Teachers | Synthetic staff preview and role boundary | Staff roles available; teacher admin view incomplete |
| Groups | Academic year, course and registration state | `admin_api.groups` available |
| Enrolments | Current/history-ready multi-course view | `admin_api.enrolments` available |
| Assignments | Group/activity/version delivery preview | `admin_api.assignments` available |
| Analytics | Required analytic lenses with honest empty states | Aggregation contract pending |
| Monitoring | Health foundation and required signal coverage | Operational health partial |
| Certification | Hub review matrix and review-history placeholder | Certification model pending |
| Configuration | Platform contracts and role-readiness view | Contracts/staff roles available |
| Audit | Safe filters and empty live-event state | `admin_api.audit_events` available |

The portal remains hub-agnostic. Hub-specific curriculum names appear only as data from the registry and reviewed source artefacts.
