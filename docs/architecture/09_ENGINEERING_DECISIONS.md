# 09 — Engineering decisions

The explicit decision record is `learning-platform-backend/docs/architecture.md` (“Contract-First Modular Hub Architecture”). Where a reason is only inferred from the code, the paragraph says so.

## 1. Multiple repositories rather than a monorepo

**Current implementation.** One GitHub repository per hub and per shared package. Local installs use `file:`. Production builds pin git tags in each app’s `pages.yml`. There is no workspace file that version-locks all of them together.

**Documented reason.** The backend architecture document calls the layout a polyrepo so that hubs stay leaf applications and packages stay reviewable on their own.

**Advantages.** A hub can ship without rebuilding the portal. Package pull requests do not mix with curriculum HTML. Access to a hub repository can differ from access to the database migrations.

**Disadvantages.** Pins diverge (Core `v0.2.5` through `v0.2.27`). Local `file:` builds are not the CI build. Documentation inside hubs names old tags. A breaking Core change is a coordinated edit of every workflow.

**Maintenance.** Someone has to move each hub’s `ref:` and re-run that hub’s tests. Nothing in CI opens those pull requests.

**Alternative.** A monorepo or a private npm registry with semver ranges would make “what did production build?” a lockfile. Inferred: the project avoided that so each hub’s GitHub Pages workflow stays small. The cost is the pin table in [01 System overview](01_SYSTEM_OVERVIEW.md).

## 2. Supabase rather than a custom backend server

**Current implementation.** Browsers use `@supabase/supabase-js` against PostgREST. Schemas `api` and `admin_api` are the only Data API schemas the apps select. `learning` and `platform` hold the tables. There is no `supabase/functions` directory and no Node HTTP server in the backend package. The backend `package.json` scripts are tests and ops checks.

**Documented reason.** The architecture document says one Supabase project is the authoritative runtime for identity, enrolment, evidence, results and RLS, and that this is not a microservice split.

**Advantages.** One transaction can mark a response, insert an attempt and complete a draft. RLS is in the same place as the data. Hubs do not each run a server.

**Disadvantages.** A migration is immediately global. PostgREST exposes every granted function to anyone who has the publishable key and a JWT that passes the grant (`authenticated` or `anon`). Safety depends on the function body. Rate limiting and WAF rules were not found in the repositories.

**Maintenance.** Operators need the Supabase CLI, Docker, and the hosted release process in `docs/release-process.md`. Application developers do not deploy a backend binary.

**Alternative.** A small API service could hide SQL and attach request logs. Inferred: the project kept SQL as the API so every hub shares one contract without another deployable. The cost is that `GRANT EXECUTE TO authenticated` is a wide door unless the body checks `auth.uid()` and roles.

## 3. PostgreSQL functions rather than frontend business logic

**Current implementation.** `api.submit_attempt` marks, enforces one assignment, and is idempotent on `client_attempt_id`. `publish_curriculum` validates the package. Views derive analytics. The portal and Core still validate before the call (`validatePackage`, `assertSecureSubmission`). Results interprets rows after they are loaded and does not write.

**Documented reason.** The architecture document assigns evidence, progress and analytics to the backend. Client marks are ignored (`20260831010000_ignore_client_marks_without_specs.sql`). The backend README still says the opposite. Trust the function.

**Advantages.** A modified browser cannot award its own score. Two hubs cannot implement two marking rules for the same question. Idempotency survives a double click.

**Disadvantages.** Rules are invisible to a frontend engineer who does not open migrations. Test feedback requires `supabase test db`, which is heavier than a Node unit test. A defect in a definer function is a defect for every hub.

**Maintenance.** Change marking in SQL, add a pgTAP test, and release with the migration process. Do not “fix” a score in the hub.

**Alternative.** Marking in Core would ship only when each hub bumps its pin, which is how a bug fix would roll out slowly. The project chose the opposite for scores: one database, immediate effect.

## 4. Shared authentication rather than a hub-local account system

**Current implementation.** One Supabase Auth project. `learning.students.auth_user_id` and `learning.teachers.auth_user_id` point at `auth.users`. Hub `localStorage` keys include the hub code, so sessions are not copied between hubs. The account can be the same person if they sign in again. Staff and learners are distinguished by which profile row exists, not by the email domain. `tests/architecture.test.mjs` locks that in for the portal.

