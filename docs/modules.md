# Modules

All modules are registered in `src/router/modules.ts`. Their routes and navigation labels are derived from that registry.

| Module | Foundation behaviour | Backend state |
| --- | --- | --- |
| Dashboard | Backend counts, recent attempts, contracts and health | Live read available |
| Hub Registry | Search, filter, inspect, register, edit, enable/disable, publication status and health | Live read available; `admin_api.register_hub` and `admin_api.update_hub` |
| Courses | Course catalogue and hub associations | Live `admin_api.courses` read; catalogue mutation pending |
| Curriculum authoring | Open published content as a draft, validate, approve and publish | Local records plus hosted `save_curriculum_draft`, `get_curriculum_draft` and `publish_curriculum` |
| Activity catalogue | Hidden from navigation until a group-delivery catalogue contract exists | Route retained; not the teaching editor |
| Content Library | Reusable questions, activities, templates, resources | Live `admin_api.search_library` and library RPCs |
| Composition | Assemble library assets into a standard curriculum draft | Live composition RPCs; publication remains in Curriculum authoring |
| Learners | Minimised directory and group/enrolment summaries | Live read available |
| Teachers | Active platform role records and authority boundary | Live role read; full directory deferred |
| Groups | Academic year, course, registration and learner count | Live read available |
| Enrolments | Current and historical multi-course relationships | Live read available |
| Assignments | Group/activity/version and availability context | Live read available |
| Results | Group, learner, activity, attempt, evidence, review, feedback, markbook | Live reads + `@learning-platform/results` |
| Attempts | Summary scores, status, marking/evidence metadata and timestamps | Live read; general list still excludes payloads |
| Analytics | Assessment overview, group/learner/activity/question/topic-skill analytics, readiness and Needs attention signals | Live aggregate available |
| Monitoring | Safe public status messages and timestamps | Live read; external ingestion deferred |
| Certification | Hub review matrix and review-history placeholder | Certification model pending |
| Configuration | Versioned platform contracts | Live read available |
| Audit | Safe filters and minimised event fields | Live read available |

The portal remains hub-agnostic. Hub-specific curriculum names appear only as data from the registry and reviewed source artefacts. Curriculum authoring loads a canonical package and renders editors from object type; it does not special-case a hub id. Details: [Curriculum authoring](curriculum-authoring.md), [Publication workflow](publication-workflow.md), [Hub registration](hub-registration.md) and [Platform management](platform-management.md).
