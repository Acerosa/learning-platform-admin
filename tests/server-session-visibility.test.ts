import assert from "node:assert/strict";
import test from "node:test";
import {
  applyServerSessionVisibilitySuccess,
  operationalCatalogueVersion,
  sessionVisibilityRequest,
  sessionVisibilityStateAfterAttempt,
  sessionVisibilityStatusForAction,
  usesServerSessionVisibility,
} from "../src/content/server-session-visibility.ts";
import {
  createActivity,
  createBlock,
  createSession,
  createWeek,
  syncCurriculumLists,
} from "../src/content/factories.ts";
import { displayedCatalogueVersion } from "../src/content/visibility-publish-base.ts";
import { resolveWorkspaceForTab } from "../src/content/visibility-workspace.ts";
import { createDraft } from "../src/content/versioning.ts";
import { sessionContentStatus } from "../src/content/session-availability.ts";
import type { ContentPackage } from "../src/content/types.ts";

const HUBS = [
  { hubCode: "tlevel-software-development", courseKey: "t-level-digital-software-development" },
  { hubCode: "unit-3-cyber-security", courseKey: "ocr-level-3-it" },
  { hubCode: "unit-14-software-engineering-for-business", courseKey: "ocr-level-3-it" },
  { hubCode: "l2e-exploring-emerging-digital-technologies", courseKey: "gateway-level-2-digital-it-skills" },
] as const;

function publishedPackage(hubCode: string, courseKey: string, sessionStatus: "planned" | "available"): ContentPackage {
  const base = createDraft(hubCode, hubCode, courseKey, "Ada Author").package;
  const activity = createActivity({ id: "week-1-activity-1", title: "Activity 1" });
  activity.blocks = [createBlock(activity.id, "paragraph", [])];
  const session = createSession({
    id: "week-1-session-1",
    title: "Session 1",
    kind: "session",
    weekId: "week-1",
    activities: [activity.id],
    status: sessionStatus,
  });
  const week = createWeek({
    id: "week-1",
    teachingWeek: 1,
    title: "Week 1",
    status: "available",
    sessions: [session.id],
  });
  return syncCurriculumLists({
    ...base,
    hub: { ...base.hub, id: hubCode },
    curriculum: {
      ...base.curriculum,
      metadata: { ...base.curriculum.metadata, course: courseKey },
    },
    weeks: [week],
    sessions: [session],
    activities: [activity],
  });
}

function staleAuthoringDraft(hubCode: string, courseKey: string) {
  const draft = createDraft(hubCode, hubCode, courseKey, "Ada Author");
  draft.title = "Stale authoring draft";
  draft.package = publishedPackage(hubCode, courseKey, "planned");
  draft.package.weeks[0].metadata.title = "Local draft title that must survive";
  return draft;
}

function rpcResult(overrides: Partial<{
  packageVersion: string;
  previousPackageVersion: string;
  status: string;
  previousStatus: string;
  idempotent: boolean;
  sessionId: string;
}> = {}) {
  return {
    publicationId: "pub-next",
    previousPackageVersion: overrides.previousPackageVersion || "0.2.10",
    packageVersion: overrides.packageVersion || "0.2.11",
    sessionId: overrides.sessionId || "week-1-session-1",
    previousStatus: overrides.previousStatus || "planned",
    status: overrides.status || "available",
    idempotent: overrides.idempotent || false,
  };
}

test("live Admin uses server session visibility for every hub, with no product allowlist", () => {
  assert.equal(usesServerSessionVisibility({
    platformAvailable: true,
    hasSessionVisibilityRpc: true,
    hasPublishedPackageLoader: true,
  }), true);
  assert.equal(usesServerSessionVisibility({
    platformAvailable: false,
    hasSessionVisibilityRpc: true,
    hasPublishedPackageLoader: true,
  }), false);
  assert.equal(usesServerSessionVisibility({
    platformAvailable: true,
    hasSessionVisibilityRpc: false,
    hasPublishedPackageLoader: true,
  }), false);
});

test("post/remove map to available/planned without client version math", () => {
  assert.equal(sessionVisibilityStatusForAction("post"), "available");
  assert.equal(sessionVisibilityStatusForAction("remove"), "planned");
});

