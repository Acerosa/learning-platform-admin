import assert from "node:assert/strict";
import test from "node:test";
import {
  createActivity,
  createBlock,
  createSession,
  createWeek,
  syncCurriculumLists,
} from "../src/content/factories.ts";
import type { ContentPackage } from "../src/content/types.ts";
import { createDraft, withPlatformPublication } from "../src/content/versioning.ts";
import {
  displayedCatalogueVersion,
  draftCatalogueBase,
  isTruncatedRelativeTo,
  isVisibilityDraftStale,
  packageCoverage,
  resolveVisibilityPublishDraft,
  shouldAutoHydrateVisibilityWorkspace,
  STALE_VISIBILITY_OPEN_PUBLISHED_MESSAGE,
} from "../src/content/visibility-publish-base.ts";
import {
  applySuccessfulVisibilityPublish,
  prepareSessionVisibilityPublish,
  WeekVisibilityPublishError,
} from "../src/content/week-visibility-publish.ts";
import { sessionContentStatus } from "../src/content/session-availability.ts";
import { findAuthoringRecordForContext } from "../src/content/authoring-context.ts";

const HUB = "hub-alpha";
const COURSE = "course-alpha";

function activityWithBlock(id: string, title: string) {
  const activity = createActivity({ id, title });
  activity.blocks = [createBlock(activity.id, "paragraph", [])];
  return activity;
}

function packageWithCounts(weeks: number, sessionsPerWeek: number, activitiesPerSession: number): ContentPackage {
  const weekDocs = [];
  const sessionDocs = [];
  const activityDocs = [];
  for (let weekIndex = 1; weekIndex <= weeks; weekIndex += 1) {
    const weekId = `week-${weekIndex}`;
    const sessionIds = [];
    for (let sessionIndex = 1; sessionIndex <= sessionsPerWeek; sessionIndex += 1) {
      const sessionId = `${weekId}-session-${sessionIndex}`;
      sessionIds.push(sessionId);
      const activityIds = [];
      for (let activityIndex = 1; activityIndex <= activitiesPerSession; activityIndex += 1) {
        const activityId = `${sessionId}-act-${activityIndex}`;
        activityIds.push(activityId);
        activityDocs.push(activityWithBlock(activityId, activityId));
      }
      sessionDocs.push(createSession({
        id: sessionId,
        title: sessionId,
        kind: sessionIndex === sessionsPerWeek ? "homework" : "session",
        weekId,
        activities: activityIds,
        status: weekIndex === 1 && sessionIndex === 1 ? "available" : "planned",
      }));
    }
    weekDocs.push(createWeek({
      id: weekId,
      teachingWeek: weekIndex,
      title: `Week ${weekIndex}`,
      status: weekIndex === 1 ? "available" : "planned",
      sessions: sessionIds,
    }));
  }
  const draft = createDraft(HUB, "Hub Alpha", COURSE, "Ada Author");
  return syncCurriculumLists({
    ...draft.package,
    hub: { ...draft.package.hub, id: HUB },
    curriculum: {
      ...draft.package.curriculum,
      metadata: { ...draft.package.curriculum.metadata, course: COURSE },
    },
    weeks: weekDocs,
    sessions: sessionDocs,
    activities: activityDocs,
  });
}

function draftFromPackage(pkg: ContentPackage, basedOnVersion: string | null) {
  const draft = createDraft(HUB, "Hub Alpha", COURSE, "Ada Author");
  return {
    ...draft,
    basedOnVersion,
    package: pkg,
  };
}

test("no published curriculum is not treated as a stale visibility base", () => {
  const draft = draftFromPackage(packageWithCounts(2, 2, 1), null);
  assert.equal(isVisibilityDraftStale(draft, null, null), false);
  const resolved = resolveVisibilityPublishDraft([draft], draft, "Ada Author", null);
  assert.equal(resolved.hydrated, false);
  assert.equal(resolved.draft.id, draft.id);
  assert.equal(resolved.blockedMessage, null);
});

test("editable draft based on an older catalogue is stale for visibility only", () => {
  const hosted = packageWithCounts(4, 3, 2);
  const stale = draftFromPackage(packageWithCounts(2, 2, 1), "0.2.0");
  assert.equal(isVisibilityDraftStale(stale, "0.4.0", hosted), true);
  assert.equal(draftCatalogueBase(stale), "0.2.0");
  const authoring = findAuthoringRecordForContext([stale], HUB, COURSE);
  assert.equal(authoring?.id, stale.id);
});

test("current draft matching published base is not stale", () => {
  const hosted = packageWithCounts(3, 2, 2);
  const current = draftFromPackage(hosted, "0.4.0");
  assert.equal(isVisibilityDraftStale(current, "0.4.0", hosted), false);
  const resolved = resolveVisibilityPublishDraft([current], current, "Ada Author", {
    packageVersion: "0.4.0",
    package: hosted,
  });
  assert.equal(resolved.hydrated, false);
  assert.equal(resolved.draft.id, current.id);
});

test("truncated coverage is stale even when basedOnVersion was stamped forward", () => {
  const hosted = packageWithCounts(5, 4, 2);
  const truncated = draftFromPackage(packageWithCounts(2, 2, 1), "0.4.0");
  assert.equal(isTruncatedRelativeTo(truncated.package, hosted), true);
  assert.equal(isVisibilityDraftStale(truncated, "0.4.0", hosted), true);
  const hostedCounts = packageCoverage(hosted);
  const draftCounts = packageCoverage(truncated.package);
  assert.ok(hostedCounts.weeks > draftCounts.weeks);
  assert.ok(hostedCounts.sessions > draftCounts.sessions);
  assert.ok(hostedCounts.activities > draftCounts.activities);
});

