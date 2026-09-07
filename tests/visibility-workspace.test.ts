import assert from "node:assert/strict";
import test from "node:test";
import {
  createActivity,
  createBlock,
  createSession,
  createWeek,
  syncCurriculumLists,
} from "../src/content/factories.ts";
import { sessionContentStatus } from "../src/content/session-availability.ts";
import type { ContentPackage } from "../src/content/types.ts";
import {
  displayedCatalogueVersion,
  shouldAutoHydrateVisibilityWorkspace,
} from "../src/content/visibility-publish-base.ts";
import {
  createPublishedWeeksWorkspace,
  isCurrentPublishedWeeksWorkspace,
  isStaleRemoteDraftForCurrentWeeksWorkspace,
  resolveWorkspaceForTab,
  shouldActivateRemoteDraft,
  shouldStartVisibilityHydration,
  visibilityHydrateKeyAfterAttempt,
  visibilityWorkspaceKey,
} from "../src/content/visibility-workspace.ts";
import {
  applySuccessfulVisibilityPublish,
  prepareSessionVisibilityPublish,
} from "../src/content/week-visibility-publish.ts";
import {
  createDraft,
  createWorkingCopyFromPackage,
  withPlatformPublication,
} from "../src/content/versioning.ts";

const HUB = "hub-race";
const COURSE = "course-race";
const ACTOR = "Ada Author";

function packageWithCounts(
  weekCount: number,
  sessionsPerWeek: number,
  activitiesPerSession: number,
): ContentPackage {
  const base = createDraft(HUB, "Hub Race", COURSE, ACTOR).package;
  const weeks = [];
  const sessions = [];
  const activities = [];
  for (let weekIndex = 1; weekIndex <= weekCount; weekIndex += 1) {
    const weekId = `week-${weekIndex}`;
    const sessionIds = [];
    for (let sessionIndex = 1; sessionIndex <= sessionsPerWeek; sessionIndex += 1) {
      const sessionId = `${weekId}-lesson-${sessionIndex}`;
      const activityIds = [];
      for (let activityIndex = 1; activityIndex <= activitiesPerSession; activityIndex += 1) {
        const activityId = `${sessionId}-activity-${activityIndex}`;
        const activity = createActivity({ id: activityId, title: activityId });
        activity.blocks = [createBlock(activityId, "paragraph", [])];
        activities.push(activity);
        activityIds.push(activityId);
      }
      sessions.push(createSession({
        id: sessionId,
        title: sessionId,
        kind: "session",
        weekId,
        activities: activityIds,
        status: weekIndex === 1 && sessionIndex === 1 ? "available" : "planned",
      }));
      sessionIds.push(sessionId);
    }
    weeks.push(createWeek({
      id: weekId,
      teachingWeek: weekIndex,
      title: `Week ${weekIndex}`,
      status: weekIndex === 1 ? "available" : "planned",
      sessions: sessionIds,
    }));
  }
  return syncCurriculumLists({ ...base, weeks, sessions, activities });
}

function draftFromPackage(pkg: ContentPackage, basedOnVersion: string) {
  return {
    ...createDraft(HUB, "Hub Race", COURSE, ACTOR),
    basedOnVersion,
    package: pkg,
  };
}

test("remote drafts loaded before Weeks hydration are active only until published hydration wins", () => {
  const stale = draftFromPackage(packageWithCounts(2, 2, 1), "0.2.0");
  assert.equal(shouldActivateRemoteDraft({
    tab: "weeks",
    workspace: null,
    candidate: stale,
    hubCode: HUB,
    courseKey: COURSE,
    hostedPackageVersion: "0.5.0",
  }), true);

  const publishedDraft = createWorkingCopyFromPackage(packageWithCounts(5, 3, 2), ACTOR, "0.5.0");
  const workspace = createPublishedWeeksWorkspace(publishedDraft, "0.5.0");
  const active = resolveWorkspaceForTab({
    tab: "weeks",
    records: [stale],
    workspace,
    hubCode: HUB,
    courseKey: COURSE,
    hubName: "Hub Race",
    actor: ACTOR,
    hostedPackageVersion: "0.5.0",
  });
  assert.equal(active.id, publishedDraft.id);
  assert.equal(active.package.weeks.length, 5);
  assert.equal(active.package.sessions.length, 15);
});

