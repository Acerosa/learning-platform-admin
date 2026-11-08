# 10 — Implementation status

Status comes from source that was read on 8 November 2026. “Implemented” means the UI calls a real view or RPC, or the migration defines the object. It does not mean a test run passed. No dates or sprint commitments appear in the repositories that were read, so this file does not invent a schedule.

## Completed, with a caller

| Feature | Evidence |
| --- | --- |
| Demo and live modes | `resolveAdminRuntimeConfig`, `demoAdminService`, `createSupabaseAdminClient` |
| Staff sign-in, magic link, recovery, sign-out | `src/stores/admin-portal.tsx`, `src/components/admin-access-gate.tsx` |
| Platform-admin gate | `sessionFromStaffContext` |
| Dashboard, hub registry, people reads, assignment reads, analytics, system reads | Loaders in `src/services/admin-data-loaders.ts` |
| Hub register and update | `registerHub`, `updateHub` |
| Curriculum drafts, publish, session visibility | Portal methods and `src/views/curriculum-authoring.tsx` |
| Content library search and item mutations | `ContentLibraryPage` `callRpc` list in [02](02_ADMIN_PORTAL_ARCHITECTURE.md) |
| Composition save into a curriculum draft | `src/views/composition.tsx` |
| Markbook and teacher review | `ResultsMarkbookPage`, `review_response` |
| Hub-learning results for L2E, Unit 3, T Level, Unit 14 | `HubLearningResultsPage` and the four RPCs |
| Readiness diagnostic display | `ReadinessDiagnosticPage` and `admin_api.diagnostic_*` |
| Classroom grouping session lifecycle | `GroupGeneratorPage` and grouping RPCs |
| Learner submission, formative checks, drafts, onboarding | `api.submit_attempt` and the Core client. See [06](06_HUB_INTEGRATION.md) |
| Row Level Security and staff view predicates | Migrations cited in [05](05_AUTHENTICATION_AND_SECURITY.md) |

## Partial

| Feature | What works | What does not |
| --- | --- | --- |
| People | Lists learners, groups, staff, enrolments | Add learner, create teaching group, invite staff open `PendingActionDialog` |
| Assignments | Lists `admin_api.assignments` | Create assignment is the same dialog. Notice text says the RPC is not approved |
| System | Health, audit, staff list | “Propose change” is the dialog. Registry `dataState` is `partial` |
| Courses | Same screen as hubs, with a notice | No course editor. `dataState` is `partial` |
| Curriculum authoring | Full local and remote draft flow | Registry `dataState` is still `partial` |
| Activities route | Registered | Empty state. `dataState: "pending"` |
| Staff roles | Stored and shown | Shell only admits `platform_admin`. `curriculum_admin` can call library RPCs and cannot open the UI |
| Hub results vs shell | SQL allows a group teacher | UI never reaches that branch |
| Contract constants | `ADMIN_API_VIEWS` and `ADMIN_API_RPCS` | `recent_attempts` and hub-learning RPCs are missing from the constants. Several listed views and RPCs have no caller |
| Two admin bootstraps | Vinext paths and Pages hashes | Unknown routes 404 in vinext and become the dashboard on Pages. `legacyRedirectTarget` is unused |
| Unit 3 and T Level submission | Core path and a classic `supabase-learning-api.js` path | Classic path skips the Core allow-list. Apps Script remains for some classic Unit 3 pages |
| Content and Core versions | Apps run | CI pins and local `package.json` versions disagree. See [08](08_DEVELOPMENT_AND_DEPLOYMENT.md) |
| Backend README | Points at the right schemas | Under-states marking rules and admin RPCs |
| L3E results source | Explicit unavailable panel | No hub is wired |

## Planned or only documented

| Item | How it is marked in source |
| --- | --- |
| Group-delivery activity catalogue | Copy on `/activities`: reserved for a future catalogue |
| General admin mutations for people, groups, enrolments, assignments, configuration | `ADMIN_MUTATION_STATUS` and the pending dialog. Backend README still says they are unspecified. No portal RPC was found |
| `pendingAdminMutations` service | Methods reject, including register and update, and the UI does not import the module |
| CLI commands other than `lp create hub` | README in `learning-platform-cli` lists them as not implemented |
| Reports as a general learner product | Reports README limits the Pages site to QA and names a pilot hub |
| `canAccess` and per-module capabilities | Function exists. No caller. `docs` that describe capability filtering are ahead of the shell |
| Edge Functions | Directory absent |
| `lp validate`, GitHub automation from the CLI | Named as deferred in the CLI README |

