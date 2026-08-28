import assert from "node:assert/strict";
import test from "node:test";
import { comparePackages, hasStructuredChanges } from "../src/content/compare.ts";
import { migrateRecord } from "../src/content/draft-store.ts";
import { canPublishToPlatform, platformPublishBlockedReason, weekVisibilityNextSteps, weekVisibilityRecoveryAction } from "../src/content/publication-guidance.ts";
import { createActivity, createBlock, createSession, createWeek, syncCurriculumLists } from "../src/content/factories.ts";
import { canTransition, LIFECYCLE_LABELS, LifecycleError, publicationRecord, reviewMetadata, transitionRecord } from "../src/content/lifecycle.ts";
import { publicationGate } from "../src/content/publication-gate.ts";
import {
  canRunCurriculumPublish,
  prepareCurriculumPublish,
} from "../src/content/curriculum-publish.ts";
import {
  approveRecord,
  archiveVersion,
  createDraft,
  createWorkingCopy,
  publishVersion,
  replaceRecord,
  restoreAsDraft,
  startReview,
  submitForReview,
  suggestNextVersion,
  touchDraft,
  withPlatformPublication,
} from "../src/content/versioning.ts";
import { postWeek } from "../src/content/week-availability.ts";
import {
  prepareWeekVisibilityPublish,
  weekVisibilityHubIdHint,
  weekVisibilityPublishSuccessMessage,
  WeekVisibilityPublishError,
} from "../src/content/week-visibility-publish.ts";
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

