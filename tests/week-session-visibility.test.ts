import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createActivity,
  createBlock,
  createSession,
  createWeek,
  emptyPackage,
  syncCurriculumLists,
} from "../src/content/factories.ts";
import {
  POST_WEEK_BEFORE_SESSIONS,
  postSessionAndPublishConfirm,
  sessionPostBlockedReason,
  sessionPostSuccessMessage,
  sessionRemoveSuccessMessage,
  sessionVisibilityRows,
  sessionsForWeek,
} from "../src/content/session-availability.ts";
import type { ContentDocument, ContentPackage } from "../src/content/types.ts";
import { createDraft } from "../src/content/versioning.ts";
import { canRunWeekVisibilityPublish, prepareSessionVisibilityPublish } from "../src/content/week-visibility-publish.ts";

const projects = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function documentsPackage(weeks: ContentDocument[], sessions: ContentDocument[]): ContentPackage {
  return { weeks, sessions } as ContentPackage;
}

function hubPackage(relative: string): ContentPackage {
  const raw = readJson(join(projects, relative));
  return documentsPackage(raw.weeks, raw.sessions);
}

function activityWithBlock(id: string, title: string) {
  const activity = createActivity({ id, title });
  activity.blocks = [createBlock(id, "paragraph", [])];
  return activity;
}

test("selected week shows only its sessions in curriculum order", () => {
  const pkg = emptyPackage("authoring-hub", "Authoring hub", "ocr-level-3-it");
  const week1 = createWeek({
    id: "week-1",
    teachingWeek: 1,
    title: "Week 1",
    status: "available",
    sessions: ["retrieval", "lesson", "homework"],
  });
  const week2 = createWeek({
    id: "week-2",
    teachingWeek: 2,
    title: "Week 2",
    status: "available",
    sessions: ["other"],
  });
  pkg.weeks.push(week1, week2);
  pkg.sessions.push(
    createSession({ id: "retrieval", title: "Retrieval", kind: "retrieval", weekId: "week-1", sortOrder: 1, status: "available" }),
    createSession({ id: "lesson", title: "Lesson", kind: "session", weekId: "week-1", sortOrder: 2, status: "planned" }),
    createSession({ id: "homework", title: "Homework", kind: "homework", weekId: "week-1", sortOrder: 3, status: "planned" }),
    createSession({ id: "other", title: "Other week", kind: "session", weekId: "week-2", status: "available" }),
  );
  const rows = sessionVisibilityRows(week1, sessionsForWeek(pkg, week1), true, false);
  assert.deepEqual(rows.map((row) => row.id), ["retrieval", "lesson", "homework"]);
  assert.equal(rows.some((row) => row.id === "other"), false);
});

test("available session shows Remove session & publish and planned shows Post session & publish", () => {
  const week = createWeek({ id: "week-1", teachingWeek: 1, title: "Week 1", status: "available", sessions: ["open", "closed"] });
  const open = createSession({ id: "open", title: "Open lesson", kind: "session", weekId: "week-1", status: "available" });
  const closed = createSession({ id: "closed", title: "Closed lesson", kind: "session", weekId: "week-1", status: "planned" });
  const rows = sessionVisibilityRows(week, [open, closed], true, false);
  assert.equal(rows[0]?.action, "remove");
  assert.equal(rows[1]?.action, "post");
  assert.equal(rows[0]?.disabled, false);
  assert.equal(rows[1]?.disabled, false);
});

test("session post is disabled when the parent week is planned", () => {
  const week = createWeek({ id: "week-1", teachingWeek: 1, title: "Week 1", status: "planned", sessions: ["lesson"] });
  const session = createSession({ id: "lesson", title: "Lesson 1", kind: "session", weekId: "week-1", status: "planned" });
  const rows = sessionVisibilityRows(week, [session], true, false);
  assert.equal(rows[0]?.action, "post");
  assert.equal(rows[0]?.disabled, true);
  assert.equal(sessionPostBlockedReason(session, week), POST_WEEK_BEFORE_SESSIONS);
});

