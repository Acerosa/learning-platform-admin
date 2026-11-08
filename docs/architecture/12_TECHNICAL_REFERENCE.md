# 12 — Technical reference

A lookup for the implementation described in the rest of this directory. Paths are relative to the repository named in the row. Start with [the index](README.md) if you need the narrative.

Inspection date: 8 November 2026. Tests were not executed. The hosted database was not queried.

## Repositories

| Name | Remote | What to open first |
| --- | --- | --- |
| learning-platform-admin | `https://github.com/Acerosa/learning-platform-admin.git` | `src/stores/admin-portal.tsx` |
| learning-platform-backend | `https://github.com/Acerosa/learning-platform-backend.git` | `supabase/migrations/`, `docs/architecture.md` |
| learning-platform-core | `https://github.com/Acerosa/learning-platform-core.git` | `src/advanced.js`, `src/core/api/learner-api.js` |
| learning-platform-content | `https://github.com/Acerosa/learning-platform-content.git` | `src/validate.js` |
| learning-platform-ui | `https://github.com/Acerosa/Acerosa-learning-platform-ui.git` | `src/index.ts` |
| learning-platform-results | `https://github.com/Acerosa/learning-platform-results.git` | `src/index.ts` |
| learning-platform-reports | `https://github.com/Acerosa/learning-platform-reports.git` | `src/api/reporting-api.ts` |
| learning-platform-cli | `https://github.com/Acerosa/learning-platform-cli.git` | `src/commands/create/hub/` |
| unit-3-Cyber-Security-Hub | `git@github.com:Acerosa/unit-3-Cyber-Security-Hub.git` | `src/platform.ts`, `src/pages/ActivityPage.tsx` |
| tlevel-software-development-hub | `https://github.com/Acerosa/tlevel-software-development-hub.git` | `src/platform.ts`, `content/engine/submit.js` |
| Emerging-Digital-Technologies-Hub | `git@github.com:Acerosa/Emerging-Digital-Technologies-Hub.git` | `src/platform.ts`, `content/engine/submit.js` |
| unit-14-software-engineering-for-business-hub | `git@github.com:Acerosa/unit-14-software-engineering-for-business-hub.git` | `src/main.tsx` |
| level-3-it-year-1-readiness-hub | `https://github.com/Acerosa/level-3-it-year-1-readiness-hub.git` | `src/diagnostic/api-client.ts` |
| classroom-group-generator | `https://github.com/Acerosa/classroom-group-generator.git` | `src/main.js` |

No remote in `.git/config`: `tlevel-software-development-api` (legacy Apps Script), `tlevel-software-development-notion-template`. Same remote as Emerging Digital Technologies: folder `l2e-exploring-emerging-digital-technologies-hub`.

## Admin Portal map

