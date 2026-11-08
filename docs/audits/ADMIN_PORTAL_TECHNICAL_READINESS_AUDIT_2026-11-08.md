# Central Admin Portal technical readiness audit

**Date:** 8 November 2026  
**Repository:** `learning-platform-admin`  
**Branch:** `fix/phase-3-5-request-leakage`  
**Commit:** `931f3a8f9d43ac3f3fb3b9d7a1dda36486295333` (21 September 2026, 19:52 +0100)  
**Subject:** `fix: poll Group Generator only while a live session is visible`

This audit checks whether the Admin Portal builds, whether its tests pass, and whether the implementation matches the architecture notes in `docs/architecture/`. Those notes describe source and migrations read earlier the same day. They did not claim that tests pass or that the hosted database matches git. This audit executes the build and the portal test commands. It still does not query a hosted database.

**Verdict: requires targeted improvements.**

The portal is a substantial staff application. Both production builds succeed on Node 22, TypeScript checks pass, and the integration suite passes. It is not ready to hand to an external programme as a green, standalone repository. `npm test` fails, lint fails, GitHub Actions deploys without running either, and `npm ci` in this repository alone cannot install its `file:` dependencies.

No application code, configuration, dependency pins, or database objects were changed. No production deployment was triggered. No SQL was applied to a hosted database.

## 1. Executive summary

| Question | Result |
| --- | --- |
| Does the production build succeed? | Yes, on Node 22.23.2. Both `npm run build` and `npm run build:pages` exited 0. |
| Do automated tests pass? | No. 397 of 399 executed portal tests passed. Two failed. Lint failed with 23 errors. |
| Is the frontend maintainable? | Largely yes, with a single context store, a typed read service, and a module registry. Page-level `callRpc` calls and a dead results panel work against that. |
| Is Supabase integration real? | Yes. Live mode uses `@supabase/supabase-js` 2.112.3, schema `admin_api`, PKCE, and security-invoker views plus RPCs. |
| Do the called contracts match the migrations? | The hub-learning, publication, review, and hub-registration signatures that were compared match. Contract constants omit RPCs the UI already calls. That omission does not break those calls. |
| Is authorisation only a hidden button? | No. `sessionFromStaffContext` requires an active `platform_admin`. Learner and attempt views also require that role in SQL. Some RPCs are wider than the shell. |
| Do administrative creates work? | Learner, teaching-group, enrolment, and assignment creation open `PendingActionDialog` and do not write. Hub registration, publication, review, library, composition, and classroom grouping do call RPCs. |
| Are shared packages consistent? | No. Installed Content is 0.1.4. CI pins `v0.1.3`. CI checks out Core with no tag. |
| Is deployment the vinext worker? | No. `.github/workflows/pages.yml` publishes `dist/pages` from `npm run build:pages`. `worker/index.ts` is not in that workflow. |
| Suitable for an external assessment? | Yes as a codebase to extend, after the red tests, the sibling-package install, and the unimplemented creates are stated or fixed. |

Finding counts in this report: **0 critical, 5 high, 9 medium, 10 low.**

High: **TEST-1** (`npm test` is red), **CI-1** (Pages deploys without tests or lint), **DEP-1** (this repository does not install alone), **DEP-2** (Core is unpinned and Content `v0.1.3` ≠ installed 0.1.4), **FUNC-1** (learner, group, enrolment, and assignment creation do not persist). Medium and low identifiers are FE-1, FE-5, BE-1, BE-2, SE-1, SE-2, SE-3, DEP-3, CI-2, and the low items in the tables below.

## 2. Audit scope

Examined on this machine:

| Repository | Use in this audit |
| --- | --- |
| `learning-platform-admin` | Baseline, builds, tests, lint, typecheck, source review |
| `learning-platform-backend` | Migration inventory (103 SQL files) and the SQL for views and RPCs the portal calls |
| `learning-platform-core` 0.2.23 | `submitAttempt` → `rpc("submit_attempt")` |
| `learning-platform-content` 0.1.4 | Installed via `file:` and used by the failing publication test |
| `learning-platform-ui` 0.1.13 | Present as a sibling. Not a dependency of this repository |
| `learning-platform-results` 0.1.2 | Installed via `file:`. Matches the CI tag `v0.1.2` |
| `unit-3-Cyber-Security-Hub` | `js/core/supabase-learning-api.js` still calls `submit_attempt` |
| `tlevel-software-development-hub` | Same legacy client. Content package version is `0.4.31`, which fails an admin test that expects `0.4.2` |
| `Emerging-Digital-Technologies-Hub` | Named in the brief. Not re-tested in this run. Prior architecture notes still describe its Core submission path |