**Documented reason.** Inferred from `docs/authentication.md`, `docs/permissions.md` and the onboarding migrations: one learner identity can enrol on more than one course (`20260810085132_enable_multi_course_enrolments.sql`).

**Advantages.** Cross-hub reporting can use `student_number`. A person does not get a new primary key per hub.

**Disadvantages.** A compromised learner password is a compromised identity on every hub they join. Session storage is per hub, which avoids accidental cross-hub calls and also forces a second sign-in. Reports implements its own `AuthProvider` instead of Core, so auth UX can diverge.

**Maintenance.** Profile linking stays in `complete_learner_onboarding` and `ensure_learner_auth_link`. Hubs should not insert `learning.students` themselves.

**Alternative.** A hub-local user table would isolate a breach and would make the admin markbook a join across systems. The schema does not do that.

## 5. Static frontend deployment rather than a server-rendered host

**Current implementation.** GitHub Pages serves the portal (`build:pages`) and each hub. The portal’s vinext dev server and `worker/index.ts` are a second runtime. `pages.yml` does not deploy the worker. No Vercel or Netlify config was found.

**Documented reason.** Inferred from `docs/deployment.md`: the staff UI is a client of PostgREST, so a static host is enough. Curriculum text is loaded from `published_curriculum_package`, not from the HTML bundle, for the hubs the backend doc classifies as database-driven.

**Advantages.** Deploys are a `dist` upload. There is no portal server to patch. Teaching-copy publication skips the upload.

**Disadvantages.** `NEXT_PUBLIC_*` values are compiled into the bundle. Changing Supabase URL means a rebuild. There is no server-side session. Authorisation bugs in the static UI are still safe only because Postgres rechecks. Unknown hash routes on Pages show the dashboard, while the vinext app 404s. Those are different products from one source tree.

**Maintenance.** Keep the Pages base path `/learning-platform-admin/` in `vite.pages.config.ts` aligned with the repository name. Auth redirects must land on that path. `applyAdminAuthCallbackLocation` exists because the hash router and PKCE query parameters collide.

**Alternative.** Hosting the vinext worker would allow server rendering. The inspected workflow does not. Treat Pages as the production admin host until a workflow says otherwise.

## 6. Shared UI libraries rather than duplicated components

**Current implementation.** Hubs use `@learning-platform/ui` for React chrome and `@learning-platform/core` for behaviour and for a parallel DOM chrome. The portal uses Core’s theme service and not the UI package. UI reimplements Core’s presentation on purpose (UI `docs/architecture.md`).

**Advantages.** Activity blocks and week access rules are written once for the React hubs. Tokens (`--lp-*`, `theme.css`) are shared.

**Disadvantages.** Two presentation stacks (DOM factories and React) plus copied session-kind enums. Unit 3 and T Level still render classic pages outside UI. A visual fix in UI does not reach those pages or an unpinned hub.

**Maintenance.** Bump the UI tag in each hub workflow. The portal will not pick up learner components, which is correct: staff screens are local under `src/views/` and `src/components/`.

**Alternative.** One design system consumed by the portal and the hubs would unify staff and learner chrome. It would also couple their release trains. The split matches the different jobs.

## 7. Activity versioning and backward compatibility

**Current implementation.** `learning.activities.stable_key` plus `learning.activity_versions.version`. Unique content hash. Triggers reject edits after publication. Attempts store `activity_version_id`. `submit_attempt`’s signature grew from four arguments to eight and the old function was dropped. Hubs send the eight named arguments. Idempotency is `(student_id, client_attempt_id)`.

**Documented reason.** The backend architecture document says historic attempts keep the version used at submission time, and drafts are invisible to learners.

**Advantages.** A republished question does not rewrite last term’s scores. A retried request does not double-count.

**Disadvantages.** Old versions remain in the catalogue until something retires them (`retired_at`). Analytics must group by version (`activity_analytics` orders by `activity_version`). Hubs that hard-code a version, as Unit 3 does for `1.3.0`, need a content release when the published version changes. Database-driven hubs that trust `published_curriculum_package` avoid that only if they submit the version the package returned.