| Concern | File | Symbol |
| --- | --- | --- |
| Vinext root | `app/layout.tsx` | `RootLayout` |
| Module route | `app/[module]/page.tsx` | `ModuleRoute`, `notFound` |
| Pages bootstrap | `github-pages/main.tsx` | `readModuleFromHash`, `applyAdminAuthCallbackLocation` |
| Env | `src/services/admin-runtime-config.ts` | `getAdminRuntimeConfig`, `isBrowserSafeSupabaseKey` |
| Supabase client | `src/services/supabase-admin-service.ts` | `createSupabaseAdminClient` |
| Reads | same | `createSupabaseAdminReadService` |
| Writes | same | `registerHub`, `updateHub`, `publishCurriculum`, `setSessionVisibility`, `saveCurriculumDraft`, `reviewResponse` |
| Loaders | `src/services/admin-data-loaders.ts` | `loadDashboardData`, `loadPeopleData`, `loadAnalyticsData`, `loadAssignmentsResultsData`, `loadSystemData`, `loadHubsCurriculumData` |
| State | `src/stores/admin-portal.tsx` | `AdminPortalProvider`, `useAdminPortal`, `callRpc` |
| Role gate | `src/stores/admin-session.ts` | `sessionFromStaffContext` |
| Auth policy | `src/stores/admin-portal-auth.ts` | `shouldBootstrapAdminData` |
| Modules | `src/router/modules.ts` | `ADMIN_MODULES`, `PRIMARY_NAVIGATION_IDS` |
| Shell gate | `src/views/admin-portal-page.tsx` | `AdminPortalFrame` |
| Switch | `src/views/module-content.tsx` | `ModuleContent`, `DashboardPage`, `HubRegistryPage` |
| Contract names | `src/api/admin-api.ts` | `ADMIN_API_VIEWS`, `ADMIN_API_RPCS` |
| People | `src/views/people-area.tsx`, `admin-people-panels.tsx` | `PeopleArea`, `LearnersPanel`, `GroupsPanel`, `StaffPanel` |
| Results | `src/views/results-area.tsx`, `results-markbook.tsx`, `hub-learning-results.tsx` | `ResultsArea`, `ResultsMarkbookPage`, `HubLearningResultsPage` |
| Diagnostics | `src/views/readiness-diagnostic.tsx` | `ReadinessDiagnosticPage` |
| Analytics | `src/views/analytics.tsx` | `AnalyticsPage` |
| Authoring | `src/views/curriculum-authoring.tsx` | `CurriculumAuthoringPage` |
| Library | `src/views/content-library.tsx` | `ContentLibraryPage` |
| Composition | `src/views/composition.tsx` | `CompositionPage` |
| Grouping | `src/views/group-generator.tsx` | `GroupGeneratorPage` |
| Mark interpretation | `src/results/from-admin-snapshot.ts` | `createLearnerProgress` |
| Pages base | `vite.pages.config.ts` | `base: "/learning-platform-admin/"` |
| Deploy | `.github/workflows/pages.yml` | jobs `build`, `deploy` |

## Primary routes

`/` dashboard, `/hubs`, `/people`, `/assessment`, `/analytics`, `/group-generator`, `/system`. Legacy ids are in `LEGACY_MODULE_IDS` inside `src/router/modules.ts`. Hash equivalents on Pages: `#/hubs` and the same ids.

## `admin_api` objects the portal calls

**Views:** `current_staff_context`, `dashboard_summary`, `hubs`, `hub_course_links`, `courses`, `platform_contracts`, `operational_health`, `staff_roles`, `learners`, `groups`, `enrolments`, `assignments`, `attempts`, `recent_attempts`, `responses`, `activity_performance`, `assessment_overview`, `group_performance`, `learner_performance`, `learner_activity_performance`, `activity_analytics`, `question_performance`, `question_group_performance`, `topic_performance`, `skill_performance`, `diagnostic_sessions`, `diagnostic_responses`, `diagnostic_summary`, `audit_events`, `curriculum_publications`, `curriculum_drafts`.

**RPCs:** `register_hub`, `update_hub`, `publish_curriculum`, `set_session_visibility`, `save_curriculum_draft`, `current_curriculum_package`, `get_curriculum_draft`, `discard_curriculum_draft`, `review_response`, library save/search/publish/archive/duplicate, composition template and recipe functions, grouping session functions, `list_hub_learning_result_filters`, `list_hub_learning_results`, `summarise_hub_learning_results`, `list_hub_learning_result_evidence`.

Argument lists: [03 Backend integration](03_BACKEND_INTEGRATION.md) and [02 Admin Portal architecture](02_ADMIN_PORTAL_ARCHITECTURE.md).

**Not called from the UI:** `claim_initial_platform_admin` (service and tests only), `get_library_question_detail`, `save_composition_reference`, `detach_composition_reference`, `composition_update_check`, `composition_impact_analysis`, `set_grouping_session_specialist_role`. Views never passed to `.from()`: the `library_*` views, `composition_references`, `composition_templates`, `curriculum_recipes`, `grouping_sessions`.

## Database objects

