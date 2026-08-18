# Curriculum authoring MVP

The Curriculum authoring module edits the same canonical `lp.content.*` model
consumed by Unit 14. It does not invent a second curriculum model, write to the
backend, or publish GitHub curriculum files.

## Architecture

```text
Admin UI
  → factories / importers / draft store
      → @learning-platform/content 0.1.0
          schemas
          validator
          block registry
          importer
          renderer
```

Admin depends on those semantics. It does not own them.

Package:

- dependency: `@learning-platform/content` `file:../learning-platform-content`
- version: `0.1.0` (tag `v0.1.0`)
- canonical repository: [Acerosa/learning-platform-content](https://github.com/Acerosa/learning-platform-content)
- model: exact reviewed schema set (`lp.content.*`)

The UI loads a canonical package, then renders editors from object type. There
is no `if hub === "unit14"` rendering branch. Unit 14 is currently the only
fully proven live consumer; Admin still authors generic canonical objects.

Authoring does **not** edit HTML, hub source files, database migrations,
learner attempts, marks, RLS, or GitHub repository files.

## Canonical schemas

Supported envelopes are the package `lp.content.*` set:

- hub, curriculum, learning-outcome, assignment
- week, session, activity, block, question, asset
- schemaVersion `0.1.0` only

Week, session and activity forms map onto those fields. Version is taken from
the engine `SCHEMA_VERSION`; the UI does not invent extra properties.

Session kinds come from the engine contract:

`session`, `independent-study`, `homework`, `revision`, `retrieval`

Activities are ordered block lists. Quiz, coding and reflection are not
separate editors; they are block compositions.

## Block composer

Authorable types are the implemented registry entries:

- interactive: `single-choice`, `classification`, `short-response`,
  `code-editor`, `python-exercise`, `reflection`
- prose/media: `heading`, `paragraph`, `markdown`, `callout`, `accordion`,
  `hint`, `quote`, `reference`, `image`, `video`, `teacher-note`, `divider`

Unimplemented registry types cannot be added. Block and question IDs are
generated once and stay stable while content is edited. Duplicate creates a
new id. Reorder uses Move up / Move down; drag-and-drop is not required.

## JSON import

Accepted input:

- a canonical object (`lp.content.activity`, `week`, `session`, or other
  envelope)
- a canonical content package

Flow: select file → parse → identify schema → sanitise → validate → preview →
merge into the draft workspace.

Malformed JSON and script/event-handler markup are rejected. Diagnostics show
`code`, `path` and `message`.

## Excel template

Workbook: `/templates/lp-content-activity-import.xlsx`

The browser parser uses pinned `xlsx@0.18.5`. There is no CDN dependency.

Shared importer sheets:

`LearningOutcomes`, `Assignments`, `Weeks`, `Sessions`, `Activities`,
`Blocks`, `Questions`, `Assets`

Admin-only extensions merged after import, because the shared Blocks importer
does not map MCQ options:

- `Options` — `blockId`, `optionId`, `label`, `correct`
- `Feedback` — `blockId`, `correct`, `incorrect`

MVP target is one activity workbook, not a full curriculum workbook. Arbitrary
spreadsheets are not supported.

Build committed copies with:

```bash
npm run build:activity-template
```

## Validation

`src/content/validate.ts` is a thin adapter over the package
`validatePackage` / `validateDocument`. Admin does not maintain a second rule
set.

Typical codes:

- `DUPLICATE_ID`
- `MISSING_REFERENCE`
- `UNSUPPORTED_VERSION`
- `UNSUPPORTED_BLOCK_TYPE`
- `CYCLIC_REFERENCE`

## Preview

Preview calls `renderActivity` / `renderWeek` from `@learning-platform/content`. Staff
see the same HTML contract as the learner hub. The pane is read-only.

Imported rich text is treated as untrusted. The renderer HTML-escapes output;
import sanitisation also rejects `<script`, event handlers and `javascript:`
URLs.

## Draft model

Drafts and publication records are browser `localStorage` only
(`lp.admin.authoring.records.v2`). They are not backend curriculum.

Statuses:

- Draft
- Ready for Review
- In Review
- Approved
- Published
- Superseded
- Archived

Validation is a gate, not a status. Only Drafts are editable. Publishing
creates an immutable Admin-local version. **Publish to Platform** then sends
that snapshot to the backend catalogue. Learner hubs are not updated. Details:
[Publication workflow](publication-workflow.md) and
[Backend publication](backend-publication.md).

Actions: save, resume, duplicate, delete, export, review, publish, publish to
platform, compare, restore as Draft, archive.

## Export

Validated drafts can export:

- a single canonical object
- an activity package
- a full curriculum package

Exported JSON must be accepted by `@learning-platform/content` without manual edits.
Interop is covered by `tests/authoring-interop.test.ts` using synthetic
content. That fixture is not added to live Unit 14 Week 1.

## Composition path

The Composition Builder inserts library objects, applies overrides, detaches,
reorders, and materialises a canonical `ContentPackage`. That package becomes
a normal `AuthoringDraft` and then follows this same publication workflow.
Composition does not publish by itself.

## Future publishing

Still deferred:

- GitHub commit automation for teaching copy (must remain unused)
- collaborative multi-user editing
- AI generation
- automatic assignment grading

Learner hubs already consume published packages from
`api.published_curriculum_package`. A GitHub Pages rebuild is not required
for ordinary teaching-copy publication.