for (const hub of HUBS) {
  test(`${hub.hubCode} session release sends hub/course/session/status only`, () => {
    const request = sessionVisibilityRequest({
      hubCode: hub.hubCode,
      courseKey: hub.courseKey,
      sessionId: "week-1-session-1",
      action: "post",
    });
    assert.deepEqual(Object.keys(request).sort(), ["courseKey", "hubCode", "sessionId", "status"]);
    assert.equal(request.hubCode, hub.hubCode);
    assert.equal(request.courseKey, hub.courseKey);
    assert.equal(request.status, "available");
    assert.equal("package" in request, false);
    assert.equal("p_package" in request, false);
  });

  test(`${hub.hubCode} session release refreshes Weeks without overwriting the authoring draft`, () => {
    const authoring = staleAuthoringDraft(hub.hubCode, hub.courseKey);
    const records = [authoring];
    const published = publishedPackage(hub.hubCode, hub.courseKey, "available");
    published.weeks[0].metadata.title = "Published week title";
    const next = applyServerSessionVisibilitySuccess({
      authoringDraft: authoring,
      authoringRecords: records,
      publishedPackage: published,
      result: rpcResult(),
      actor: "Ada Author",
      action: "post",
      tab: "weeks",
      previewId: authoring.id,
    });

    assert.equal(next.authoringDraft, authoring);
    assert.equal(next.authoringRecords, records);
    assert.equal(next.authoringDraft.title, "Stale authoring draft");
    assert.equal(next.authoringDraft.package.weeks[0].metadata.title, "Local draft title that must survive");
    assert.equal(next.weeksWorkspace.packageVersion, "0.2.11");
    assert.equal(sessionContentStatus(next.weeksWorkspace.draft.package.sessions[0]), "available");
    assert.equal(next.activeDraft.id, next.weeksWorkspace.draft.id);
    assert.equal(next.previewId, authoring.id);
    assert.equal(next.catalogueVersion, "0.2.11");

    const curriculum = resolveWorkspaceForTab({
      tab: "curriculum",
      records: next.authoringRecords,
      workspace: next.weeksWorkspace,
      hubCode: hub.hubCode,
      courseKey: hub.courseKey,
      hubName: hub.hubCode,
      actor: "Ada Author",
      hostedPackageVersion: next.catalogueVersion,
    });
    assert.equal(curriculum.id, authoring.id);
    assert.equal(curriculum.package.weeks[0].metadata.title, "Local draft title that must survive");
  });
}

test("stale authoring draft cannot influence the session visibility request", () => {
  const authoring = staleAuthoringDraft("unit-3-cyber-security", "ocr-level-3-it");
  const request = sessionVisibilityRequest({
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    sessionId: "week-1-session-1",
    action: "remove",
  });
  assert.equal(JSON.stringify(request).includes("Local draft title"), false);
  assert.equal(JSON.stringify(request).includes(JSON.stringify(authoring.package)), false);
  assert.equal(request.status, "planned");
});

test("idempotent session release keeps the same catalogue version", () => {
  const authoring = staleAuthoringDraft("tlevel-software-development", "t-level-digital-software-development");
  const next = applyServerSessionVisibilitySuccess({
    authoringDraft: authoring,
    authoringRecords: [authoring],
    publishedPackage: publishedPackage("tlevel-software-development", "t-level-digital-software-development", "available"),
    result: rpcResult({
      previousPackageVersion: "0.3.34",
      packageVersion: "0.3.34",
      previousStatus: "available",
      status: "available",
      idempotent: true,
    }),
    actor: "Ada Author",
    action: "post",
    tab: "weeks",
    previewId: authoring.id,
  });
  assert.equal(next.catalogueVersion, "0.3.34");
  assert.match(next.message, /already available/);
  assert.match(next.message, /0\.3\.34/);
});

test("failed session release preserves prior visible state", () => {
  const authoring = staleAuthoringDraft("unit-14-software-engineering-for-business", "ocr-level-3-it");
  const workspace = applyServerSessionVisibilitySuccess({
    authoringDraft: authoring,
    authoringRecords: [authoring],
    publishedPackage: publishedPackage("unit-14-software-engineering-for-business", "ocr-level-3-it", "planned"),
    result: rpcResult({ packageVersion: "0.2.7", previousPackageVersion: "0.2.6" }),
    actor: "Ada Author",
    action: "post",
    tab: "weeks",
    previewId: authoring.id,
  }).weeksWorkspace;
  const prior = {
    authoringDraft: authoring,
    authoringRecords: [authoring] as const,
    weeksWorkspace: workspace,
    previewId: authoring.id,
  };
  const afterError = sessionVisibilityStateAfterAttempt(prior, { ok: false });
  assert.equal(afterError, prior);
  assert.equal(afterError.authoringDraft.title, "Stale authoring draft");
  assert.equal(afterError.weeksWorkspace.packageVersion, "0.2.7");
});

test("catalogue label uses the new published workspace version", () => {
  assert.equal(operationalCatalogueVersion("0.2.10", "0.2.11"), "0.2.11");
  const authoring = staleAuthoringDraft("l2e-exploring-emerging-digital-technologies", "gateway-level-2-digital-it-skills");
  assert.equal(
    displayedCatalogueVersion(operationalCatalogueVersion("0.3.9", "0.3.10"), authoring),
    "0.3.10",
  );
});

test("current published session status remains authoritative after success", () => {
  const authoring = staleAuthoringDraft("tlevel-software-development", "t-level-digital-software-development");
  authoring.package.sessions[0].metadata.status = "planned";
  const published = publishedPackage("tlevel-software-development", "t-level-digital-software-development", "available");
  const next = applyServerSessionVisibilitySuccess({
    authoringDraft: authoring,
    authoringRecords: [authoring],
    publishedPackage: published,
    result: rpcResult({ packageVersion: "0.3.35", previousPackageVersion: "0.3.34" }),
    actor: "Ada Author",
    action: "post",
    tab: "weeks",
    previewId: authoring.id,
  });
  assert.equal(sessionContentStatus(authoring.package.sessions[0]), "planned");
  assert.equal(sessionContentStatus(next.weeksWorkspace.draft.package.sessions[0]), "available");
  assert.equal(sessionContentStatus(next.activeDraft.package.sessions[0]), "available");
});