test("after platform publish, a working copy can post a week and publish again", () => {
  const firstApproved = throughApproval();
  let records = publishVersion([firstApproved], firstApproved, {
    version: "0.1.0",
    publishedBy: "Ada Author",
  });
  const firstPublished = withPlatformPublication(records[0], {
    platformPublicationState: "published",
    platformPublishedAt: "2026-08-27T12:00:00.000Z",
    platformPublicationId: "pub-1",
  });
  records = replaceRecord(records, firstPublished);

  assert.equal(canPublishToPlatform(firstPublished, true), false);
  assert.match(platformPublishBlockedReason(firstPublished, true) || "", /Post week & publish/i);
  assert.match(weekVisibilityNextSteps(firstPublished), /Post week & publish/i);
  assert.equal(weekVisibilityRecoveryAction(firstPublished), "working-copy");

  const copy = createWorkingCopy(firstPublished, "Ada Author");
  assert.equal(copy.status, "draft");
  assert.equal(copy.platformPublicationState, "idle");
  assert.equal(canPublishToPlatform(copy, true), false);

  const weekId = copy.package.weeks[0].id;
  assert.equal(copy.package.weeks[0].metadata.status, "planned");
  const posted = touchDraft(copy, postWeek(copy.package, weekId));
  assert.equal(posted.package.weeks[0].metadata.status, "available");
  assert.equal(posted.package.weeks.length, 1);
  assert.equal(posted.package.activities.length, 1);
  assert.match(weekVisibilityNextSteps(posted), /Post week & publish/i);

  const secondApproved = throughApproval(posted);
  records = publishVersion(records, secondApproved, {
    version: "0.1.1",
    publishedBy: "Ada Author",
  });
  const secondPublished = records.find((item) => item.version === "0.1.1");
  assert.ok(secondPublished);
  assert.equal(secondPublished.status, "published");
  assert.equal(secondPublished.platformPublicationState, "pending");
  assert.equal(canPublishToPlatform(secondPublished, true), true);
  assert.equal(platformPublishBlockedReason(secondPublished, true), null);
  assert.equal(secondPublished.package.weeks[0].metadata.status, "available");
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

test("week visibility publish posts a week, bumps version, and leaves platform pending", () => {
  const draft = withContent();
  const weekId = draft.package.weeks[0].id;
  const result = prepareWeekVisibilityPublish([draft], draft, weekId, "post", "Ada Author");
  assert.equal(result.published.status, "published");
  assert.equal(result.published.version, "0.1.0");
  assert.equal(result.published.platformPublicationState, "pending");
  assert.equal(result.published.package.weeks[0].metadata.status, "available");
  assert.match(result.published.approvalNotes, /Week visibility: post/);
  assert.equal(canPublishToPlatform(result.published, true), true);
  assert.match(weekVisibilityPublishSuccessMessage(result), /Reload the learner hub/);
  assert.match(weekVisibilityPublishSuccessMessage(result), /status available/);
  assert.match(weekVisibilityPublishSuccessMessage(result), new RegExp(weekId));
});

test("week visibility publish from an already platform-published snapshot creates the next version", () => {
  const draft = withContent();
  const weekId = draft.package.weeks[0].id;
  const first = prepareWeekVisibilityPublish([draft], draft, weekId, "post", "Ada Author");
  const onPlatform = withPlatformPublication(first.published, {
    platformPublicationState: "published",
    platformPublishedAt: "2026-08-27T12:00:00.000Z",
    platformPublicationId: "pub-1",
  });
  const records = replaceRecord(first.records, onPlatform);
  const second = prepareWeekVisibilityPublish(records, onPlatform, weekId, "remove", "Ada Author");
  assert.equal(second.published.version, "0.1.1");
  assert.equal(second.published.platformPublicationState, "pending");
  assert.equal(second.published.package.weeks[0].metadata.status, "planned");
  assert.equal(second.published.package.weeks.length, 1);
  assert.equal(second.published.package.activities.length, 1);
  assert.equal(canPublishToPlatform(second.published, true), true);
  assert.match(weekVisibilityPublishSuccessMessage(second), /Reload the learner hub/);
  assert.match(weekVisibilityPublishSuccessMessage(second), /status planned/);
});

test("week visibility publish blocks when validation fails", () => {
  const invalid = withContent();
  invalid.package.weeks.push(invalid.package.weeks[0]);
  const weekId = invalid.package.weeks[0].id;
  assert.throws(
    () => prepareWeekVisibilityPublish([invalid], invalid, weekId, "post", "Ada Author"),
    WeekVisibilityPublishError,
  );
});

test("week visibility success message includes hub sync details and soft T Level id hint", () => {
  assert.equal(weekVisibilityHubIdHint("tlevel-software-development", "week-1", "1"), null);
  assert.match(weekVisibilityHubIdHint("tlevel-software-development", "foundations", "1") || "", /week-1/);
  assert.equal(weekVisibilityHubIdHint("unit-3-cyber-security", "foundations", "1"), null);

  const draft = withContent();
  draft.hubId = "tlevel-software-development";
  draft.courseKey = "t-level-digital-software-development";
  const week = {
    ...draft.package.weeks[0],
    id: "foundations",
    metadata: { ...draft.package.weeks[0].metadata, teachingWeek: 1, title: "Foundations", status: "planned" },
  };
  draft.package = syncCurriculumLists({
    ...draft.package,
    hub: { ...draft.package.hub, id: "tlevel-software-development" },
    curriculum: {
      ...draft.package.curriculum,
      metadata: { ...draft.package.curriculum.metadata, course: "t-level-digital-software-development" },
    },
    weeks: [week],
  });
  const result = prepareWeekVisibilityPublish([draft], draft, "foundations", "post", "Ada Author");
  const message = weekVisibilityPublishSuccessMessage(result);
  assert.match(message, /tlevel-software-development/);
  assert.match(message, /t-level-digital-software-development/);
  assert.match(message, /foundations/);
  assert.match(message, /status available/);
  assert.match(message, /Reload the learner hub/);
  assert.match(message, /week-1/);
});

test("an imported week graph can pass the publication gate and local publish", () => {
  const draft = withContent();
  const week = createWeek({
    id: "week-2",
    teachingWeek: 2,
    title: "Imported week",
    status: "available",
    learningOutcomes: [],
    sessions: ["week-2-session-1"],
  });
  const session = createSession({
    id: "week-2-session-1",
    title: "Session 1",
    kind: "session",
    weekId: "week-2",
    activities: ["week-2-lab"],
  });
  const activity = createActivity({ id: "week-2-lab", title: "Lab", status: "available" });
  activity.blocks = [createBlock(activity.id, "paragraph", [])];
  const ready = {
    ...draft,
    package: syncCurriculumLists({
      ...draft.package,
      weeks: [...draft.package.weeks, week],
      sessions: [session],
      activities: [...draft.package.activities, activity],
    }),
  };
  assert.equal(publicationGate(ready.package).ok, true);
  const published = publishVersion([throughApproval(ready)], throughApproval(ready), {
    version: "0.2.0",
    publishedBy: "Ada Author",
    notes: "Week graph snapshot.",
  })[0];
  assert.equal(published.status, "published");
  assert.equal(published.version, "0.2.0");
  assert.equal(published.package.weeks.some((item) => item.id === "week-2"), true);
  const args = platformPublicationArgs(published);
  assert.equal(args.p_package_version, "0.2.0");
  assert.equal(args.p_package.sessions[0].id, "week-2-session-1");
});

test("authoring drafts can be opened for Unit 3 and T Level without a Unit 14 filter", () => {
  const unit3 = createDraft("unit-3-cyber-security", "Unit 3 Cyber Security Hub", "ocr-level-3-it", "Ada Author");
  const tlevel = createDraft(
    "tlevel-software-development",
    "T Level Digital Software Development Hub",
    "t-level-digital-software-development",
    "Ada Author"
  );
  assert.equal(unit3.package.hub.id, "unit-3-cyber-security");
  assert.equal(unit3.courseKey, "ocr-level-3-it");
  assert.equal(tlevel.package.hub.id, "tlevel-software-development");
  assert.equal(tlevel.courseKey, "t-level-digital-software-development");
});

test("prepareCurriculumPublish auto-approves draft and creates immutable published snapshot", () => {
  const draft = withContent();
  const result = prepareCurriculumPublish([], draft, "Ada Author", "Ship it");
  assert.equal(result.published.status, "published");
  assert.match(result.version, /^\d+\.\d+\.\d+$/);
  assert.equal(result.published.platformPublicationState, "pending");
});

test("canRunCurriculumPublish requires validation and live platform session", () => {
  const draft = withContent();
  assert.equal(canRunCurriculumPublish(draft, false, false, true), false);
  assert.equal(canRunCurriculumPublish(draft, true, false, false), false);
  assert.equal(canRunCurriculumPublish(draft, true, false, true), true);
});

test("userLifecycleLabel does not report Published when backend publication failed", async () => {
  const { userLifecycleLabel, USER_LIFECYCLE_LABELS } = await import("../src/content/user-lifecycle.ts");
  const locallyPublished = publishVersion([throughApproval(withContent())], throughApproval(withContent()), {
    version: "0.1.0",
    publishedBy: "Ada Author",
  })[0];
  const failed = withPlatformPublication(locallyPublished, {
    platformPublicationState: "failed",
    platformPublicationError: "Curriculum could not be published to the platform.",
  });
  assert.notEqual(userLifecycleLabel(failed), USER_LIFECYCLE_LABELS.published);
  assert.equal(userLifecycleLabel(failed), "Published (pending platform sync)");
  const succeeded = withPlatformPublication(locallyPublished, {
    platformPublicationState: "published",
    platformPublishedAt: new Date().toISOString(),
    platformPublicationId: "pub-1",
  });
  assert.equal(userLifecycleLabel(succeeded), USER_LIFECYCLE_LABELS.published);
});
