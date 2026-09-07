import assert from "node:assert/strict";
import test from "node:test";
import { createActivity, createBlock, createSession, createWeek, syncCurriculumLists } from "../src/content/factories.ts";
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
import { POST_WEEK_BEFORE_SESSIONS, sessionContentStatus } from "../src/content/session-availability.ts";
import {
  prepareSessionVisibilityPublish,
  prepareWeekVisibilityPublish,
  recoverFromFailedWeekVisibilityPublish,
  weekVisibilityPlatformPublishFailureMessage,
  WeekVisibilityPublishError,
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

  assert.throws(
    () => prepareWeekVisibilityPublish(
      [stalePublished],
      emptyDraft,
      "week-2",
      "post",
      "Ada Author",
      { hostedPublicationVersion: "0.3.0" },
    ),
    (error: unknown) => error instanceof WeekVisibilityPublishError
      && /older than the current published curriculum/i.test(error.message),
  );

  const withHosted = prepareWeekVisibilityPublish(
    [stalePublished],
    emptyDraft,
    "week-2",
    "post",
    "Ada Author",
    { hostedPublicationVersion: "0.3.0", hostedPackage: pkg },
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

function activityWithBlock(id: string, title: string) {
  const activity = createActivity({ id, title });
  activity.blocks = [createBlock(activity.id, "paragraph", [])];
  return activity;
}

function weekWithSessions(weekStatus = "available") {
  const draft = createDraft(HUB, "T Level Digital Software Development Hub", COURSE, "Ada Author");
  const week = createWeek({
    id: "week-1",
    teachingWeek: 1,
    title: "Client Brief",
    status: weekStatus,
    learningOutcomes: [],
    sessions: ["lesson-1", "lesson-2", "homework"],
  });
  const lesson1 = createSession({
    id: "lesson-1",
    title: "Annotating the client brief",
    kind: "session",
    weekId: "week-1",
    activities: ["act-1"],
    status: "available",
  });
  const lesson2 = createSession({
    id: "lesson-2",
    title: "Market, problems and risks",
    kind: "session",
    weekId: "week-1",
    activities: ["act-2"],
    status: "planned",
  });
  const homework = createSession({
    id: "homework",
    title: "Homework: one real digital product",
    kind: "homework",
    weekId: "week-1",
    activities: ["act-3"],
    status: "planned",
  });
  return {
    ...draft,
    basedOnVersion: "0.3.0",
    package: syncCurriculumLists({
      ...draft.package,
      hub: { ...draft.package.hub, id: HUB },
      curriculum: {
        ...draft.package.curriculum,
        metadata: { ...draft.package.curriculum.metadata, course: COURSE },
      },
      weeks: [week],
      sessions: [lesson1, lesson2, homework],
      activities: [
        activityWithBlock("act-1", "Starter"),
        activityWithBlock("act-2", "Market"),
        activityWithBlock("act-3", "Homework"),
      ],
    }),
  };
}

test("post session changes only the selected session and publishes a new version", () => {
  const working = weekWithSessions();
  const result = prepareSessionVisibilityPublish([working], working, "lesson-2", "post", "Ada Author");
  assert.equal(result.published.version, "0.3.1");
  assert.equal(sessionContentStatus(result.published.package.sessions.find((item) => item.id === "lesson-1")!), "available");
  assert.equal(sessionContentStatus(result.published.package.sessions.find((item) => item.id === "lesson-2")!), "available");
  assert.equal(sessionContentStatus(result.published.package.sessions.find((item) => item.id === "homework")!), "planned");
  assert.equal(result.published.package.sessions.length, 3);
  assert.equal(result.published.package.activities.length, 3);
  assert.equal(result.entityType, "session");
  assert.equal(result.sessionId, "lesson-2");
  assert.equal(result.action, "post");
  assert.match(result.published.approvalNotes, /Session visibility: post lesson-2/);
});

test("remove session marks it planned without deleting content", () => {
  const working = weekWithSessions();
  const posted = prepareSessionVisibilityPublish([working], working, "lesson-2", "post", "Ada Author");
  const onPlatform = withPlatformPublication(posted.published, {
    platformPublicationState: "published",
    platformPublishedAt: "2026-08-27T13:52:46.000Z",
    platformPublicationId: "pub-session",
  });
  const records = replaceRecord(posted.records, onPlatform);
  const removed = prepareSessionVisibilityPublish(records, onPlatform, "lesson-2", "remove", "Ada Author");
  assert.equal(removed.published.version, "0.3.2");
  assert.equal(sessionContentStatus(removed.published.package.sessions.find((item) => item.id === "lesson-2")!), "planned");
  assert.equal(removed.published.package.sessions.some((item) => item.id === "lesson-2"), true);
  assert.equal(removed.published.package.activities.some((item) => item.id === "act-2"), true);
});

test("session visibility publish from a published snapshot creates a working copy first", () => {
  const working = weekWithSessions();
  const first = prepareSessionVisibilityPublish([working], working, "lesson-2", "post", "Ada Author");
  const onPlatform = withPlatformPublication(first.published, {
    platformPublicationState: "published",
    platformPublishedAt: "2026-08-27T13:52:46.000Z",
    platformPublicationId: "pub-session-1",
  });
  const records = replaceRecord(first.records, onPlatform);
  const second = prepareSessionVisibilityPublish(records, onPlatform, "homework", "post", "Ada Author");
  assert.notEqual(second.published.id, onPlatform.id);
  assert.equal(second.published.version, "0.3.2");
  assert.equal(sessionContentStatus(second.published.package.sessions.find((item) => item.id === "homework")!), "available");
});

test("parent planned week prevents session visibility publish", () => {
  const working = weekWithSessions("planned");
  assert.throws(
    () => prepareSessionVisibilityPublish([working], working, "lesson-2", "post", "Ada Author"),
    (error: unknown) => error instanceof WeekVisibilityPublishError && error.message === POST_WEEK_BEFORE_SESSIONS,
  );
  assert.equal(sessionContentStatus(working.package.sessions.find((item) => item.id === "lesson-2")!), "planned");
});

test("session visibility publish blocks when validation fails", () => {
  const invalid = weekWithSessions();
  invalid.package.weeks.push(invalid.package.weeks[0]);
  assert.throws(
    () => prepareSessionVisibilityPublish([invalid], invalid, "lesson-2", "post", "Ada Author"),
    WeekVisibilityPublishError,
  );
});

test("week posting still works alongside session posting", () => {
  const working = weekWithSessions("planned");
  const postedWeek = prepareWeekVisibilityPublish([working], working, "week-1", "post", "Ada Author");
  assert.equal(weekContentStatus(postedWeek.published.package.weeks[0]), "available");
  const onPlatform = withPlatformPublication(postedWeek.published, {
    platformPublicationState: "published",
    platformPublishedAt: "2026-08-27T13:52:46.000Z",
    platformPublicationId: "pub-week",
  });
  const records = replaceRecord(postedWeek.records, onPlatform);
  const postedSession = prepareSessionVisibilityPublish(records, onPlatform, "lesson-2", "post", "Ada Author");
  assert.equal(sessionContentStatus(postedSession.published.package.sessions.find((item) => item.id === "lesson-2")!), "available");
  assert.equal(weekContentStatus(postedSession.published.package.weeks[0]), "available");
});
