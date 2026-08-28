import assert from "node:assert/strict";
import test from "node:test";
import { createActivity, createBlock, createWeek, syncCurriculumLists } from "../src/content/factories.ts";
import { canPublishToPlatform } from "../src/content/publication-guidance.ts";
import { userLifecycleLabel, USER_LIFECYCLE_LABELS } from "../src/content/user-lifecycle.ts";
import {
  authoritativePublicationVersion,
  createDraft,
  createWorkingCopyFromPackage,
  replaceRecord,
  resolveHostedPublicationVersion,
  suggestNextVersion,
  withPlatformPublication,
} from "../src/content/versioning.ts";
import { weekContentStatus } from "../src/content/week-availability.ts";
import {
  prepareWeekVisibilityPublish,
  recoverFromFailedWeekVisibilityPublish,
  weekVisibilityPlatformPublishFailureMessage,
} from "../src/content/week-visibility-publish.ts";

const HUB = "tlevel-software-development";
const COURSE = "t-level-digital-software-development";

function tlevelDraft() {
  const draft = createDraft(HUB, "T Level Digital Software Development Hub", COURSE, "Ada Author");
  const week = createWeek({
    id: "week-2",
    teachingWeek: 2,
    title: "Week 2",
    status: "planned",
    learningOutcomes: [],
  });
  const activity = createActivity({ id: "week-2-lab", title: "Lab" });
  activity.blocks = [createBlock(activity.id, "paragraph", [])];
  return {
    ...draft,
    package: syncCurriculumLists({
      ...draft.package,
      hub: { ...draft.package.hub, id: HUB },
      curriculum: {
        ...draft.package.curriculum,
        metadata: { ...draft.package.curriculum.metadata, course: COURSE },
      },
      weeks: [week],
      activities: [activity],
    }),
  };
}

function hostedWorkingCopy(hostedVersion: string) {
  const publishedPkg = tlevelDraft().package;
  return createWorkingCopyFromPackage(publishedPkg, "Ada Author", hostedVersion);
}

test("Post week from hosted 0.3.0 working copy bumps to 0.3.1 without local 0.3.0 history", () => {
  const working = hostedWorkingCopy("0.3.0");
  assert.equal(working.basedOnVersion, "0.3.0");
  assert.equal(working.version, "");
  assert.equal(suggestNextVersion([], HUB, COURSE, { basedOnVersion: working.basedOnVersion }), "0.3.1");

  const result = prepareWeekVisibilityPublish([working], working, "week-2", "post", "Ada Author");
  assert.equal(result.published.version, "0.3.1");
  assert.equal(result.published.package.weeks[0].metadata.status, "available");
  assert.equal(result.published.platformPublicationState, "pending");
});

test("Remove week after 0.3.1 platform publication bumps to 0.3.2", () => {
  const working = hostedWorkingCopy("0.3.0");
  const posted = prepareWeekVisibilityPublish([working], working, "week-2", "post", "Ada Author");
  const onPlatform = withPlatformPublication(posted.published, {
    platformPublicationState: "published",
    platformPublishedAt: "2026-08-27T13:52:46.000Z",
    platformPublicationId: "pub-3031",
  });
  const records = replaceRecord(posted.records, onPlatform);

  const removed = prepareWeekVisibilityPublish(records, onPlatform, "week-2", "remove", "Ada Author");
  assert.equal(removed.published.version, "0.3.2");
  assert.equal(removed.published.package.weeks[0].metadata.status, "planned");
  assert.equal(removed.published.package.weeks.length, 1);
  assert.equal(removed.published.package.activities.length, 1);
});

test("backend publish failure leaves recoverable draft and does not report Published", () => {
  const working = hostedWorkingCopy("0.3.0");
  const prepared = prepareWeekVisibilityPublish([working], working, "week-2", "post", "Ada Author");
  const publishing = withPlatformPublication(prepared.published, { platformPublicationState: "publishing" });
  const records = prepared.records.map((item) => (item.id === publishing.id ? publishing : item));
  const failed = withPlatformPublication(publishing, {
    platformPublicationState: "failed",
    platformPublicationError: "PUBLICATION_VERSION_REGRESSION",
  });
  const withFailed = records.map((item) => (item.id === failed.id ? failed : item));

  assert.notEqual(userLifecycleLabel(failed), USER_LIFECYCLE_LABELS.published);
  assert.equal(userLifecycleLabel(failed), "Platform publish failed");
  assert.equal(canPublishToPlatform(failed, true), true);

  const recovered = recoverFromFailedWeekVisibilityPublish(withFailed, failed, "Ada Author");
  assert.equal(recovered.draft.status, "draft");
  assert.equal(recovered.draft.platformPublicationState, "idle");
  assert.equal(recovered.draft.package.weeks[0].metadata.status, "available");
  assert.equal(recovered.records.some((item) => item.id === failed.id), false);

  const retry = prepareWeekVisibilityPublish(recovered.records, recovered.draft, "week-2", "post", "Ada Author");
  assert.equal(retry.published.version, "0.3.1");
  assert.match(weekVisibilityPlatformPublishFailureMessage("post"), /Make available again to retry/);
});