test("remote drafts loaded after Weeks hydration cannot overwrite the current published workspace", () => {
  const hosted = packageWithCounts(4, 3, 2);
  const publishedDraft = createWorkingCopyFromPackage(hosted, ACTOR, "0.5.0");
  const workspace = createPublishedWeeksWorkspace(publishedDraft, "0.5.0");
  const stale = draftFromPackage(packageWithCounts(1, 2, 1), "0.2.0");
  const input = {
    tab: "weeks",
    workspace,
    candidate: stale,
    hubCode: HUB,
    courseKey: COURSE,
    hostedPackageVersion: "0.5.0",
  } as const;

  assert.equal(isStaleRemoteDraftForCurrentWeeksWorkspace(input), true);
  assert.equal(shouldActivateRemoteDraft(input), false);
  assert.equal(workspace.draft.package.activities.length, hosted.activities.length);
});

test("Weeks owns published content even when an editable remote is based on the same catalogue", () => {
  const hosted = packageWithCounts(3, 2, 2);
  const workspace = createPublishedWeeksWorkspace(
    createWorkingCopyFromPackage(hosted, ACTOR, "0.5.0"),
    "0.5.0",
  );
  const currentRemote = draftFromPackage(hosted, "0.5.0");
  assert.equal(shouldActivateRemoteDraft({
    tab: "weeks",
    workspace,
    candidate: currentRemote,
    hubCode: HUB,
    courseKey: COURSE,
    hostedPackageVersion: "0.5.0",
  }), false);
});

test("successful visibility publish remains active across a stale remote refresh", () => {
  const hosted = packageWithCounts(3, 2, 1);
  const working = createWorkingCopyFromPackage(hosted, ACTOR, "0.5.0");
  const target = working.package.sessions.find((session) => sessionContentStatus(session) === "planned");
  assert.ok(target);
  const prepared = prepareSessionVisibilityPublish([working], working, target.id, "post", ACTOR, {
    hostedPublicationVersion: "0.5.0",
    hostedPackage: hosted,
  });
  const publishing = withPlatformPublication(prepared.published, { platformPublicationState: "publishing" });
  const succeeded = applySuccessfulVisibilityPublish(prepared.records, publishing, {
    id: "publication-new",
    publishedAt: "2026-09-07T14:12:00.000Z",
    idempotent: false,
  });
  const workspace = createPublishedWeeksWorkspace(succeeded.draft, succeeded.draft.version);
  const stale = draftFromPackage(packageWithCounts(1, 1, 1), "0.2.0");

  assert.equal(sessionContentStatus(
    workspace.draft.package.sessions.find((session) => session.id === target.id)!,
  ), "available");
  assert.equal(shouldActivateRemoteDraft({
    tab: "weeks",
    workspace,
    candidate: stale,
    hubCode: HUB,
    courseKey: COURSE,
    hostedPackageVersion: "0.5.0",
  }), false);
  assert.equal(displayedCatalogueVersion("0.5.0", workspace.draft), succeeded.draft.version);
});

test("Curriculum to Weeks selects published; Weeks to Curriculum restores draft-first authoring", () => {
  const stale = draftFromPackage(packageWithCounts(2, 2, 1), "0.2.0");
  const workspace = createPublishedWeeksWorkspace(
    createWorkingCopyFromPackage(packageWithCounts(5, 3, 1), ACTOR, "0.5.0"),
    "0.5.0",
  );
  const common = {
    records: [stale, workspace.draft],
    workspace,
    hubCode: HUB,
    courseKey: COURSE,
    hubName: "Hub Race",
    actor: ACTOR,
    hostedPackageVersion: "0.5.0",
  } as const;
  assert.equal(resolveWorkspaceForTab({ ...common, tab: "weeks" }).id, workspace.draft.id);
  assert.equal(resolveWorkspaceForTab({ ...common, tab: "curriculum" }).id, stale.id);
  assert.equal(resolveWorkspaceForTab({ ...common, tab: "activities" }).id, stale.id);
});

