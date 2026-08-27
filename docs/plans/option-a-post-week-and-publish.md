# Implementation prompt: Option A — Post week & publish to Platform

Copy everything under **Agent prompt** into a new agent chat (workspace: `learning-platform-admin`). Do not invent a new backend RPC or bypass package validation.

---

## Agent prompt

### Goal

Make week posting straightforward for staff. On **Weeks → Week visibility**, posting or removing a week should (when possible) flip `metadata.status` **and** push a new immutable platform publication in one staff action — without walking Review → Approve → Publish immutable → Publish to Platform by hand.

Staff happy path after this change:

1. Open Curriculum authoring for the hub/course (editable Draft; auto-create working copy if current record is Published).
2. Select week → **Post week & publish** (or **Remove week & publish**).
3. Confirm → learners see the change after hub `loadLatest` (existing behaviour).

No separate reveal API. No hub changes required unless Admin publish behaviour regresses.

### Non-goals

- Do not add `admin_api.set_week_status` or any week-only backend mutation (that is Option D).
- Do not delete weeks/sessions/activities on Remove.
- Do not change Content week statuses beyond `planned` | `available` | `archived`.
- Do not remove the existing full Review/Publication path for real curriculum edits — only add a **visibility shortcut** that reuses the same versioning + `publish_curriculum` pipeline.
- Do not silently skip `publicationGate` / `validatePackage`. If the package fails validation, abort with a clear error and leave the draft editable (status change may be applied only if you choose a two-phase UX — prefer **atomic**: no local Post commit unless the whole pipeline can start; or apply Post to draft then roll back on failure — pick one and test it).

### Product rules (keep)

| Action | Package effect |
| --- | --- |
| Post | `week.metadata.status` → `available` |
| Remove | `week.metadata.status` → `planned` (never delete content) |

Learners only see platform catalogue after successful `admin_api.publish_curriculum`. Each release needs a **new** immutable local version (semver bump) because a snapshot already `platformPublicationState === "published"` cannot be republished.

### Current friction (context)

Today Post/Remove only update the draft package (`src/content/week-availability.ts`). Staff then must:

Save → Ready for Review → In Review → Approve → Publish immutable → Publish to Platform

Guidance lives in `src/content/publication-guidance.ts`. Recovery (“Create new draft from published”) is required when the selected record is immutable. That is too heavy for progressive week release.

### Target design

#### UI (Weeks tab — Week visibility panel)

In `src/views/curriculum-authoring.tsx`:

- Replace primary actions (or rename + rewire):
  - **Post week & publish** (was Post week)
  - **Remove week & publish** (was Remove week)
- Confirm copy must state that this will publish a new version to the platform for learners.
- Disable when: no selected week, action not applicable (`canPostWeek` / `canRemoveWeek`), no live admin session (`platformAvailable` / `onPublishToPlatform`), or a publish is already in progress.
- If the current record is **not editable** (Published / review states), keep recovery CTAs, but prefer: one primary path that **creates a working copy automatically** then runs the publish pipeline (optional polish; minimum is: still show “Create new draft…” then enable the new buttons on the draft).
- Success message: short — e.g. “Week N is available on the platform.” / “Week N is planned again on the platform.” Point at hub reload / `loadLatest`, not the old multi-step Review path.
- On validation or RPC failure: show the existing error surface; keep staff on Weeks; do not leave them stuck on a half-published “publishing” state without recovery.

#### Pipeline (orchestrate existing functions)

Implement a pure-ish orchestrator (new module preferred), e.g. `src/content/week-visibility-publish.ts`, called from the Weeks handlers.

Given `(records, draft, weekId, action: "post" | "remove", actor, options)`:

1. **Ensure editable draft**
   - If immutable published/superseded: `createWorkingCopy(published, actor)` (and persist into records).
   - If review state that can return: `returnToDraft` then continue (or require explicit Return — document choice).
2. **Apply visibility**
   - `postWeek` / `removeWeek` on `draft.package` via existing helpers.
3. **Validation gate**
   - `publicationGate(pkg, sourcePackageVersion)` — if `!ok`, throw with issues (do not publish).
4. **Fast-forward lifecycle** (visibility shortcut only)
   - From draft: transition through whatever is required so `publishVersion` accepts the record.
   - Today `publishVersion` requires `status === "approved"`.
   - Recommended: add `approveForWeekVisibilityPublish(record, actor)` or a dedicated helper that:
     - Runs the same gate as Ready for Review / Publish
     - Sets status to `approved` with notes like `Week visibility: post <weekId>` / `Week visibility: remove <weekId>`
     - Does **not** require staff to click Review UI
   - Do **not** invent a new lifecycle status.