test("Post and Remove mutate week status only, preserving week graph", () => {
  const working = hostedWorkingCopy("0.3.0");
  const weekId = working.package.weeks[0].id;
  assert.equal(weekContentStatus(working.package.weeks[0]), "planned");

  const posted = prepareWeekVisibilityPublish([working], working, weekId, "post", "Ada Author");
  const postedWeek = posted.published.package.weeks.find((item) => item.id === weekId);
  assert.ok(postedWeek);
  assert.equal(weekContentStatus(postedWeek), "available");
  assert.equal(posted.published.package.weeks.length, working.package.weeks.length);
  assert.equal(posted.published.package.activities.length, working.package.activities.length);

  const onPlatform = withPlatformPublication(posted.published, {
    platformPublicationState: "published",
    platformPublishedAt: "2026-08-27T13:52:46.000Z",
    platformPublicationId: "pub-post",
  });
  const records = replaceRecord(posted.records, onPlatform);
  const removed = prepareWeekVisibilityPublish(records, onPlatform, weekId, "remove", "Ada Author");
  const removedWeek = removed.published.package.weeks.find((item) => item.id === weekId);
  assert.ok(removedWeek);
  assert.equal(weekContentStatus(removedWeek), "planned");
  assert.equal(removed.published.package.weeks.length, working.package.weeks.length);
  assert.equal(removed.published.package.activities.length, working.package.activities.length);
});

test("authoritative version never regresses below basedOnVersion or platform published version", () => {
  const working = hostedWorkingCopy("0.3.0");
  const stalePublished = {
    ...working,
    id: "stale-local",
    status: "published" as const,
    version: "0.1.0",
    platformPublicationState: "idle" as const,
  };

  const baseline = authoritativePublicationVersion([stalePublished], HUB, COURSE, {
    basedOnVersion: working.basedOnVersion,
  });
  assert.equal(baseline, "0.3.0");
  assert.equal(suggestNextVersion([stalePublished], HUB, COURSE, { basedOnVersion: working.basedOnVersion }), "0.3.1");

  const platformPublished = withPlatformPublication({
    ...stalePublished,
    version: "0.2.5",
  }, {
    platformPublicationState: "published",
    platformPublishedAt: "2026-08-01T00:00:00.000Z",
    platformPublicationId: "pub-old",
  });
  const fromPlatform = authoritativePublicationVersion([platformPublished], HUB, COURSE, {
    basedOnVersion: "0.3.0",
  });
  assert.equal(fromPlatform, "0.3.0");
});

test("stale local history uses hosted publication baseline for week visibility publish", () => {
  const pkg = hostedWorkingCopy("0.3.0").package;
  const stalePublished = withPlatformPublication({
    ...createDraft(HUB, "T Level Digital Software Development Hub", COURSE, "Ada Author"),
    status: "published",
    version: "0.1.0",
    package: pkg,
  }, {
    platformPublicationState: "published",
    platformPublishedAt: "2026-01-01T00:00:00.000Z",
    platformPublicationId: "stale",
  });
  const emptyDraft = createDraft(HUB, "T Level Digital Software Development Hub", COURSE, "Ada Author");
  emptyDraft.package = pkg;

  const withoutHosted = prepareWeekVisibilityPublish([stalePublished], emptyDraft, "week-2", "post", "Ada Author");
  assert.equal(withoutHosted.published.version, "0.1.1");

  const withHosted = prepareWeekVisibilityPublish(
    [stalePublished],
    emptyDraft,
    "week-2",
    "post",
    "Ada Author",
    { hostedPublicationVersion: "0.3.0" },
  );
  assert.equal(withHosted.published.version, "0.3.1");
  assert.equal(withHosted.published.basedOnVersion, "0.3.0");
  assert.equal(withHosted.published.package.weeks.find((week) => week.id === "week-2")?.metadata.status, "available");
});

test("resolveHostedPublicationVersion reads the active platform publication", () => {
  const version = resolveHostedPublicationVersion([
    {
      hubCode: HUB,
      courseKey: COURSE,
      packageVersion: "0.2.0",
      status: "superseded",
    },
    {
      hubCode: HUB,
      courseKey: COURSE,
      packageVersion: "0.3.0",
      status: "published",
    },
  ], HUB, COURSE);
  assert.equal(version, "0.3.0");
});