**Maintenance.** Never update a published version row. Insert a new version through publication. Keep `submit_attempt` argument names stable or change every hub in the same release.

## 8. Data consistency across hubs

**Current implementation.** One database. Enrolment uniqueness is per student per group, so two courses can be active together. Hub isolation for assignments and results is `platform.hub_group_links`, not the course link, because several hubs share a course key. The trigger `hub_group_links_course_consistent` checks that the group’s course matches the hub’s linked course.

**Advantages.** One learner row, one attempt table, one markbook.

**Disadvantages.** A mistaken `hub_group_links` row shows another hub’s learners in hub-learning results. A course-level query would be wrong. The portal’s course screen does not edit these links. Link rows are created by hub registration SQL and by seeds. The portal’s `register_hub` / `update_hub` path should be read in `platform.register_hub` before assuming a manifest creates group links. This document confirmed the RPCs exist and did not trace every column the manifest writer inserts.

**Maintenance.** When adding a hub, create the hub, the course link and the group links. Publishing a package does not create `activity_assignments`. Without an assignment, `submit_attempt` raises `ACTIVITY_NOT_ASSIGNED`. That gap is operational, and the portal cannot fill it from the UI yet.

## 9. Centralised reporting

**Current implementation.** Staff reporting is `admin_api` views plus hub-learning RPCs, interpreted by `@learning-platform/results`. Learner reporting inside a hub is `api.my_activity_progress` and `my_hub_activity_progress`. Reports is a separate SPA on the learner function. There is no warehouse and no scheduled aggregate job. Analytics views compute on read.

**Advantages.** The markbook cannot drift from the attempt table. Adding a hub does not require a new database.

**Disadvantages.** Heavy views run inside the request. Paging is client-side in steps of 1000 (`ADMIN_READ_PAGE_SIZE`). A teacher who is not `platform_admin` can call the hub-results RPC and cannot open the portal. The staff UI therefore does not use the finer rule the SQL already has.

**Maintenance.** New metrics belong in a view or in the results package, not in a hub. Hubs should not query `admin_api`.

## 10. Security and least privilege

**Current implementation.** Publishable key in the browser. Service role only in backend ops env vars. RLS on every application table that was found. Writes go through definer functions. The portal rejects a service-role key in local config. Views add `current_staff_has_role('platform_admin')`. Learner submission has no student-id argument.

**Documented reason.** `docs/rls.md` and `docs/permissions.md` describe `auth.uid()` → teacher → `staff_roles` → `admin_api`. The code matches that chain for the shell.

**Advantages.** Stolen HTML cannot insert attempts for someone else. Demo mode cannot be forced by setting a role in `localStorage`.

**Disadvantages.** `GRANT EXECUTE TO authenticated` includes learners, so every definer must check roles. A few trigger functions were not revoked from `PUBLIC`. Anonymous diagnostic and grouping RPCs are intentional and are not least-privilege in the Auth sense. Platform admin is global across groups. The shell cannot express “this teacher, these groups” even though `staff_can_read_hub_results` can.

**Maintenance.** New tables need RLS in the same migration as `CREATE TABLE`. New browser RPCs need a revoke from `anon` unless anonymity is the point, and a role check in the body. New portal screens should assume the view predicate, not the hidden button, is the control.

**Alternative.** A backend-for-frontend with a staff session cookie would move the role check into a server the portal owns. The project would then have two privilege systems. The current one is entirely in Postgres.

## Decision index

| Topic | Primary source |
| --- | --- |
| Polyrepo and schema split | `learning-platform-backend/docs/architecture.md` |
| Staff chain | `docs/permissions.md`, `src/stores/admin-session.ts` |
| Client marks ignored | `20260831010000_ignore_client_marks_without_specs.sql`, `docs/api.md` |
| Multi-course enrolment | `20260810085132_enable_multi_course_enrolments.sql` |
| Hub-scoped results | `20260913180000_admin_hub_learning_results.sql` |
| Pages deploy | `.github/workflows/pages.yml`, `docs/deployment.md` |

Inferred items are the monorepo alternative, the absence of a custom API server as a scaling choice, and the choice to keep the vinext worker out of the Pages workflow. Those inferences are from the lack of the alternative in the repositories, not from a meeting note.