test("busy state disables week and session publication buttons", () => {
  const week = createWeek({ id: "week-1", teachingWeek: 1, title: "Week 1", status: "available", sessions: ["open", "closed"] });
  const open = createSession({ id: "open", title: "Open", kind: "session", weekId: "week-1", status: "available" });
  const closed = createSession({ id: "closed", title: "Closed", kind: "session", weekId: "week-1", status: "planned" });
  const rows = sessionVisibilityRows(week, [open, closed], false, true);
  assert.ok(rows.every((row) => row.disabled));
  const draft = createDraft("authoring-hub", "Authoring hub", "ocr-level-3-it", "Ada Author");
  assert.equal(canRunWeekVisibilityPublish({ ...draft, platformPublicationState: "idle" }, true, true), false);
});

test("empty week shows a clear empty state", () => {
  const week = createWeek({ id: "week-9", teachingWeek: 9, title: "Empty week", status: "available", sessions: [] });
  const rows = sessionVisibilityRows(week, [], true, false);
  assert.deepEqual(rows, []);
});

test("changing selected week updates the visible session list", () => {
  const pkg = emptyPackage("authoring-hub", "Authoring hub", "ocr-level-3-it");
  const week1 = createWeek({ id: "week-1", teachingWeek: 1, title: "Week 1", status: "available", sessions: ["a"] });
  const week2 = createWeek({ id: "week-2", teachingWeek: 2, title: "Week 2", status: "available", sessions: ["b"] });
  pkg.weeks.push(week1, week2);
  pkg.sessions.push(
    createSession({ id: "a", title: "Session A", kind: "session", weekId: "week-1", status: "available" }),
    createSession({ id: "b", title: "Session B", kind: "independent-study", weekId: "week-2", status: "planned" }),
  );
  assert.deepEqual(sessionsForWeek(pkg, week1).map((item) => item.id), ["a"]);
  const week2Rows = sessionVisibilityRows(week2, sessionsForWeek(pkg, week2), true, false);
  assert.deepEqual(week2Rows.map((row) => row.id), ["b"]);
  assert.equal(week2Rows[0]?.kind, "independent study");
});

test("post session uses entityType session and action post on the shared path", () => {
  const draft = createDraft("authoring-hub", "Authoring hub", "ocr-level-3-it", "Ada Author");
  const week = createWeek({
    id: "week-1",
    teachingWeek: 1,
    title: "Week 1",
    status: "available",
    learningOutcomes: [],
    sessions: ["lesson-2"],
  });
  const session = createSession({
    id: "lesson-2",
    title: "Lesson 2",
    kind: "session",
    weekId: "week-1",
    activities: ["act-1"],
    status: "planned",
  });
  const ready = {
    ...draft,
    basedOnVersion: "0.3.0",
    package: syncCurriculumLists({
      ...draft.package,
      weeks: [week],
      sessions: [session],
      activities: [activityWithBlock("act-1", "A1")],
    }),
  };
  const posted = prepareSessionVisibilityPublish([ready], ready, "lesson-2", "post", "Ada Author");
  assert.equal(posted.entityType, "session");
  assert.equal(posted.sessionId, "lesson-2");
  assert.equal(posted.action, "post");
  assert.equal(posted.published.package.sessions[0]?.metadata.status, "available");
  assert.equal(sessionPostSuccessMessage("Lesson 2"), "Lesson 2 is available on the platform.");
  assert.match(postSessionAndPublishConfirm("Lesson 2: Market, problems and risks"), /Post "Lesson 2: Market, problems and risks" to the platform\?/);
});

