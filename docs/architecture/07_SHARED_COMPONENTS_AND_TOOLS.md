# 07 — Shared components and tools

Shared behaviour is split across four libraries and a handful of tools. Applications install libraries with `file:../…` and pin a git tag in GitHub Actions. Nothing in the inspected `package.json` files uses the public npm registry for these packages. Core’s README says the package is not published to npm.

## `@learning-platform/core`

| | |
| --- | --- |
| Path | `learning-platform-core` |
| Version in the checkout | 0.2.23 on branch `release/0.2.23-identity-storm` |
| Remote | `https://github.com/Acerosa/learning-platform-core.git` |
| Kind | Library. No runtime dependencies. Optional peer `@supabase/supabase-js` 2.112.3 |
| Builds | `dist/learning-platform-core.esm.js`, plus `curriculum-runtime`, `advanced`, `conformance`, `hub-security` |

Stable exports from `src/index.js` include `createPlatform`, curriculum-runtime helpers, navigation contracts, evidence builders, `canonicalActivityVersion`, `resolveActivityVersion`, theme, DOM factories (`createHubShell`, `createWeekView`, `createLearnerHeader`) and `runConformanceChecks`.

`src/advanced.js` is explicitly unstable. It exports `createSupabaseClient`, `createLearnerApi`, `createAuthService`, and the session, onboarding, profile, enrolment, assignment, hub-access, progress, activity-state, submission and formative-marking factories. Hubs import this entry from `src/platform.ts`. The Admin Portal does not. It uses `createThemeService` only (`src/theme/use-platform-theme.ts`).

The learner client is the security boundary in the browser. `createLearnerApi` accepts schema `"api"` only. `assertSecureSubmission` allows `activityKey`, `activityVersion`, `clientAttemptId`, `responses`, `sourcePage`, `startedAt`, `completedAt`, `programmingLanguage`. The baseline version string is `"1.0"` in `src/core/security/hub-security-baseline.js`. Hubs run `node ./node_modules/@learning-platform/core/dist/hub-security.mjs`.

Evidence types in `src/core/evidence/evidence.js` cover single-choice, multi-select, matching, ordering, written, reflection, coding and classification. UI contracts in `src/ui/contracts.js` define context types, session kinds and learner activity states.

Tests: `npm test` is `node --test`. `npm run check` is syntax, build and test. Workflow: `.github/workflows/quality.yml`. Not executed here.

The checkout README still describes 0.2.0. `package.json` is 0.2.23. Hub workflows pin tags from `v0.2.5` to `v0.2.27`, so this checkout is not the Unit 3 production pin.

## `@learning-platform/content`

| | |
| --- | --- |
| Version in the checkout | 0.1.4 |
| Remote | `https://github.com/Acerosa/learning-platform-content.git` (a second remote named `mercor` also exists) |
| Kind | Library. No dependencies. CommonJS package with an ESM build |

Exports include `validateDocument`, `validatePackage`, `validateLearnerSafePackage`, `renderActivity`, `renderWeek`, `renderSession`, `importJson`, `importExcel`, `sanitiseContent`, `stripLearnerAnswerKeys`, `learnerSafePackage`, `assertLearnerSafePackage`, `BlockRegistry`, `supportedSchemas`. Schemas live in `schemas/` and use ids such as `lp.content.package` and `lp.content.activity`. Schema version and package version are independent (`docs/versioning.md`). The schema version found in the package docs is `0.1.0` while the package is `0.1.4`.

`sanitiseContent` rejects script tags, event handlers and `javascript:` URLs. `stripLearnerAnswerKeys` is the browser-side counterpart of the database helper `strip_learner_answer_keys`. Hubs run `scripts/check-learner-bundle.js` so a production bundle does not contain answer keys.

The block registry includes markdown, heading, callout, single-choice, classification, drag-drop, short-response, reflection, code-editor and python-exercise. Several question types are registered with `implemented: false` (multiple-choice, matching, ordering, fill-gap, long-response). Those names exist in the registry. They are not finished renderers.

The Admin Portal depends on this package for authoring validation. Hubs depend on it for render and learner-safe checks. The package does not call Supabase. Publication remains `admin_api.publish_curriculum`.

No GitHub workflow was found in this checkout. Tests: `npm test` builds then `node --test tests/*.test.js`.

The portal README says Content 0.1.3. Portal CI checks out tag `v0.1.3`. This sibling checkout is 0.1.4. Local `npm run dev` in the portal therefore validates with a newer content package than Pages does, until the workflow ref changes.

## `@learning-platform/ui`

| | |
| --- | --- |
| Checkout | 0.1.13 on branch `fix/activity-state-identity-storm` |
| Remote | `https://github.com/Acerosa/Acerosa-learning-platform-ui.git` |
| npm name | `@learning-platform/ui` |
| Peers | Core `^0.2.4`, React 19 |