test("visibility publish hydrates the latest published package instead of a stale draft", () => {
  const hosted = packageWithCounts(3, 3, 1);
  const stale = draftFromPackage(packageWithCounts(1, 1, 1), "0.1.0");
  const resolved = resolveVisibilityPublishDraft([stale], stale, "Ada Author", {
    packageVersion: "0.4.0",
    package: hosted,
  });
  assert.equal(resolved.hydrated, true);
  assert.notEqual(resolved.draft.id, stale.id);
  assert.equal(resolved.draft.basedOnVersion, "0.4.0");
  assert.deepEqual(packageCoverage(resolved.draft.package), packageCoverage(hosted));
  assert.equal(resolved.records.some((item) => item.id === stale.id), true);
});

test("stale truncated package is never the visibility publish payload", () => {
  const hosted = packageWithCounts(3, 2, 2);
  const stale = draftFromPackage(packageWithCounts(1, 1, 1), "0.1.0");
  const target = hosted.sessions.find((item) => sessionContentStatus(item) === "planned");
  assert.ok(target);
  const result = prepareSessionVisibilityPublish([stale], stale, target.id, "post", "Ada Author", {
    hostedPublicationVersion: "0.4.0",
    hostedPackage: hosted,
  });
  assert.deepEqual(packageCoverage(result.published.package), packageCoverage(hosted));
  assert.equal(sessionContentStatus(result.published.package.sessions.find((item) => item.id === target.id)!), "available");
  const unchanged = result.published.package.sessions.filter((item) => item.id !== target.id);
  for (const session of unchanged) {
    const original = hosted.sessions.find((item) => item.id === session.id);
    assert.ok(original);
    assert.equal(sessionContentStatus(session), sessionContentStatus(original));
  }
  assert.equal(result.published.version, "0.4.1");
});

test("visibility publish without the hosted package blocks a stale draft", () => {
  const stale = draftFromPackage(packageWithCounts(1, 1, 1), "0.1.0");
  assert.throws(
    () => prepareSessionVisibilityPublish([stale], stale, stale.package.sessions[0].id, "post", "Ada Author", {
      hostedPublicationVersion: "0.4.0",
    }),
    (error: unknown) => error instanceof WeekVisibilityPublishError
      && error.message === STALE_VISIBILITY_OPEN_PUBLISHED_MESSAGE,
  );
  assert.equal(stale.package.weeks.length, 1);
});

test("concurrent newer publication is detected before visibility publish", () => {
  const olderHosted = packageWithCounts(2, 2, 1);
  const newerHosted = packageWithCounts(3, 2, 1);
  const working = draftFromPackage(olderHosted, "0.4.0");
  assert.equal(isVisibilityDraftStale(working, "0.4.1", newerHosted), true);
  const resolved = resolveVisibilityPublishDraft([working], working, "Ada Author", {
    packageVersion: "0.4.1",
    package: newerHosted,
  });
  assert.equal(resolved.hydrated, true);
  assert.equal(resolved.draft.basedOnVersion, "0.4.1");
  assert.equal(resolved.draft.package.weeks.length, 3);
});

test("successful visibility publish updates the active workspace version and session status", () => {
  const hosted = packageWithCounts(2, 2, 1);
  const working = draftFromPackage(hosted, "0.4.0");
  const target = hosted.sessions.find((item) => sessionContentStatus(item) === "planned");
  assert.ok(target);
  const prepared = prepareSessionVisibilityPublish([working], working, target.id, "post", "Ada Author", {
    hostedPublicationVersion: "0.4.0",
    hostedPackage: hosted,
  });
  const publishing = withPlatformPublication(prepared.published, { platformPublicationState: "publishing" });
  const records = prepared.records.map((item) => (item.id === publishing.id ? publishing : item));
  const succeeded = applySuccessfulVisibilityPublish(records, publishing, {
    id: "pub-new",
    publishedAt: "2026-09-07T12:00:00.000Z",
    idempotent: false,
  });
  assert.equal(succeeded.draft.id, publishing.id);
  assert.equal(succeeded.draft.version, "0.4.1");
  assert.equal(succeeded.draft.platformPublicationState, "published");
  assert.equal(succeeded.draft.platformPublicationId, "pub-new");
  assert.equal(sessionContentStatus(succeeded.draft.package.sessions.find((item) => item.id === target.id)!), "available");
  assert.equal(displayedCatalogueVersion("0.4.0", succeeded.draft), "0.4.1");
});

test("Weeks tab auto-hydrates only when the authoring draft is stale", () => {
  assert.equal(shouldAutoHydrateVisibilityWorkspace({
    tab: "weeks",
    stale: true,
    platformAvailable: true,
    hasPublishedLoader: true,
  }), true);
  assert.equal(shouldAutoHydrateVisibilityWorkspace({
    tab: "curriculum",
    stale: true,
    platformAvailable: true,
    hasPublishedLoader: true,
  }), false);
  assert.equal(shouldAutoHydrateVisibilityWorkspace({
    tab: "weeks",
    stale: false,
    platformAvailable: true,
    hasPublishedLoader: true,
  }), false);
});

test("hosted catalogue without a loaded package cannot be used as a visibility base", () => {
  const current = draftFromPackage(packageWithCounts(2, 2, 1), "0.4.0");
  const resolved = resolveVisibilityPublishDraft([current], current, "Ada Author", {
    packageVersion: "0.4.0",
  });
  assert.equal(resolved.blockedMessage, STALE_VISIBILITY_OPEN_PUBLISHED_MESSAGE);
  assert.equal(resolved.hydrated, false);
});
