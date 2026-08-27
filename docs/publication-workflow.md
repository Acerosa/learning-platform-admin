# Publication workflow

Curriculum publication is an Admin-local CMS lifecycle. Admin edits Drafts.
Learners consume Published content. Drafts must never appear in a learner hub.

This workflow does **not** commit to GitHub or deploy into Unit 14 or any other
hub. Backend catalogue publication is a separate, explicit **Publish to
Platform** step after a local Published snapshot exists.

## Architecture

```text
Admin working copy (Draft)
  → review states
      → Approved
          → immutable Published snapshot (browser storage)
              → Publish to Platform (admin_api.publish_curriculum)
```

Storage key: `lp.admin.authoring.records.v2`.

The canonical package remains `@learning-platform/content` 0.1.0. Publication
records wrap a cloned content package; they do not invent a second schema.

## Lifecycle

Allowed transitions:

| From | To |
| --- | --- |
| Draft | Ready for Review |
| Ready for Review | In Review, Draft |
| In Review | Approved, Draft |
| Approved | Published, Draft |
| Published | Superseded, Archived |
| Superseded | Archived |
| Archived | — |

Return to Draft is allowed only **before** publication, so a reviewer can
request changes without mutating history. Published → Draft is rejected.

Validation is a gate, not a lifecycle status. Legacy `valid` / `invalid` draft
labels migrate to Draft.

## Version model

Publishing assigns an immutable semantic version (`0.1.0`, `0.1.1`, `0.2.0`,
`1.0.0`). The new version must be greater than any version already assigned to
that hub and course.

Published, superseded and archived packages are deep-frozen. Content edits are
refused. Editing always happens on a Draft.

## Working copies

Opening Published (or Superseded) content for editing creates a new Draft
working copy linked with `basedOnVersionId` / `basedOnVersion`. The published
snapshot stays untouched.

## Review

Review metadata on each record:

- status
- created
- updated
- author
- reviewer
- review date
- approval notes
- publication notes

Ready for Review and Publish both require the validation gate.

## History

History lists Version, Status, Created, Published, Author, Reviewer and Notes.
Actions are View, Compare and Restore as Draft. History rows are never edited.

## Compare

Compare is a structured diff of:

- hub and curriculum metadata
- weeks
- sessions
- activities
- blocks

It is not a raw JSON dump.

## Restore

Restore as Draft clones any historical record into a new Draft. The source
version keeps its status and package.

## Validation gate

Publishing (and Ready for Review) require:

- `validatePackage` success (no schema errors)
- supported `schemaVersion` (`0.1.0`)
- supported content `packageVersion` (`0.1.0`)

## Publication record

Each published snapshot stores:

- version
- status
- created
- published
- published by
- source package version
- schema version

There is no GitHub commit or learner-hub deployment.

Composition output is a normal draft/package. Validate → approve → Publish to
Platform remains the only learner-visible path.

## Week visibility (post / remove)

On the Weeks tab, staff select a week and use **Post week & publish**
(`metadata.status` → `available`) or **Remove week & publish**
(`metadata.status` → `planned`). Remove does not delete curriculum objects.

Each action (with a live administrator session) automatically:

1. Opens a working copy when the current snapshot is Published/Superseded (or returns review states to Draft)
2. Applies the visibility change
3. Validates the package
4. Auto-approves with notes such as `Week visibility: post <weekId>`
5. Creates a new immutable Admin version (semver bump)
6. Calls **Publish to Platform** (`admin_api.publish_curriculum`)

There is no separate reveal API. The full Review → Approve → Publish immutable
→ Publish to Platform path remains for normal curriculum edits.

A snapshot that is already `platformPublicationState === published` cannot be
sent again as-is. Post/Remove & publish creates the next working copy and
version. **Create new draft from published** remains available for content
edits.

## Preview

Preview uses the `@learning-platform/content` renderer against the **selected**
version, including historical snapshots.

## Backend publication

After local Publish, **Publish to Platform** sends the frozen snapshot through
`admin_api.publish_curriculum`. The backend re-validates, stores an immutable
catalogue row, supersedes the previous current version, and audits the event.
Admin shows Pending / Publishing / Published / Failed and the staff history
view. Rollback is Restore as Draft → review → publish a new version.

See [Backend publication](backend-publication.md).

## Future GitHub publication

A later release may export a published snapshot into a learner hub repository.
That automation is out of scope here. Unit 14 continues to consume its existing
published package until that work is explicitly scheduled.

## Unit 14

Learner behaviour is unchanged. Hubs never read Admin localStorage.