test("remove session uses entityType session and action remove on the shared path", () => {
  const draft = createDraft("authoring-hub", "Authoring hub", "ocr-level-3-it", "Ada Author");
  const week = createWeek({
    id: "week-1",
    teachingWeek: 1,
    title: "Week 1",
    status: "available",
    learningOutcomes: [],
    sessions: ["lesson-2"],
  });
  const session = createSession({
    id: "lesson-2",
    title: "Lesson 2",
    kind: "session",
    weekId: "week-1",
    activities: ["act-1"],
    status: "available",
  });
  const ready = {
    ...draft,
    basedOnVersion: "0.3.0",
    package: syncCurriculumLists({
      ...draft.package,
      weeks: [week],
      sessions: [session],
      activities: [activityWithBlock("act-1", "A1")],
    }),
  };
  const removed = prepareSessionVisibilityPublish([ready], ready, "lesson-2", "remove", "Ada Author");
  assert.equal(removed.entityType, "session");
  assert.equal(removed.action, "remove");
  assert.equal(removed.published.package.sessions[0]?.metadata.status, "planned");
  assert.equal(sessionRemoveSuccessMessage("Lesson 2"), "Lesson 2 is hidden from learners.");
});

test("T Level Week 1 lists four sessions and mixed statuses", () => {
  const pkg = hubPackage("tlevel-software-development-hub/content/tlevel-software-development/package.json");
  const week = pkg.weeks.find((item) => item.id === "week-1");
  assert.ok(week);
  const sessions = sessionsForWeek(pkg, week);
  assert.deepEqual(sessions.map((item) => item.id), [
    "week-1-lesson-1",
    "week-1-lesson-2",
    "week-1-lesson-3",
    "week-1-homework",
  ]);
  sessions[0].metadata.status = "available";
  sessions[1].metadata.status = "planned";
  sessions[2].metadata.status = "planned";
  sessions[3].metadata.status = "planned";
  week.metadata.status = "available";
  const rows = sessionVisibilityRows(week, sessions, true, false);
  assert.equal(rows[0]?.title.includes("Annotating the client brief"), true);
  assert.equal(rows[1]?.title.includes("Market, problems and risks"), true);
  assert.equal(rows[3]?.kind, "homework");
  assert.equal(rows[0]?.action, "remove");
  assert.equal(rows[1]?.action, "post");
});

test("Unit 3 selected week lists actual session types without lesson-id assumptions", () => {
  const pkg = hubPackage("unit-3-Cyber-Security-Hub/content/unit-3-cyber-security/package.json");
  const week = pkg.weeks.find((item) => item.id === "week-2");
  assert.ok(week);
  const sessions = sessionsForWeek(pkg, week);
  assert.ok(sessions.length >= 2);
  const kinds = sessions.map((item) => String(item.metadata.kind));
  assert.ok(kinds.includes("session") || kinds.includes("retrieval"));
  const rows = sessionVisibilityRows(week, sessions, true, false);
  assert.equal(rows.some((row) => row.id.startsWith("week-1-lesson")), false);
  assert.deepEqual(rows.map((row) => row.id), sessions.map((item) => item.id));
});

test("Unit 14 selected week resolves related sessions from package relationships", () => {
  const weeks = readJson(join(projects, "unit-14-software-engineering-for-business-hub/content/unit-14/weeks.json"));
  const sessions = readJson(join(projects, "unit-14-software-engineering-for-business-hub/content/unit-14/sessions.json"));
  const pkg = documentsPackage(weeks, sessions);
  const week = pkg.weeks.find((item) => item.id === "week-1");
  assert.ok(week);
  const related = sessionsForWeek(pkg, week);
  assert.ok(related.length >= 1);
  assert.ok(related.every((session) => {
    const weekRel = String(session.relationships.week || "");
    const listed = Array.isArray(week.relationships.sessions) && week.relationships.sessions.includes(session.id);
    return weekRel === "week-1" || listed;
  }));
  const rows = sessionVisibilityRows(week, related, true, false);
  assert.equal(rows.length, related.length);
});

test("Emerging Digital Technologies one-session week renders cleanly", () => {
  const pkg = hubPackage("Emerging-Digital-Technologies-Hub/content/l2e-exploring-emerging-digital-technologies/package.json");
  const week = pkg.weeks.find((item) => item.id === "week-1");
  assert.ok(week);
  const sessions = sessionsForWeek(pkg, week);
  assert.equal(sessions.length, 1);
  const rows = sessionVisibilityRows(week, sessions, true, false);
  assert.deepEqual(rows.map((row) => row.id), ["week-1-session"]);
  assert.equal(rows[0]?.title, "Week 1 session");
});