| Need | Object | Schema |
| --- | --- | --- |
| Learner | `students` | `learning` |
| Staff | `teachers`, `staff_roles` | `learning`, `platform` |
| Class | `groups`, `academic_years`, `enrolments` | `learning` |
| Course structure | `courses`, `modules`, `topics`, `skills`, `curriculum_weeks` | `learning` |
| Activity | `activities`, `activity_versions`, `questions`, `question_marking` | `learning` |
| Delivery | `activity_assignments`, `activity_delivery` | `learning` |
| Evidence | `attempts`, `responses` | `learning` |
| Draft | `activity_states` | `learning` |
| Practice | `formative_checks` | `learning` |
| Hub | `hubs`, `hub_course_links`, `hub_group_links` | `platform` |
| Published package | `curriculum_publications`, `curriculum_drafts` | `platform` |
| Diagnostic | `diagnostic_sessions`, `diagnostic_responses` | `learning` |
| Classroom codes | `grouping_sessions`, `grouping_teams`, `grouping_participants` | `learning` |
| Progress | `api.my_activity_progress`, `api.my_hub_activity_progress(text)` | view and function, not a table |

Latest `submit_attempt` body: `supabase/migrations/20260923120000_timed_knowledge_report.sql`. Hub results: `20260913180000_admin_hub_learning_results.sql`. Learner view: `20260902100000_synthetic_qa_learner_fixtures.sql`. Identity tables: `20260809000100_create_learning_identity.sql`. RLS: `20260809000400_create_learning_rls.sql` and `20260811090000_create_platform_foundations.sql`.

## Hub call chain

| Step | Symbol | Repository |
| --- | --- | --- |
| Client | `createHubPlatform` | each hub `src/platform.ts` |
| Facade | `createPlatform`, `createLearnerApi` | `learning-platform-core` |
| Finish | `platform.submission.submit` | Core `src/core/submission/submission-service.js` |
| Unit 3 page | `finishActivity`, `submitCatalogueDraft` | `src/pages/ActivityPage.tsx`, `src/catalogue/activity-draft.ts` |
| Classic Unit 3 | `SupabaseLearningApi.submitAttempt` | `js/core/supabase-learning-api.js` |
| T Level foundations | `submitResult` | `js/core/learning-api.js` |
| Content engine | `submitActivityDraft` | hub `content/engine/submit.js` |
| Check | `mark_formative_response` | Core `platform.marking.markBlock` |
| RPC | `api.submit_attempt` | backend |

## Commands

| Where | Command | Notes |
| --- | --- | --- |
| Portal | `npm run dev` | Demo mode if env is absent |
| Portal | `npm run build:pages` | GitHub Pages bundle |
| Portal | `npm run test:unit` | Fast architecture checks |
| Portal | `npm test` | Builds, then node tests. Not run for this document |
| Backend | `supabase start` then `supabase db reset` then `supabase test db` | Local only. Docker |
| Backend | `npm test` | Ops scripts, not pgTAP |
| Hub | `npm test` | Includes security scan, learner-bundle check and Vite build |
| Core / content / results | `npm test` or `npm run check` | Libraries |
| Group generator | `npm test` | `node --test` |

Environment names, without values: `NEXT_PUBLIC_ADMIN_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GROUP_GENERATOR_URL`. Actions variable names: `ADMIN_DATA_MODE`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Backend ops: `SUPABASE_SERVICE_ROLE_KEY` and the `*_TEST_EMAIL` / `*_TEST_PASSWORD` names in that repo’s `.env.example`.

## Deploy references

| App | Workflow | Host |
| --- | --- | --- |
| Portal | `learning-platform-admin/.github/workflows/pages.yml` | `https://acerosa.github.io/learning-platform-admin/` |
| Each hub | `<hub>/.github/workflows/pages.yml` | `https://acerosa.github.io/<repo>/` |
| Backend CI | `learning-platform-backend/.github/workflows/database-tests.yml` | Does not deploy. Release notes: `docs/release-process.md` |
| Group generator | `classroom-group-generator/.github/workflows/pages.yml` | GitHub Pages |

## Status shortcuts

| Looking for | Answer |
| --- | --- |
| Create learner, teaching group, enrolment, assignment in the portal | Not implemented. Pending dialog |
| Create classroom join-code session | Implemented. Group Generator |
| Submit an activity | Implemented. `api.submit_attempt` |
| See that submission in the portal | Implemented. `admin_api` views and hub-learning RPCs |
| Hub calls the portal | No |
| Edge Functions | No directory |
| Progress table | No. Views and functions |
| Units table | No. `learning.modules` |

Full narrative: [10 Implementation status](10_IMPLEMENTATION_STATUS_AND_ROADMAP.md).