Public components (`src/index.ts`) include `HubShell`, `WeekView`, `LearnerHeader`, `ActivityCard`, `WeekAccessGuard`, `AuthoredHtml`, and catalogue blocks (`OptionCards`, `Classification`, `DragDrop`, `Sequence`, `PhraseCompletion`, `TextResponse`). `createMarkResponseHandler` and `learnerSafeBlock` are the Check path hubs use. The package does not own Auth or Supabase. `WeekAccessGuard` uses Core curriculum-runtime rules.

The UI docs say the React components reimplement Core presentation rather than wrapping the DOM factories. Session-kind lists therefore exist in Core `src/ui/contracts.js`, UI `src/contracts.ts` and Content `src/constants.js`. That duplication is deliberate and will drift if one list changes alone.

Hub CI pins `v0.1.15`, which is ahead of this checkout. The quality workflow checks out Core at `v0.2.4`. Tests use Vitest (`npm test`). Not executed here.

The Admin Portal does not depend on this package.

## `@learning-platform/results`

| | |
| --- | --- |
| Version | 0.1.2. The changelog in the checkout still discusses 0.1.2 as unreleased while `package.json` is already 0.1.2. Confirm the tag `v0.1.2` before treating CI as that commit. |
| Remote | `https://github.com/Acerosa/learning-platform-results.git` |
| Kind | Library with no runtime dependencies and no Supabase client |

Factories in `src/index.ts` cover evidence, `interpretAttempt`, `reviewState`, `validateReviewDecision`, `buildReviewQueue`, `calculateCompletion`, `createLearnerProgress`, `buildDiagnostics`, feedback, `buildMarkbook`, `exportResults`, and analytics helpers including intervention signals. Errors use `ResultsError`.

Consumers: Admin Portal (`src/results/from-admin-snapshot.ts`, `src/views/results-markbook.tsx`) and Reports (`src/report/results-alignment.ts`). Hubs do not depend on it. Core builds the submission payload. Results interprets stored marks. Those are different jobs. Evidence helper names exist in both packages (`singleChoice` in Core, `createSingleChoiceEvidence` in Results).

Tests: `node --import tsx --test tests/*.test.ts`. They do not need a database. Not executed here.

## `@learning-platform/cli`

Version 0.1.0. Binary `lp`. Implemented command: `lp create hub` (`src/commands/create/hub/`). It writes a Vite + React hub, a hub manifest, and `file:` dependencies. Profiles: `minimal`, `week-based`, `task-based`. It does not register the hub in Supabase and it does not publish a curriculum.

Documented and not implemented: `lp create week`, `lp create activity`, `lp validate hub`, `lp validate content`, `lp github create`, `lp github protect`. Baselines in `src/shared/baselines.ts` are older than current packages and include the shared project URL and a publishable key. The key is not copied into this document.

Quality workflow only. Tests under `test/create-hub/`.

## What the split removes, and what is still copied

Removed from each new React hub, when it uses the packages as Unit 14 and Emerging Digital Technologies do:

- Auth, onboarding and the `api` client (Core).
- Activity renderers (UI and Content).
- Mark interpretation (Results, on the staff and reports side).

Still duplicated:

| Copy | Where |
| --- | --- |
| Second `submit_attempt` client | `unit-3-Cyber-Security-Hub/js/core/supabase-learning-api.js` and `tlevel-software-development-hub/js/core/supabase-learning-api.js` |
| Vendored Core IIFEs | `vendor/learning-platform-core/0.1.0` and `0.2.0` under Unit 3, T Level and Unit 14. Unit 3’s integration doc says the 0.2.0 IIFE is for Node tests |
| Session-kind enums | Core, UI, Content |
| Evidence builders | Core and Results, with different jobs |
| Reports Auth | `learning-platform-reports/src/auth/AuthProvider.tsx` does not use Core |
| Group generator client | `classroom-group-generator/src/main.js` calls Supabase directly |
| Readiness diagnostic client | `level-3-it-year-1-readiness-hub/src/diagnostic/api-client.ts` calls diagnostic RPCs directly and also initialises Core |

A reasonable future extraction, not done here, is to retire the classic `supabase-learning-api.js` facades once every scored page goes through `platform.submission.submit`. The diagnostic and grouping clients should stay separate: their RPCs are anonymous and are not part of `createLearnerApi`’s submission contract.

## Supporting applications

### Classroom Group Generator — production

`classroom-group-generator`, version 0.1.0. Learners open `?s=` plus a code, enter a name, and see a published group and role. No login. Sessions are created in the portal’s Group Generator, which calls `admin_api.create_grouping_session` and the related RPCs. The learner app calls `api.join_grouping_session` and `api.my_grouping_status` (anon). Environment names: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (fallback `VITE_SUPABASE_ANON_KEY`). Pages workflow deploys from `main`. Tests: `node --test test/*.test.js`.