Not examined at runtime: the hosted Supabase project, GitHub Actions logs, and a browser session against a live portal. There is no `.env` or `.env.local` in the admin repository, so the build embedded demo mode.

## 3. Verification status

| Check | Status |
| --- | --- |
| Git identity, lockfile, workflows, `.env.example` | Inspected |
| `npm run build` | Executed, exit 0 |
| `npm run build:pages` | Executed twice, exit 0. The second run was to scan the Pages bundle after the vinext build replaced `dist/` |
| `npm run typecheck` | Executed, exit 0 |
| `npm run lint` | Executed, exit 1 |
| `node --test tests/*.test.mjs` | Executed. This is the test half of `npm test` |
| `npm run test:authoring` | Executed, exit 1 |
| `npm run test:integration` | Executed, exit 0 |
| `npm test` as one process | Not re-run. Its two build steps had already exited 0, and the same test commands were run separately |
| `npm run test:unit` as its own command | Not run separately. `tests/architecture.test.mjs` and `tests/responsive.test.mjs` passed inside the mjs run |
| `npm run test:accessibility` as its own command | Not run separately. The accessibility cases in `tests/accessibility.test.mjs` passed inside the mjs run. That script also rebuilds |
| Backend `supabase test db` | Not run. Needs Docker and a local database. Not pointed at a hosted project |
| Hosted schema comparison | Blocked. No safe development database was configured, and the hosted project was not contacted |
| Database writes, deploys, dependency upgrades | Not performed |

Working tree before this report, and still present afterwards:

- Modified, and not touched by this audit: `tests/results-hub.test.ts` (+16 lines).
- Untracked, from the earlier architecture exercise: `docs/architecture/`.
- Added by this audit: this file.

`dist/` and `.wrangler/` are gitignored.

### Baseline

| Item | Value |
| --- | --- |
| Package | `learning-platform-admin` 0.2.0, `"type": "module"`, `private: true` |
| Engines | Node `>=22.13.0` |
| Node on `PATH` | v20.17.0, which does **not** satisfy `engines`. npm 11.6.2. `engine-strict` is false, so npm does not refuse this Node |
| Node used for every command below | v22.23.2 from nvm (`~/.nvm/versions/node/v22.23.2`). npm 10.9.8 |
| Package manager | npm. Lockfile `package-lock.json` only |
| `node_modules` | Already present. Not reinstalled and not upgraded |
| UI | React 19.2.6, React DOM 19.2.6 |
| Local server | vinext 1.0.0-beta.2 |
| Pages build | Vite 8.0.13, `vite.pages.config.ts`, base `/learning-platform-admin/` |
| Tests | Node’s built-in `node:test`. TypeScript tests use `--experimental-strip-types`. Accessibility uses `axe-core` and `jsdom`. No Jest, Vitest, Playwright, or Cypress in this repository |
| Lint | ESLint 9.39.4 |
| Types | TypeScript 5.9.3, `tsc --noEmit` |
| Supabase | `@supabase/supabase-js` 2.112.3. No `supabase/config.toml` in this repository |
| Installed platform packages | `@learning-platform/core` 0.2.23, `@learning-platform/content` 0.1.4, `@learning-platform/results` 0.1.2. UI is not installed |
| Env template | `.env.example`: `NEXT_PUBLIC_ADMIN_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GROUP_GENERATOR_URL` |
| Workflow | `.github/workflows/pages.yml` only |

## 4. Build results

### `npm run build:pages`

Command: `npm run build:pages`  
Node: 22.23.2  
Exit code: 0

Vite 8.0.13 transformed 172 modules in about 1.6 seconds. Output:

| File | Size |
| --- | --- |
| `dist/pages/index.html` | 0.64 kB |
| `dist/pages/assets/index-*.css` | 63.18 kB |
| `dist/pages/assets/xlsx-*.js` | 424.76 kB |
| `dist/pages/assets/index-*.js` | 1,025.77 kB |

Warning, not a failure: the main chunk is larger than 500 kB. `xlsx` is a separate chunk. This is the artifact `pages.yml` uploads.

### `npm run build`

Command: `npm run build` (`vinext build`)  
Exit code: 0

Vite client, RSC, and SSR environments all built. Routes reported: `? /` and `ƒ /:module`. Vinext warned that some routes could not be classified because it cannot see dynamic API usage at build time. Output is under `dist/client` and `dist/server`, which `pages.yml` does not upload.

