# Modules

All modules are registered in `src/router/modules.ts`. Their routes and navigation labels are derived from that registry.

| Module | Foundation behaviour | Backend state |
| --- | --- | --- |
| Dashboard | Backend counts, recent attempts, contracts and health | Live read available |
| Hub Registry | Search, filter, inspect metadata/contracts/course links and prepare lifecycle actions | Live read available; writes pending |
| Courses | Authoritative hub/course associations | Live links available; catalogue mutation pending |
| Curriculum | LHDS hierarchy, metadata readiness and lifecycle workflow | Admin contract pending |
| Activities | Reviewed manifest counts, evidence/version/lifecycle readiness | Curriculum admin view pending |
| Learners | Minimised directory and group/enrolment summaries | Live read available |
| Teachers | Active platform role records and authority boundary | Live role read; full directory deferred |
| Groups | Academic year, course, registration and learner count | Live read available |
| Enrolments | Current and historical multi-course relationships | Live read available |
| Assignments | Group/activity/version and availability context | Live read available |
| Attempts | Summary scores, status, marking/evidence metadata and timestamps | Live read; response payloads excluded |
| Analytics | Backend-derived activity/group performance | Live aggregate available |
| Monitoring | Safe public status messages and timestamps | Live read; external ingestion deferred |
| Certification | Hub review matrix and review-history placeholder | Certification model pending |
| Configuration | Versioned platform contracts | Live read available |
| Audit | Safe filters and minimised event fields | Live read available |

The portal remains hub-agnostic. Hub-specific curriculum names appear only as data from the registry and reviewed source artefacts.
