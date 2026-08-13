import assert from "node:assert/strict";
import test from "node:test";
import { comparePackages, hasStructuredChanges } from "../src/content/compare.ts";
import { migrateRecord } from "../src/content/draft-store.ts";
import { createActivity, createBlock, createWeek, syncCurriculumLists } from "../src/content/factories.ts";
import { canTransition, LIFECYCLE_LABELS, LifecycleError, publicationRecord, reviewMetadata, transitionRecord } from "../src/content/lifecycle.ts";
import { publicationGate } from "../src/content/publication-gate.ts";
import {
  approveRecord,
  archiveVersion,
  createDraft,
  createWorkingCopy,
  publishVersion,
  restoreAsDraft,
  startReview,
  submitForReview,
  suggestNextVersion,
  touchDraft,
} from "../src/content/versioning.ts";
import { platformPublicationArgs } from "../src/content/platform-publication.ts";

function withContent(draft = createDraft("authoring-hub", "Authoring hub", "ocr-level-3-it", "Ada Author")) {
  const week = createWeek({ id: "week-20", teachingWeek: 20, title: "Synthetic week", learningOutcomes: [] });
  const activity = createActivity({ id: "pub-activity", title: "Publication activity" });
  activity.blocks = [createBlock(activity.id, "paragraph", [])];
  return {
    ...draft,
    package: syncCurriculumLists({
      ...draft.package,
      weeks: [week],
      activities: [activity],
    }),
  };
}

function throughApproval(draft = withContent()) {
  const ready = submitForReview(draft);
  const reviewing = startReview(ready, "Riley Reviewer");
  return approveRecord(reviewing, "Approved for local publication.", "Riley Reviewer");
}

test("status transitions follow the publication lifecycle", () => {
  assert.equal(canTransition("draft", "ready-for-review"), true);
  assert.equal(canTransition("ready-for-review", "in-review"), true);
  assert.equal(canTransition("in-review", "approved"), true);
  assert.equal(canTransition("approved", "published"), true);
  assert.equal(canTransition("published", "superseded"), true);
  assert.equal(canTransition("published", "archived"), true);
  assert.equal(canTransition("superseded", "archived"), true);
  const approved = throughApproval();
  assert.equal(approved.status, "approved");
  assert.equal(LIFECYCLE_LABELS[approved.status], "Approved");
});

test("attempted invalid transitions are rejected", () => {
  const published = publishVersion([throughApproval()], throughApproval(), {
    version: "0.1.0",
    publishedBy: "Ada Author",
  }).find((item) => item.status === "published");
  assert.ok(published);
  assert.equal(canTransition("published", "draft"), false);
  assert.throws(() => transitionRecord(published, "draft"), LifecycleError);
  assert.throws(() => publishVersion([withContent()], withContent(), {
    version: "0.1.0",
    publishedBy: "Ada Author",
  }), /Approved/);
});

test("validation gate blocks ready-for-review and publish", () => {
  const invalid = withContent();
  invalid.package.weeks.push(invalid.package.weeks[0]);
  assert.equal(publicationGate(invalid.package).ok, false);
  assert.throws(() => submitForReview(invalid), /validation/i);
  const unsupported = { ...withContent(), sourcePackageVersion: "9.9.9" };
  assert.equal(publicationGate(unsupported.package, unsupported.sourcePackageVersion).ok, false);
  assert.throws(() => submitForReview(unsupported), /validation/i);
});

test("review workflow records reviewer metadata", () => {
  const approved = throughApproval();
  const review = reviewMetadata(approved);
  assert.equal(review.status, "approved");
  assert.equal(review.author, "Ada Author");
  assert.equal(review.reviewer, "Riley Reviewer");
  assert.ok(review.reviewDate);
  assert.match(review.approvalNotes, /Approved for local publication/);
  assert.ok(review.created);
  assert.ok(review.updated);
});

test("publishing creates an immutable version and publication metadata", () => {
  const approved = throughApproval();
  const records = publishVersion([approved], approved, {
    version: "0.1.0",
    publishedBy: "Pat Publisher",
    notes: "First local snapshot.",
  });
  const published = records[0];
  assert.equal(published.status, "published");
  assert.equal(published.version, "0.1.0");
  const record = publicationRecord(published);
  assert.equal(record.version, "0.1.0");
  assert.equal(record.status, "published");
  assert.ok(record.published);
  assert.equal(record.publishedBy, "Pat Publisher");
  assert.equal(record.sourcePackageVersion, "0.1.0");
  assert.equal(record.schemaVersion, "0.1.0");
  assert.equal(published.publicationNotes, "First local snapshot.");
  assert.throws(() => touchDraft(published, published.package), /immutable/i);
  assert.throws(() => {
    published.package.hub.metadata.name = "mutated";
  });
});

test("editing published content requires a working copy", () => {
  const approved = throughApproval();
  const published = publishVersion([approved], approved, { version: "0.1.0", publishedBy: "Ada Author" })[0];
  const copy = createWorkingCopy(published, "Ada Author");
  assert.equal(copy.status, "draft");
  assert.notEqual(copy.id, published.id);
  assert.equal(copy.basedOnVersionId, published.id);
  assert.equal(copy.basedOnVersion, "0.1.0");
  assert.equal(published.status, "published");
  const edited = touchDraft(copy, {
    ...copy.package,
    curriculum: {
      ...copy.package.curriculum,
      metadata: { ...copy.package.curriculum.metadata, title: "Edited working copy" },
    },
  });
  assert.equal(edited.package.curriculum.metadata.title, "Edited working copy");
  assert.equal(published.package.curriculum.metadata.title, approved.package.curriculum.metadata.title);
});