### Secrets in the Pages bundle

A scan of `dist/pages` for JWT-shaped strings, `sb_publishable_` values, `sb_secret_`, `https://*.supabase.co`, and the literal `service_role` found **zero** matches. No `.env.local` was present, so the embedded mode is demo. The bundle contains the name `NEXT_PUBLIC_SUPABASE` as source text, not a credential.

The vinext client bundle contains the Supabase library’s own source, including the word `service_role` inside that library. That is not a project key. No key material was copied into this report.

### What did not fail

No missing dependency, no TypeScript error in the build, and no external service was required. The build does not contact Supabase.

## 5. Automated test results

| Test suite | Command | Result | Passed | Failed | Skipped | Failure |
| --- | --- | --- | --- | --- | --- | --- |
| Pages, routes, architecture, responsive, accessibility | `node --test tests/*.test.mjs` | Fail | 55 | 1 | 0 | `/attempts` HTML no longer matches `/Summary evidence only/` (`tests/routes.test.mjs:101`) |
| Authoring, publication, auth phases, analytics, grouping | `npm run test:authoring` | Fail | 323 | 1 | 0 | `publicationGate` test expected T Level package `0.4.2` and read `0.4.31` |
| Integration (mocked Supabase) | `npm run test:integration` | Pass | 19 | 0 | 0 | — |
| Typecheck | `npm run typecheck` | Pass | — | — | — | `tsc --noEmit` exit 0 |
| Lint | `npm run lint` | Fail | — | 23 errors, 6 warnings | — | Unused symbols, `react-hooks/refs`, `react-hooks/set-state-in-effect`, two unassociated labels |
| Database pgTAP | `supabase test db` in the backend | Blocked | — | — | — | Not run. Would start a local database. Not run against hosting |
| End-to-end browser | none | Not present | — | — | — | No Playwright or Cypress config |

`npm test` is `npm run build && npm run build:pages && node --test tests/*.test.mjs && npm run test:authoring`. The builds succeeded and both test steps failed, so a single `npm test` would fail.

**TEST-1 (high).** The documented aggregate test command is red for the two reasons below. CI does not run it (CI-1).

### Failure 1 — stale attempts assertion

`tests/routes.test.mjs` still expects the attempts page to contain `Summary evidence only` and `SYNTH-0001`. That copy remains in `ResultsPanel` (`src/views/admin-assessment-panels.tsx`). The live route renders `ResultsArea` / the markbook. The rendered HTML observed in the failure includes the markbook summary (attempts, 70.0%, and the L3E option labelled “not available yet”). The test is wrong relative to the current screen. It does not prove the markbook is broken. It does prove `npm test` is red.

`ResultsPanel` has no production importer. `assessment-area.tsx` imports only `AssignmentsPanel` from that file.

### Failure 2 — sibling package version

`tests/publication.test.ts` (`publicationGate accepts T Level package 0.4.2 with nine drag-drop blocks`) reads `../tlevel-software-development-hub/content/tlevel-software-development/package.json`. If that file is missing, the test returns without an assertion, which Node does not count as a skip. On this machine the file exists and `pkg.version` is `0.4.31`. The assertion `0.4.31 !== 0.4.2` fails before `publicationGate` is judged. This test cannot pass against the current T Level checkout, and it would pass vacuously on a machine without that checkout. It is not a Supabase integration test.

### Lint

Exit 1. 23 errors and 6 warnings. Examples:

- `src/stores/admin-portal.tsx` `stateRef.current = state` during render (`react-hooks/refs`).
- `setState` inside effects in `composition.tsx`, `content-library.tsx`, `group-generator.tsx`, and `hub-learning-results.tsx`.
- Unused imports in `composition.tsx`, `composition-engine.ts`, and three test files.
- `jsx-a11y/label-has-associated-control` twice in `group-generator.tsx`.

CI does not run lint. The errors are current source problems, not an environment failure.

### What the passing tests actually cover

Integration tests mock the client. They check argument names for publish, review, register, and update, and they check that a learner context is denied. They do not open a database. Accessibility tests run axe in jsdom, not in a browser. None of the executed tests call the hosted project.

## 6. Frontend architecture findings

The structure is coherent. `AdminPortalProvider` (`src/stores/admin-portal.tsx`) owns session and module cache. `createSupabaseAdminReadService` (`src/services/supabase-admin-service.ts`) is the typed read layer. `src/router/modules.ts` is the route table. Views under `src/views/` render modules. Authoring rules live under `src/content/` and call `@learning-platform/content` rather than reimplementing the schema.

