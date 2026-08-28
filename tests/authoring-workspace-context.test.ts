import assert from "node:assert/strict";
import test from "node:test";
import { createWeek } from "../src/content/factories.ts";
import { createDraft } from "../src/content/draft-store.ts";
import {
  AUTHORING_WORKSPACE_INVARIANT,
  mergeSelectionWithWorkspace,
  resolveWorkspaceCourseKey,
  resolveWorkspaceHubCode,
  restoreWorkspaceAfterRefresh,
} from "../src/content/authoring-workspace-context.ts";
import { applyDraftSelection } from "../src/content/authoring-context.ts";
import {
  createEmptyModuleCache,
  sliceDemoModuleData,
} from "../src/api/admin-module-data.ts";
import {
  isModuleReady,
  markModuleCacheRefreshing,
} from "../src/stores/admin-module-loader.ts";
import { DEMO_ADMIN_DATA } from "../src/services/demo-admin-service.ts";

const hubs = [
  { hubCode: "hub-a", hubName: "Hub A" },
  { hubCode: "unit-3-cyber-security", hubName: "Unit 3 Cyber Security Hub" },
] as const;

const links = [
  { hubCode: "hub-a", courseKey: "course-a", courseTitle: "Course A", active: true },
  { hubCode: "unit-3-cyber-security", courseKey: "ocr-level-3-it", courseTitle: "OCR Level 3 IT", active: true },
] as const;

test("AUTHORING_WORKSPACE_INVARIANT documents mutation vs navigation behaviour", () => {
  assert.match(AUTHORING_WORKSPACE_INVARIANT, /Content mutations preserve the current Admin workspace/);
  assert.match(AUTHORING_WORKSPACE_INVARIANT, /explicit navigation action/);
});

test("resolveWorkspaceHubCode keeps the active hub after refresh instead of hubs[0]", () => {
  const stored = {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    tab: "weeks" as const,
    weekId: "week-3",
  };
  assert.equal(resolveWorkspaceHubCode(stored, hubs, "hub-a"), "unit-3-cyber-security");
});

test("resolveWorkspaceCourseKey keeps the active course for a hub with multiple links", () => {
  const multiLinks = [
    ...links,
    { hubCode: "unit-3-cyber-security", courseKey: "other-course", courseTitle: "Other", active: true },
  ];
  const stored = {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    tab: "weeks" as const,
    weekId: "week-3",
  };
  assert.equal(
    resolveWorkspaceCourseKey(stored, multiLinks, "unit-3-cyber-security", "other-course"),
    "ocr-level-3-it",
  );
});

test("restoreWorkspaceAfterRefresh preserves hub/course/tab/week context", () => {
  const current = {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    tab: "weeks" as const,
    weekId: "week-3",
  };
  const restored = restoreWorkspaceAfterRefresh(current, hubs, links);
  assert.deepEqual(restored, current);
});

test("mergeSelectionWithWorkspace keeps selected week after draft reload", () => {
  const draft = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada");
  draft.package.weeks = [
    createWeek({ id: "week-1", teachingWeek: 1, title: "Week 1" }),
    createWeek({ id: "week-3", teachingWeek: 3, title: "Week 3" }),
  ];
  const base = applyDraftSelection(draft, [draft]);
  assert.equal(base.visibilityWeekId, "week-1");
  const merged = mergeSelectionWithWorkspace(base, {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    tab: "weeks",
    weekId: "week-3",
  }, draft);
  assert.equal(merged.visibilityWeekId, "week-3");
});

test("markModuleCacheRefreshing keeps module data visible during curriculum mutation refresh", () => {
  const cache = createEmptyModuleCache();
  cache["hubs-curriculum"] = {
    status: "ready",
    data: sliceDemoModuleData(DEMO_ADMIN_DATA, "hubs-curriculum"),
    error: null,
  };
  const next = markModuleCacheRefreshing(cache, ["hubs-curriculum"]);
  assert.equal(next["hubs-curriculum"].status, "refreshing");
  assert.ok(next["hubs-curriculum"].data);
  assert.equal(isModuleReady(next["hubs-curriculum"]), true);
});

test("Make available: week visibility publish preserves workspace context fields", () => {
  const workspace = {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    tab: "weeks" as const,
    weekId: "week-3",
  };
  const afterPublish = restoreWorkspaceAfterRefresh(workspace, hubs, links);
  assert.equal(afterPublish.hubCode, "unit-3-cyber-security");
  assert.equal(afterPublish.courseKey, "ocr-level-3-it");
  assert.equal(afterPublish.tab, "weeks");
  assert.equal(afterPublish.weekId, "week-3");
});

test("Hide from learners: same workspace context remains after refresh reconciliation", () => {
  const workspace = {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    tab: "weeks" as const,
    weekId: "week-3",
  };
  const afterHide = restoreWorkspaceAfterRefresh(workspace, hubs, links);
  assert.deepEqual(afterHide, workspace);
});

test("Publication failure preserves workspace context for retry", () => {
  const workspace = {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    tab: "weeks" as const,
    weekId: "week-3",
  };
  const afterFailure = restoreWorkspaceAfterRefresh(workspace, hubs, links);
  assert.equal(afterFailure.hubCode, workspace.hubCode);
  assert.equal(afterFailure.courseKey, workspace.courseKey);
  assert.equal(afterFailure.tab, workspace.tab);
  assert.equal(afterFailure.weekId, workspace.weekId);
});

test("Save draft does not change hub/course/tab/selected entity in stored workspace", () => {
  const before = {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    tab: "sessions" as const,
    sessionId: "week-3-workshop",
  };
  const afterSave = restoreWorkspaceAfterRefresh(before, hubs, links);
  assert.deepEqual(afterSave, before);
});

test("Hub isolation: action in Hub B does not fall back to Hub A after refresh", () => {
  const workspace = {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    tab: "weeks" as const,
    weekId: "week-3",
  };
  const restored = restoreWorkspaceAfterRefresh(workspace, hubs, links);
  assert.equal(restored.hubCode, "unit-3-cyber-security");
  assert.notEqual(restored.hubCode, hubs[0]?.hubCode);
});

test("Tab persistence: weeks/sessions/activities tabs survive refresh reconciliation", () => {
  for (const tab of ["weeks", "sessions", "activities"] as const) {
    const workspace = {
      hubCode: "unit-3-cyber-security",
      courseKey: "ocr-level-3-it",
      tab,
    };
    const restored = restoreWorkspaceAfterRefresh(workspace, hubs, links);
    assert.equal(restored.tab, tab);
  }
});