`docs/plans/option-a-post-week-and-publish.md` is a plan file in the portal. It was not treated as a description of the running system. Read it as a proposal.

## Known limitations

- Academic years exist on `learning.academic_years` and as a column of `admin_api.groups`. There is no screen to create a year.
- There is no `units` table. Modules hang off courses. Anyone writing “unit” into a new feature needs to pick `learning.modules` or a hub id, not a new concept, unless a migration adds one.
- Progress has no table. Recomputing it means reading attempts or calling `my_hub_activity_progress`.
- Question text for the readiness diagnostic is not on `admin_api`. The UI shows keys (`src/analytics/diagnostic.ts`).
- Analytics are computed in SQL views at read time and filtered in the browser. There is no export job in the portal beyond what `@learning-platform/results` can build in memory from the loaded snapshot (`exportResults`). Whether every analytics pane calls `exportResults` was not confirmed. The function exists in the library.
- Publication does not create `learning.activity_assignments`. Learners cannot submit until an assignment exists. The portal cannot create that assignment.
- Platform admin sees every group. There is no portal impersonation or group switch that narrows RLS. The view predicate is global.
- Anonymous diagnostic sittings are not tied to `auth.uid()`.
- Trigger functions without a `REVOKE` from `PUBLIC` are a hardening gap ([05](05_AUTHENTICATION_AND_SECURITY.md)).
- Hosted migration history may not match filenames (`learning-platform-backend/docs/migrations.md`). This review did not connect to the hosted database.

## Integration issues

| Issue | Effect |
| --- | --- |
| Several hubs share course key `ocr-level-3-it` | Course-wide queries mix hubs. Hub-learning RPCs use group links. A new report that joins only on course will be wrong. |
| Core pins differ by hub | A submission fix in Core 0.2.27 does not reach the readiness hub on 0.2.5 until that workflow changes. |
| Portal CI does not pin Core | Theme and any future Core import track the default branch. |
| Content 0.1.3 in portal CI, 0.1.4 in hub CI and in the sibling checkout | Authoring and learner render can disagree on a block. |
| Classic and Core submit clients | Same RPC, different payload details (`response_type`, allow-list). |
| `l2e` folder versus `Emerging-Digital-Technologies-Hub` | Two checkouts, two pins, one remote. Easy to document the wrong week set. |
| Stale hub architecture docs | T Level `docs/ARCHITECTURE.md` and Unit 3 `docs/core-integration.md` do not match the Vite entry or the CI refs. |

## Testing gaps

- No Playwright or Cypress suite was found for the portal.
- Content Library and composition RPC success paths have source-contains tests, not behavioural tests against SQL.
- People and assignment pending dialogs are not covered beyond route registration.
- Database pgTAP was not executed, so RLS findings are from reading policy SQL.
- Hub `npm test` was not executed.
- No cross-repository job installs current Core into every hub.

## Security review findings

Carried from [05 Authentication and security](05_AUTHENTICATION_AND_SECURITY.md):

1. Shell role is coarser than RPC roles.
2. Some trigger functions are not revoked from `PUBLIC`.
3. Anonymous diagnostic and grouping have no rate-limit object in the migrations that were read.
4. Pages injects whatever is in `SUPABASE_PUBLISHABLE_KEY`. The dev client’s service-role rejection does not run in that workflow.
5. `claim_initial_platform_admin` remains executable by `authenticated` even though the UI hides it.
6. Backend README describes client-side marks. The function discards them.

## Improvements that follow from the code

These are engineering consequences, not a committed roadmap.

1. Point the pending people, group, enrolment and assignment actions at audited RPCs, or remove the buttons until those functions exist. The dialog is honest. The buttons still look like editors.
2. Add the hub-learning RPC names and `recent_attempts` to the contract constants, and drop or use the unused view names, so `tests/architecture.test.mjs` guards the real surface.
3. Pin Core in the portal workflow to a tag.
4. Align Content to one tag across portal and hubs.
5. Route remaining classic submits through `platform.submission.submit`.
6. `REVOKE ALL` on trigger functions from `PUBLIC`.
7. Decide whether group teachers should open a read-only results shell. The SQL already allows the read. The UI does not.
8. Replace stale sentences in the backend README and in Unit 3 / T Level architecture docs so the next reader does not reintroduce client marks or a framework-free entry point.
9. Record a schema dump comparison against the hosted project before an assessment that depends on production behaviour.

Nothing in this list is scheduled by this document.