There are two bootstraps: vinext (`app/layout.tsx`) and GitHub Pages (`github-pages/main.tsx`). Unknown paths 404 in vinext and fall through to the dashboard on Pages. `legacyRedirectTarget` is unused, so legacy URLs are not rewritten.

| ID | Severity | Location | Issue | Impact | Improvement |
| --- | --- | --- | --- | --- | --- |
| FE-1 | Medium | `content-library.tsx`, `composition.tsx`, `group-generator.tsx`, `hub-learning-results.tsx` | Pages call `callRpc` with string names instead of the typed methods in `supabase-admin-service.ts` | A renamed SQL argument fails only at runtime. `ADMIN_API_RPCS` can drift, and the architecture test still passes | Add typed wrappers and a test that every `callRpc("` name is in `ADMIN_API_RPCS` |
| FE-2 | Low | `ResultsPanel` in `admin-assessment-panels.tsx` | Exported and unused. Holds the copy the failing route test expects | Dead UI and a false sense that `/attempts` still shows “Summary evidence only” | Delete the panel or point the test at the markbook |
| FE-3 | Low | `canAccess` in `admin-session.ts`; `capability` on each module | Nothing calls `canAccess`. Every platform admin sees every module | Fine while the only granted action is `*`. Misleading if a second role is added later | Enforce capabilities or delete them |
| FE-4 | Low | `admin-portal.tsx` line 387 | Ref written during render. Lint error | Possible stale rendering under React 19’s refs rule | Write the ref in an effect, or restructure the latest-state read |
| FE-5 | Medium | Effects in library, composition, grouping, hub results | `react-hooks/set-state-in-effect` | Extra renders. The grouping effect also omits `session` from its dependency list (lint warning) | Load on event or key the state by hub/session id |
| FE-6 | Low | `group-generator.tsx` | Two labels are not associated with controls | axe in jsdom did not fail the routes that were rendered; lint still fails | Associate the labels |
| FE-7 | Low | Pages bundle | Main chunk about 1.0 MB, plus 425 kB of `xlsx` | Slow first load on GitHub Pages | Split the Excel importer so the dashboard does not download it |

Loading and errors for module reads go through `ModuleDataShell` and `AdminReadError`. Live read failures do not fall back to demo fixtures. Integration test 11 locks that in, and it passed. Hub-learning results keep a local `error` string. Pending creates show a dialog rather than a spinner, because they never start a request.

`stateRef` plus an in-flight `Map` is there to ignore stale module loads. That is a deliberate race guard. It was not runtime-tested against a slow network.

## 7. Backend integration findings

`createSupabaseAdminClient` sets `db.schema` to `admin_api`, `flowType: "pkce"`, `persistSession`, `autoRefreshToken`, and `detectSessionInUrl`. `isBrowserSafeSupabaseKey` rejects keys that are not publishable or anon JWTs. That check runs when the client is constructed. It does not run inside GitHub Actions before the variable is compiled in.

Compared this session against `learning-platform-backend` migrations (103 files, latest `20261106150000_resolve_unbound_catalogue_marking.sql`):

| Call | SQL | Match |
| --- | --- | --- |
| `hubLearningRpcParams` | `list_hub_learning_results(text, text, text, text, integer, integer, text, text, integer default 500)` and `summarise_hub_learning_results` with the same filters and no `p_limit` | Parameter names match. The client omits `p_limit`, which has a default. Both functions are the latest definition; no later migration replaces them |
| Evidence | `list_hub_learning_result_evidence(text, text, uuid)` | Live rows return `assignment_id uuid`. Demo ids such as `demo-assignment-scored` are not sent: `openRow` uses fixtures when `live` is false |
| `register_hub`, `update_hub`, `publish_curriculum`, `review_response` | Service wrappers | Integration tests assert the argument objects. SQL bodies were not re-diffed line by line in this run; the previous architecture pass and these tests agree on the names |
| `current_staff_context` select list | View in `20260811145837_add_phase_2_admin_read_models.sql` | Columns `teacher_id`, `staff_reference`, `display_name`, `active`, `active_roles` exist |
| `hubs` select list including `manifest` | View in `20260811135713_establish_repository_driven_hub_registration.sql` | Those columns exist. The view has **no** `platform_admin` `WHERE` clause |
| `learners` / `groups` / `attempts` | Later view definitions | `WHERE (select platform.current_staff_has_role('platform_admin'))` is present on the definitions read for learners, groups, and attempts |