test("leaving Weeks without an older authoring draft creates a working copy of published content", () => {
  const workspace = createPublishedWeeksWorkspace(
    createWorkingCopyFromPackage(packageWithCounts(4, 2, 1), ACTOR, "0.5.0"),
    "0.5.0",
  );
  const authoring = resolveWorkspaceForTab({
    tab: "curriculum",
    records: [workspace.draft],
    workspace,
    hubCode: HUB,
    courseKey: COURSE,
    hubName: "Hub Race",
    actor: ACTOR,
    hostedPackageVersion: "0.5.0",
  });
  assert.notEqual(authoring.id, workspace.draft.id);
  assert.equal(authoring.basedOnVersion, "0.5.0");
  assert.equal(authoring.package.weeks.length, workspace.draft.package.weeks.length);
});

test("Weeks hydration waits for remote draft loading to settle", () => {
  const base = {
    tab: "weeks",
    workspaceCurrent: false,
    platformAvailable: true,
    hasPublishedLoader: true,
  } as const;
  assert.equal(shouldAutoHydrateVisibilityWorkspace({ ...base, remoteDraftsSettled: false }), false);
  assert.equal(shouldAutoHydrateVisibilityWorkspace({ ...base, remoteDraftsSettled: true }), true);
  assert.equal(shouldAutoHydrateVisibilityWorkspace({ ...base, workspaceCurrent: true }), false);
});

test("visibility hydrate key is committed only after success and failure remains retryable", () => {
  const key = visibilityWorkspaceKey(HUB, COURSE, "0.5.0");
  let completedKey = "";
  assert.equal(shouldStartVisibilityHydration(completedKey, "", key), true);
  completedKey = visibilityHydrateKeyAfterAttempt(completedKey, key, false);
  assert.equal(completedKey, "");
  assert.equal(shouldStartVisibilityHydration(completedKey, "", key), true);
  completedKey = visibilityHydrateKeyAfterAttempt(completedKey, key, true);
  assert.equal(completedKey, key);
  assert.equal(shouldStartVisibilityHydration(completedKey, "", key), false);
});

test("a concurrent newer catalogue invalidates an older Weeks workspace", () => {
  const older = createPublishedWeeksWorkspace(
    createWorkingCopyFromPackage(packageWithCounts(3, 2, 1), ACTOR, "0.5.0"),
    "0.5.0",
  );
  assert.equal(isCurrentPublishedWeeksWorkspace(older, HUB, COURSE, "0.5.1"), false);
  assert.equal(shouldAutoHydrateVisibilityWorkspace({
    tab: "weeks",
    workspaceCurrent: false,
    remoteDraftsSettled: true,
    platformAvailable: true,
    hasPublishedLoader: true,
  }), true);
});

test("without a hosted publication the existing draft-first behaviour is preserved", () => {
  const stale = draftFromPackage(packageWithCounts(2, 1, 1), "0.2.0");
  const oldWorkspace = createPublishedWeeksWorkspace(
    createWorkingCopyFromPackage(packageWithCounts(3, 1, 1), ACTOR, "0.4.0"),
    "0.4.0",
  );
  assert.equal(shouldActivateRemoteDraft({
    tab: "weeks",
    workspace: oldWorkspace,
    candidate: stale,
    hubCode: HUB,
    courseKey: COURSE,
    hostedPackageVersion: null,
  }), true);
  assert.equal(resolveWorkspaceForTab({
    tab: "weeks",
    records: [stale],
    workspace: oldWorkspace,
    hubCode: HUB,
    courseKey: COURSE,
    hubName: "Hub Race",
    actor: ACTOR,
    hostedPackageVersion: null,
  }).id, stale.id);
});