This is not teaching-group management. Teaching groups remain `learning.groups`, which the portal cannot yet create.

### Diagnostic assessment — production

| Piece | Location |
| --- | --- |
| Persistence | `learning.diagnostic_sessions`, `learning.diagnostic_responses`, `learning.diagnostic_question_marking` |
| Learner RPCs | `api.start_diagnostic`, `api.submit_diagnostic_response`, `api.complete_diagnostic` |
| Learner app | `level-3-it-year-1-readiness-hub` |
| Staff views | `admin_api.diagnostic_sessions`, `diagnostic_responses`, `diagnostic_summary` |
| Staff UI | `src/views/readiness-diagnostic.tsx`, analytics pane `readiness-diagnostic`, results source `induction-readiness` |
| Interpretation | `buildDiagnostics` in Results, in memory only |

Sittings are not `learning.attempts`. Uniqueness is one sitting per hub, course, diagnostic key, version and reported student id. Versioning notes: `learning-platform-backend/docs/diagnostic-versioning.md`.

`src/components/authoring/diagnostics-list.tsx` is authoring validation output. It is not the induction diagnostic.

### Activity authoring — mixed

The production authoring surface is the portal (`src/views/curriculum-authoring.tsx` and `src/content/`). `npm run build:activity-template` writes a sample Excel file. It is a dev asset.

One-off generators, not wired as portal features:

| Location | Script |
| --- | --- |
| Backend `scripts/import/` | `convert_static_hubs.mjs`, Unit 3 batch generators, `audit-feedback-coverage.mjs` |
| Unit 3 `scripts/` | Week density, week 5, week 7 packs, Vite shells |
| T Level `scripts/` | `generate-os-curriculum.py`, `build-foundations-manifest.js`, `generate-curriculum-migration.py` |
| Emerging `scripts/` | `author-week-2.js`, `author-week-3.js` |
| Unit 14 `scripts/` | `author-week-2-package.cjs`, `import-excel.py`, `generate-pages.py` |

These write files or SQL for review. They are not the running portal.

### Validation and publication

| Tool | Role | Production? |
| --- | --- | --- |
| Content `validatePackage` | Schema and block checks | Used by the portal and by `npm test` in the content package |
| `check-learner-bundle.js` | Hubs fail CI if answer keys ship | CI |
| Backend `scripts/validation/validate_repository.py` | Repository rules, first job of `database-tests.yml` | CI |
| `scripts/import/validate-hub-manifest.py` | Manifest shape | Dev / CI helper |
| `admin_api.publish_curriculum` | Stores the package and projects the catalogue | Production |
| `scripts/release/` | README only. It does not deploy | Documentation |

Publication does not redeploy GitHub Pages. Application-code changes do. That split is stated in `learning-platform-backend/docs/architecture.md` and matches the portal’s publish RPC.

### Reports — QA application

`learning-platform-reports` 0.1.1. A learner SPA for a completed session. Pilot hub code `unit-3-cyber-security`. It reads `api.my_hub_activity_progress` and interprets with Results. README says the Pages site is for QA rather than a general rollout. Workflow deploys from `main` and from `feat/phase-1b-session-reports` when the event is not a pull request.

### Doc generator — development

`doc-generator`. Python `>=3.11`. `PYTHONPATH=src python generate.py <json>` writes a `.docx` from college templates. No Supabase. No GitHub Actions. Tests: `pytest`.

### Notion template — development

`tlevel-software-development-notion-template`. Local git, **no GitHub remote**. Commands `generate` and `provision` talk to the Notion API (`NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`). Group file `config/groups.json` has `groupId` and `name` only. It does not write `learning.groups`.

### Legacy T Level API

`tlevel-software-development-api`. Local git, **no GitHub remote**. Google Apps Script: `health`, `getStudent`, `getStudentProgress`, `submitResult`, backed by a spreadsheet. This is the pre-Supabase backend. Current hubs submit with `api.submit_attempt`. The Apps Script path remains only where a classic Unit 3 page still calls it (`activities/activity.html`). It is legacy.

### Not part of the platform

`/Users/ricardorosa/Projects/agents` has no git metadata and is an unrelated course checkout.

## Error handling in the libraries

| Library | Pattern |
| --- | --- |
| Core submission | `assertSecureSubmission` throws before the RPC. RPC errors are mapped for learners in the hub facades (`LEARNER_MESSAGES` in Unit 3, `mappedError` in T Level). |
| Content | `validatePackage` returns structured failures. `assertLearnerSafePackage` throws if answer keys remain. |
| Results | `ResultsError` for invalid review decisions and similar. No network errors, because there is no network. |
| Portal | Typed errors in `supabase-admin-service.ts`, described in [02 Admin Portal architecture](02_ADMIN_PORTAL_ARCHITECTURE.md). |

Related: [09 Engineering decisions](09_ENGINEERING_DECISIONS.md).