`ADMIN_API_RPCS` does not name `list_hub_learning_result_filters`, `list_hub_learning_results`, `summarise_hub_learning_results`, or `list_hub_learning_result_evidence`. `ADMIN_API_VIEWS` does not name `recent_attempts`, which `listRecentAttempts` selects. The architecture test “admin API names match the documented backend surface” passed, because it checks the constant, not every call site. **This is a maintainability defect, not a runtime miss.** `callRpc` sends the string the page wrote.

| ID | Severity | Issue |
| --- | --- | --- |
| BE-1 | Medium | Contract constants and the test that guards them do not describe the hub-learning RPCs or `recent_attempts` |
| BE-2 | Medium | `admin_api.hubs` relies on RLS for any staff role (`platform_admin`, `curriculum_admin`, `operations`, `auditor`, `support`). The shell is stricter. A support JWT can read the hub registry through PostgREST. A learner still cannot: they have no staff role |
| BE-3 | Low | Several declared RPCs and views have no caller (`get_library_question_detail`, composition impact RPCs, `set_grouping_session_specialist_role`, library views, `grouping_sessions`). Unused surface, not a broken call |

Empty `dashboard_summary` is treated as access denied in the client. Empty hub-learning results are not. `list_hub_learning_results` **returns no rows** when `staff_can_read_hub_results` is false, rather than raising. The UI can show an empty table to a caller who was not supposed to see that hub. That is a confirmed SQL behaviour (`20260913180000_admin_hub_learning_results.sql`). It is not a confirmed data leak of another hub’s rows.

Writes were not executed. Signature checks are static.

## 8. Database findings

The backend checkout still contains **103** migration files, ordered by timestamped filename, from `20260809000100_create_learning_identity.sql` through `20261106150000_resolve_unbound_catalogue_marking.sql`. `supabase/config.toml` is the local project. `db reset` is documented as local-only. One rollback file exists and is not a migration: `supabase/rollbacks/20260913180000_admin_hub_learning_results.down.sql`.

The migrations are sufficient to recreate the schema in a local Supabase stack (`supabase start` and `supabase db reset`). That was not executed here. Hosted history is documented, in the backend’s own migration notes, as able to diverge from filenames. **Hosted verification is blocked.** This audit does not claim the hosted project matches git.

Observations from the SQL that was opened:

- Learner, group, and attempt admin views are security invoker and require `platform_admin`.
- Hub-learning functions are security definer, `search_path = ''`, granted to `authenticated`, and revoked from `anon`.
- `api.submit_attempt` in `20260923120000_timed_knowledge_report.sql` is security definer, eight arguments, and ignores client marks via `score_submitted_item` (`20260831010000_ignore_client_marks_without_specs.sql`).
- No Edge Functions directory.
- No `units`, `profiles`, or progress table. Progress is a view or function.
- A previous static pass did not find `REVOKE` from `PUBLIC` on some trigger functions (`validate_attempt_integrity` and several `reject_published_*` functions). That remains a **suspected** hardening gap. It was not re-proven by executing those functions.

No migration was applied. No incompatibility was found in the function signatures the portal currently calls.

## 9. Security findings

Confirmed from source and SQL, not from an exploit attempt:

| ID | Severity | Finding |
| --- | --- | --- |
| SE-1 | Medium | The shell requires `platform_admin` (`sessionFromStaffContext`). Library RPCs allow `curriculum_admin` through `library.is_content_author()`. Hub-learning RPCs also allow a teacher of a hub-bound group. Those users are locked out of the UI and are not locked out of PostgREST |
| SE-2 | Medium | Denied hub-learning reads return an empty set, so the client cannot tell “no data” from “not allowed” |
| SE-3 | Medium | `pages.yml` injects `SUPABASE_PUBLISHABLE_KEY` into the static bundle. The publishable-key check does not run in that workflow. A service-role value placed in that variable would ship in JavaScript. The local client would reject it. CI would not |
| SE-4 | Low, suspected | `claim_initial_platform_admin` is granted to `authenticated` and is not on the sign-in screen. It is safe only while the stored bootstrap hash is unused or rotated. Hosted state was not checked |
| SE-5 | Low, suspected | Trigger functions possibly still executable by `PUBLIC`. They are not a supported browser API. Confirm on a local database |
| SE-6 | Low | Anonymous `start_diagnostic` and `join_grouping_session` are granted to `anon` by design. No rate-limit object was seen in the migrations opened for this audit |

What holds:

- No service-role key in the admin env template or in `dist/pages`.
- Learner submission has no student-id argument. Core `submitAttempt` forwards a payload the allow-list is supposed to have already filtered.
- `tests/integration.test.ts` “learner and non-admin staff contexts are denied” passed.
- `tests/architecture.test.mjs` “no email-based role checks” passed inside the mjs run.
- Direct `INSERT` into attempts is not the portal’s path. The portal reviews through `review_response`.

Bypassing the React gate does not bypass the view predicate on `admin_api.learners`, `groups`, or `attempts`. That statement is from the SQL `WHERE` clause, not from a live request.

## 10. Dependency findings

| Package | `package.json` | Installed | CI `pages.yml` |
| --- | --- | --- | --- |
| `@learning-platform/core` | `file:../learning-platform-core` | 0.2.23 | Checkout of `Acerosa/learning-platform-core` with **no `ref`** (default branch) |
| `@learning-platform/content` | `file:../learning-platform-content` | 0.1.4 | Tag `v0.1.3` |
| `@learning-platform/results` | `file:../learning-platform-results` | 0.1.2 | Tag `v0.1.2` |
| `@learning-platform/ui` | not a dependency | sibling 0.1.13, not installed here | not checked out |

| ID | Severity | Issue |
| --- | --- | --- |
| DEP-1 | High | A clone of this repository alone cannot `npm ci`. The lockfile points at sibling directories. CI manufactures that layout by checking out three other repositories. An assessor who opens only `learning-platform-admin` cannot install it |
| DEP-2 | High | Local Content 0.1.4 and CI Content `v0.1.3` are different builds. Core in CI is not pinned, so a push to Core’s default branch changes the next portal deploy without a portal commit |
| DEP-3 | Medium | `tests/publication.test.ts` imports a sibling hub’s live package and asserts version `0.4.2`. That is why authoring tests failed here |

Hub workflows pin Core between `v0.2.5` and `v0.2.27`. Those pins were not re-read in this run; they are recorded in `docs/architecture/01_SYSTEM_OVERVIEW.md` from the same day’s source inspection. They are outside this repository’s CI and they do not change the admin build. They do mean a Core fix is not one release.

Recommended approach, not applied: pin Core, Content, and Results to tags in `pages.yml`; stop using floating default branches; keep a fixture package inside this repository for publication tests; treat `file:` as a local convenience that CI must mirror with the same tags.

## 11. Deployment findings

`pages.yml` triggers on push to `main` and on `workflow_dispatch`. The current branch is not `main`, so this commit does not deploy.

The build job checks out the portal, Core, Content `v0.1.3`, and Results `v0.1.2`, runs `npm ci` and `npm run build:pages`, and uploads `dist/pages`. The deploy job uses `actions/deploy-pages@v5`. The documented URL is `https://acerosa.github.io/learning-platform-admin/`.

| ID | Severity | Issue |
| --- | --- | --- |
| CI-1 | High | The workflow does not run `npm test`, `npm run typecheck`, or `npm run lint`. All three were executed here. Typecheck passed. Test and lint failed. A `main` push would still publish |
| CI-2 | Medium | `worker/index.ts` and `npm run build` are a second runtime. Nothing in `pages.yml` deploys them. Production is the static Pages bundle. Unknown routes differ between the two bootstraps |
| CI-3 | Low | `npm run build:pages` warns on chunk size. The workflow does not fail on that warning |

No deployment was triggered.

## 12. Functional readiness

Status labels follow the brief. “Implemented but not runtime-verified” means the code calls a real view or RPC and the tests that mock that call passed, but this audit did not perform the operation against a database.