5. **Local immutable publish**
   - `version = suggestNextVersion(records, hubId, courseKey)` (or bump patch)
   - `publishVersion(records, approvedDraft, { version, publishedBy: actor, notes })`
   - Updates localStorage records; previous published → superseded (existing behaviour)
6. **Platform publish**
   - Same path as Publication panel: `withPlatformPublication(..., publishing)` → `onPublishToPlatform(record)` → mark `published` / `failed`
   - Reuse `supabase-admin-service` / existing `publish_curriculum` args (`platformPublicationArgs`)

Extract shared “publish this published snapshot to platform” logic from the Publication panel handler if duplication is painful — keep one code path for RPC + state updates.

#### Guidance / docs cleanup

Update strings so staff are not told to walk Review after Post:

- `src/content/publication-guidance.ts` — week visibility next steps / after-platform guidance should describe the one-button path (and mention full Publication tab only for content edits).
- `docs/publication-workflow.md` — Week visibility section
- `docs/curriculum-authoring.md` — if it documents Post → multi-step publish

Keep full CMS lifecycle docs for non-visibility edits.

### Files to touch (expected)

| Area | Files |
| --- | --- |
| Orchestrator | **new** `src/content/week-visibility-publish.ts` (+ optional small helpers in `versioning.ts`) |
| UI | `src/views/curriculum-authoring.tsx` (Week visibility buttons/handlers) |
| Guidance | `src/content/publication-guidance.ts` |
| Docs | `docs/publication-workflow.md`, `docs/curriculum-authoring.md` |
| Tests | `tests/publication.test.ts` (+ new unit tests for orchestrator if cleaner) |

Unlikely: backend, hubs, `week-availability.ts` status helpers (keep as-is).

### Tests (required)

1. **Orchestrator unit**: post on draft package → approved → published local version bump → platform state pending/ready for RPC mock.
2. **When already platform-published**: createWorkingCopy → post → new version > previous → publishable again.
3. **Remove**: status back to `planned`; content weeks still present.
4. **Validation failure**: gate fails → no platform call; clear error.
5. **Guidance strings**: no longer instruct Review → Approve → Publish immutable as the primary Post path.
6. Existing publication/lifecycle tests still pass.

Run the repo’s usual test command for Admin (see `docs/testing.md` / package scripts).

### Acceptance checklist

- [ ] From an editable draft + live admin session: one confirm posts a week and platform catalogue updates (new version).
- [ ] Same for remove → planned.
- [ ] From a record already on the platform: action still works (working copy + new version) without staff hunting “Create new draft” as a separate mental step (auto or one obvious CTA before the action).
- [ ] Full Review/Publication UI still works for normal curriculum publishing.
- [ ] Validation failures block platform publish.
- [ ] Docs match the new staff path.
- [ ] No commit/PR unless the user asks.

### Implementation order

1. Add orchestrator + lifecycle helper (approve-for-visibility + publishVersion wiring) with unit tests (mock platform).
2. Wire Weeks UI buttons + confirms + busy/disabled states; reuse platform publish commit helper.
3. Update guidance strings + docs.
4. Manual smoke on https://acerosa.github.io/learning-platform-admin/ after deploy (Post week & publish → hub Home shows week available).

### Out of scope polish (only if cheap)

- Auto-switch tab stays on Weeks during the action.
- Progress text: “Saving… / Publishing version… / Publishing to platform…”
- Keep old “Post week” (draft-only) as a secondary control — **default: no**; one clear primary action.

---

## Decision log

| Decision | Choice |
| --- | --- |
| Option | A — one staff action: visibility change + platform publish |
| Backend | Existing `publish_curriculum` only |
| Review UI | Skipped for this shortcut; auto-approve with explicit notes |
| Validation | Still required |
| Hubs | No change |

## Reference map

- Post/Remove helpers: `src/content/week-availability.ts`
- Lifecycle/versioning: `src/content/versioning.ts` (`approveRecord`, `publishVersion`, `createWorkingCopy`, `suggestNextVersion`)
- Gate: `src/content/publication-gate.ts`
- Platform RPC: `src/services/supabase-admin-service.ts` + Publication panel handler in `src/views/curriculum-authoring.tsx`
- Current Week UI: Weeks tab ~“Week visibility” in `curriculum-authoring.tsx`
- Docs: `docs/publication-workflow.md` (Week visibility section)