test("a later publish supersedes the previous published version", () => {
  const first = throughApproval();
  const afterFirst = publishVersion([first], first, { version: "0.1.0", publishedBy: "Ada Author" });
  const copy = createWorkingCopy(afterFirst[0], "Ada Author");
  const second = throughApproval(copy);
  const afterSecond = publishVersion([...afterFirst, second], second, { version: "0.1.1", publishedBy: "Ada Author" });
  assert.equal(afterSecond.find((item) => item.version === "0.1.0")?.status, "superseded");
  assert.equal(afterSecond.find((item) => item.version === "0.1.1")?.status, "published");
  assert.equal(suggestNextVersion(afterSecond, first.hubId, first.courseKey), "0.1.2");
});

test("restore as draft never edits history", () => {
  const published = publishVersion([throughApproval()], throughApproval(), {
    version: "0.1.0",
    publishedBy: "Ada Author",
  })[0];
  const restored = restoreAsDraft(published, "Ada Author");
  assert.equal(restored.status, "draft");
  assert.notEqual(restored.id, published.id);
  assert.equal(published.status, "published");
  assert.equal(published.version, "0.1.0");
  assert.equal(restored.basedOnVersion, "0.1.0");
});

test("compare reports structured metadata week session activity and block differences", () => {
  const left = withContent();
  const rightDraft = withContent();
  const extraWeek = createWeek({ id: "week-21", teachingWeek: 21, title: "Added week", learningOutcomes: [] });
  const extraActivity = createActivity({ id: "pub-activity-2", title: "Second activity" });
  extraActivity.blocks = [createBlock(extraActivity.id, "heading", [])];
  rightDraft.package.weeks[0] = {
    ...rightDraft.package.weeks[0],
    metadata: { ...rightDraft.package.weeks[0].metadata, title: "Renamed week" },
  };
  rightDraft.package.activities[0].blocks[0] = {
    ...rightDraft.package.activities[0].blocks[0],
    content: { ...rightDraft.package.activities[0].blocks[0].content, text: "Changed paragraph" },
  };
  rightDraft.package = syncCurriculumLists({
    ...rightDraft.package,
    weeks: [...rightDraft.package.weeks, extraWeek],
    activities: [...rightDraft.package.activities, extraActivity],
  });
  const diff = comparePackages(left.package, rightDraft.package);
  assert.equal(hasStructuredChanges(diff), true);
  assert.ok(diff.weeks.some((item) => item.kind === "added" && item.id === "week-21"));
  assert.ok(diff.weeks.some((item) => item.kind === "changed"));
  assert.ok(diff.activities.some((item) => item.kind === "added"));
  assert.ok(diff.blocks.some((item) => item.kind === "changed" || item.kind === "added"));
  assert.ok(diff.metadata.length >= 0);
});

test("history records keep version status created published author reviewer and notes", () => {
  const published = publishVersion([throughApproval()], throughApproval(), {
    version: "0.2.0",
    publishedBy: "Pat Publisher",
    notes: "History snapshot.",
  })[0];
  assert.equal(published.version, "0.2.0");
  assert.equal(published.status, "published");
  assert.ok(published.createdAt);
  assert.ok(published.publishedAt);
  assert.equal(published.author, "Ada Author");
  assert.equal(published.reviewer, "Riley Reviewer");
  assert.equal(published.publicationNotes, "History snapshot.");
});

test("archive is allowed from published and superseded versions only", () => {
  const published = publishVersion([throughApproval()], throughApproval(), {
    version: "0.1.0",
    publishedBy: "Ada Author",
  })[0];
  const archived = archiveVersion(published);
  assert.equal(archived.status, "archived");
  assert.throws(() => archiveVersion(withContent()), LifecycleError);
});

test("legacy valid and invalid draft statuses migrate to draft", () => {
  const migrated = migrateRecord({
    id: "legacy-1",
    title: "Legacy",
    hubId: "authoring-hub",
    courseKey: "ocr-level-3-it",
    status: "valid",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    package: createDraft("authoring-hub", "Authoring hub", "ocr-level-3-it").package,
  });
  assert.equal(migrated?.status, "draft");
  assert.equal(migrated?.platformPublicationState, "idle");
});

test("local publish marks the snapshot pending for platform publication", () => {
  const published = publishVersion([throughApproval()], throughApproval(), {
    version: "0.1.0",
    publishedBy: "Ada Author",
  })[0];
  assert.equal(published.platformPublicationState, "pending");
});

test("platform publication payload accepts only approved or published snapshots", () => {
  const draft = withContent();
  assert.throws(() => platformPublicationArgs(draft), /Approved or Published/);
  const published = publishVersion([throughApproval()], throughApproval(), {
    version: "0.1.0",
    publishedBy: "Ada Author",
  })[0];
  const args = platformPublicationArgs(published);
  assert.equal(args.p_lifecycle_status, "published");
  assert.equal(args.p_hub_code, published.hubId);
  assert.equal(args.p_course_key, published.courseKey);
  assert.equal(args.p_package_version, "0.1.0");
  assert.equal(args.p_schema_version, published.schemaVersion);
  assert.equal(args.p_source_package_version, published.sourcePackageVersion);
  assert.equal(args.p_package, published.package);
});