| Workflow | Frontend | Backend | Tests | Status |
| --- | --- | --- | --- | --- |
| Staff authentication | `AdminSignIn`, `signInAdminWithPassword`, `sessionFromStaffContext` | Supabase Auth, then `admin_api.current_staff_context` | Integration and auth-phase tests passed (mocked) | Implemented but not runtime-verified |
| Dashboard | `DashboardPage`, `loadDashboardData` | `dashboard_summary`, `hubs`, `operational_health`, `recent_attempts`, `platform_contracts` | Route render test passed in demo | Implemented but not runtime-verified |
| Learner listing | `LearnersPanel`, `listLearners` | `admin_api.learners` with `platform_admin` predicate | Route smoke only | Implemented but not runtime-verified |
| Learner creation | “Add learner” → `openPending` → `PendingActionDialog` | No RPC | None | Not implemented |
| Teaching group management | `GroupsPanel` lists `admin_api.groups`. “Create a group” opens the pending dialog | Read view only. No insert | Route smoke only | Partially implemented |
| Enrolment management | Column on the learners panel from `admin_api.enrolments` | Read view only | Route smoke only | Partially implemented |
| Assignment management | `AssignmentsPanel` lists `admin_api.assignments`. “Create assignment” opens the pending dialog | Read view only | Route smoke only | Partially implemented |
| Hub registration | `RegisterHubDialog`, `registerHub` / `updateHub` | `admin_api.register_hub`, `update_hub` | Integration argument tests passed | Implemented but not runtime-verified |
| Curriculum publication | `CurriculumAuthoringPage`, `publishCurriculum` | `admin_api.publish_curriculum` | Argument and validation-mapping tests passed. The T Level package fixture test failed on version `0.4.31` | Implemented but not runtime-verified |
| Assessment review | Markbook, `reviewResponse` | `admin_api.review_response` | Argument test passed | Implemented but not runtime-verified |
| Learner analytics | `AnalyticsPage` over aggregate views | `assessment_overview`, performance views | Analytics unit tests passed inside `test:authoring`. The route test failed on old attempts copy, not on the analytics assertion that follows it | Implemented but not runtime-verified |
| Classroom grouping | `GroupGeneratorPage` | `admin_api` grouping RPCs into `learning.grouping_*` | Poll and role tests passed inside `test:authoring` | Implemented but not runtime-verified. This does **not** create `learning.groups` |
| `/activities` | `DeferredLearningPage` | None | Route exists | Not implemented. Copy says the route is reserved |
| L3E results | `result-sources.ts` id `l3e`, kind `unavailable` | None | The failed attempts HTML still contained “L3E (not available yet)” | Not implemented, and the empty state is present |

`PendingActionDialog` does not call `fetch`, `.from`, or `.rpc`. Those buttons do not persist anything.

**FUNC-1 (high).** Learner creation, teaching-group creation, enrolment, and assignment creation are visible actions with no backend write. Group Generator is a different, implemented feature and does not insert `learning.groups`.

## 13. Assessment suitability

**A. Complexity.** High. Curriculum publication, a content library, composition, server-side marking, and hub-scoped results are real domain logic, not a tutorial CRUD app.

**B. Frontend.** Demonstrated. Module registry, context store, demo versus live mode, accessible shell tests, and a large view layer. Weakened by page-level RPC strings and a failing route test.

**C. Backend engineering.** An engineer can trace publish, review, and hub results into named SQL functions. They cannot trace “create learner” past a dialog, because that path does not exist.

**D. Database design.** Strong evidence in the backend repository: foreign keys, partial unique indexes, RLS, and immutable published versions. That evidence is not inside `learning-platform-admin`. An assessor restricted to one repository will not see it unless the submission explains the split.

**E. Security.** Real Auth, a role gate, and SQL predicates. Gaps are the wider RPC grants, empty-set denial, and CI’s untested publishable-key variable. No critical exposure was confirmed in the bundle.

**F. Testing.** Broad unit coverage (399 tests executed, 397 passed) and no database or browser end-to-end run. The documented aggregate command fails. CI does not run it.

**G. Development environment.** Another engineer can build this tree on Node 22 with the sibling checkouts already present. The default Node on this machine (20.17.0) is below `engines`. Demo mode needs no secrets. Live mode needs a publishable key and a staff row. This audit did not complete a live sign-in.

**H. Repository independence.** Meaningful UI, authoring rules, and demo fixtures can be edited here. Install, publication against the real schema, new writes, and RLS cannot. New persistent admin operations require `learning-platform-backend`. Shared validation requires `learning-platform-content`.

**I. AI-assisted work that would force a design choice.** Data-fetching (typed service versus `callRpc` in pages). Making `npm test` hermetic. Pinning CI dependencies. Implementing learner and group creation only after an RPC exists, or removing the buttons until it does. Adding the missing names to `ADMIN_API_RPCS` with a guard test. Splitting the `xlsx` chunk. None of these were implemented.

## 14. Recommended development tasks

### 1. Make the documented test command pass

**Description.** Update `tests/routes.test.mjs` so `/attempts` asserts the markbook, not `ResultsPanel`. Replace the T Level `0.4.2` filesystem read with a fixture stored in this repository, or assert `publicationGate` behaviour without pinning a sibling version.

**Repositories.** `learning-platform-admin` only.

**Complexity.** Low.

**Impact.** Restores a green `npm test`. Removes a hidden dependency on another checkout.

**Tests.** `node --test tests/routes.test.mjs` and the one publication test.

**AI task.** Yes. The desired screen is in `ResultsArea`, and the old copy is still in source, so an assistant can “fix” the wrong layer. That is a useful judgement check.

### 2. Run typecheck, lint, and tests before Pages deploy, and pin Core

**Description.** Add those commands to `pages.yml`. Set `ref` on the Core checkout to a tag. Move Content from `v0.1.3` to the same tag hubs and local authoring use, after checking the diff. Do not leave Core on the default branch.

**Repositories.** `learning-platform-admin`. Content and Core tags are chosen from those repositories, not edited here.

**Complexity.** Medium. Lint currently has 23 errors, so the workflow will stay red until those are fixed or scoped.

**Impact.** Stops a red tree from deploying. Makes the GitHub build match a known package set.

**Tests.** The workflow itself, plus `npm run lint` locally.

**AI task.** Yes, especially which lint rules are real defects versus new React Compiler-style rules.

### 3. Decide the fate of the pending create buttons

**Description.** Learner, teaching group, enrolment, assignment, and configuration changes call `openPending` and stop. Either add audited `admin_api` RPCs and call them, or remove the buttons until those RPCs exist. Do not describe Group Generator as teaching-group creation.

**Repositories.** Backend for any new RPC and RLS. Portal for the UI. Cannot be finished entirely in the portal if the goal is a real insert.

**Complexity.** High.

**Impact.** The largest functional gap in the staff product. A wrong RPC would widen `GRANT EXECUTE TO authenticated`.

**Tests.** pgTAP for the new function, plus a portal test that the button calls it and that a non-admin is rejected.

**AI task.** Yes. A portal-only patch that inserts through the service-role key, or that writes `learning.groups` from the browser, would be an unacceptable solution. The review is the point.

### 4. Close the contract-constant gap

**Description.** Add the four hub-learning RPCs and `recent_attempts` to the constants. Add a test that fails when `callRpc("` uses a name outside `ADMIN_API_RPCS`.

**Repositories.** Portal only.

**Complexity.** Low.

**Impact.** Documentation and reviewability. No runtime change if the strings stay the same.

**Tests.** Extend `tests/architecture.test.mjs`.

**AI task.** Yes.

### 5. Associate Group Generator labels and stop writing the session ref during render

**Description.** Fix the two `jsx-a11y` errors and the `stateRef` lint error without changing auth behaviour.

**Repositories.** Portal only.

**Complexity.** Low.

**Impact.** Lint can become a CI gate. Small behavioural risk if the ref timing changes module-load cancellation.

**Tests.** `npm run lint` and `tests/admin-portal-navigation.test.ts`.

**AI task.** Yes.

### 6. Record a local schema check

**Description.** On a disposable `supabase db reset`, run `supabase test db` and compare `admin_api` function signatures to `ADMIN_API_RPCS`. Do not point this at the hosted project until the target is identified.

**Repositories.** `learning-platform-backend`.

**Complexity.** Medium.

**Impact.** Converts “migrations look right” into “a database accepted them”.

**Tests.** The existing pgTAP files.

**AI task.** Poor. The value is running the suite, not generating more SQL.

## 15. Final recommendation

**Requires targeted improvements.**

Evidence:

- Both production builds succeed on the Node version the package asks for.
- Typecheck succeeds. Integration tests (19) succeed.
- `npm test` does not succeed (2 failures). Lint does not succeed (23 errors).
- GitHub Actions would deploy anyway.
- The repository does not install without sibling checkouts.
- Creating a learner, a teaching group, an enrolment, or an assignment does not persist.
- The Pages bundle produced in demo mode contains no Supabase URL, JWT, or publishable key.
- Authorisation for the learner list is enforced in SQL, not only in React. That part is sound.
- The hosted database was not compared with the 103 migrations.

The project is substantial enough for an external software engineering programme. It should not be submitted as a currently green, self-contained application until task 1 is done and the submission states the polyrepo install, the unimplemented creates, and the fact that CI does not run the tests.

## Quality checks

| Check | Result |
| --- | --- |
| Application behaviour changed | No |
| Database writes | None |
| Production deploy | Not triggered |
| Pins and config files | Unchanged |
| Generated output | `dist/` and `.wrangler/` are gitignored |
| Secrets or learner records in this report | None. Demo names in test output were not copied |
| Working tree | This file, plus the pre-existing `tests/results-hub.test.ts` modification and untracked `docs/architecture/` |
| Tests described as passing | Only the commands whose exit code was 0 |
