import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PANE_FILTERS } from "../src/analytics/scope.ts";
import {
  QUESTION_LABEL_GAP,
  READINESS_COURSE_KEY,
  diagnosticOverview,
  filterDiagnosticSessions,
  formatCompletionRate,
  groupResponsesByUnit,
  hasAuthoritativeCorrectness,
  questionDistributions,
} from "../src/analytics/diagnostic.ts";
import { ADMIN_API_VIEWS } from "../src/api/admin-api.ts";
import { DEMO_ADMIN_DATA } from "../src/services/demo-admin-service.ts";

const root = new URL("../", import.meta.url);

test("Readiness Diagnostic is an Analytics pane, not a new top-level module", async () => {
  assert.ok("readiness-diagnostic" in PANE_FILTERS);
  assert.equal(PANE_FILTERS["readiness-diagnostic"].size, 0);
  const [analytics, modules] = await Promise.all([
    readFile(new URL("src/views/analytics.tsx", root), "utf8"),
    readFile(new URL("src/router/modules.ts", root), "utf8"),
  ]);
  assert.match(analytics, /Readiness Diagnostic/);
  assert.match(analytics, /readiness-diagnostic/);
  assert.doesNotMatch(modules, /id: "readiness-diagnostic"/);
});

test("admin data access uses the diagnostic admin_api views", () => {
  assert.equal(ADMIN_API_VIEWS.diagnosticSessions, "admin_api.diagnostic_sessions");
  assert.equal(ADMIN_API_VIEWS.diagnosticResponses, "admin_api.diagnostic_responses");
  assert.equal(ADMIN_API_VIEWS.diagnosticSummary, "admin_api.diagnostic_summary");
});

test("demo summary uses diagnostic indicators without inventing a score", () => {
  const overview = diagnosticOverview(
    DEMO_ADMIN_DATA.diagnosticSummary,
    DEMO_ADMIN_DATA.diagnosticSessions,
  );
  assert.ok(overview);
  assert.equal(overview.courseKey, READINESS_COURSE_KEY);
  assert.equal(overview.startedCount, 2);
  assert.equal(overview.completedCount, 1);
  assert.equal(overview.completionPercentage, 50);
  assert.equal(overview.responseCount, 5);
  assert.equal(overview.notSureCount, 2);
  assert.equal(formatCompletionRate(overview.notSurePercentage), "40%");
});

test("session list fields include learner-entered name, ID and completion state", async () => {
  const sessions = DEMO_ADMIN_DATA.diagnosticSessions;
  assert.equal(sessions[0]?.studentName, "Alex Rivera");
  assert.equal(sessions[0]?.studentId, "STU1001");
  assert.equal(sessions[0]?.status, "completed");
  assert.equal(sessions[1]?.studentName, "Jordan Blake");
  assert.equal(sessions[1]?.status, "started");
  const source = await readFile(new URL("src/views/readiness-diagnostic.tsx", root), "utf8");
  assert.match(source, /Learner-entered identifiers/);
  assert.match(source, /Readiness \/ diagnostic indicators, not assessment results/);
  assert.match(source, /Student name/);
  assert.match(source, /Student ID/);
  assert.match(source, /Not sure/);
  assert.doesNotMatch(source, /pass\/fail|attainment|readiness score|average readiness/i);
});

test("incomplete filter hides completed sittings", () => {
  const incomplete = filterDiagnosticSessions(DEMO_ADMIN_DATA.diagnosticSessions, {
    status: "incomplete",
    query: "",
  });
  assert.equal(incomplete.length, 1);
  assert.equal(incomplete[0]?.studentId, "STU1002");
  const named = filterDiagnosticSessions(DEMO_ADMIN_DATA.diagnosticSessions, {
    status: "all",
    query: "STU1001",
  });
  assert.equal(named.length, 1);
  assert.equal(named[0]?.studentName, "Alex Rivera");
});

test("session responses group by stable unit_key", () => {
  const grouped = groupResponsesByUnit(DEMO_ADMIN_DATA.diagnosticResponses.filter(
    (row) => row.sessionId === "diag-session-completed",
  ));
  assert.deepEqual(grouped.map((group) => group.unitKey), [
    "general",
    "global-information",
    "fundamentals-of-it",
    "cyber-security",
  ]);
  assert.equal(grouped[1]?.unitLabel, "Global Information Storage & Transmission");
});

test("session detail source shows grouped evidence, Not sure and confidence", async () => {
  const source = await readFile(new URL("src/views/readiness-diagnostic.tsx", root), "utf8");
  assert.match(source, /Session detail/);
  assert.match(source, /groupResponsesByUnit/);
  assert.match(source, /response\.isNotSure/);
  assert.match(source, /response\.confidence/);
  assert.match(source, /showCorrectness/);
});

test("null is_correct does not produce a fake score or marked column", async () => {
  assert.equal(hasAuthoritativeCorrectness(DEMO_ADMIN_DATA.diagnosticResponses), false);
  const source = await readFile(new URL("src/views/readiness-diagnostic.tsx", root), "utf8");
  assert.match(source, /showCorrectness \? <th scope="col">Marked<\/th>/);
  assert.doesNotMatch(source, /average readiness|readiness %|pass\/fail/i);
});

test("authoritative correctness is shown only when a value is present", () => {
  const withMark = DEMO_ADMIN_DATA.diagnosticResponses.map((row, index) => (
    index === 0 ? { ...row, isCorrect: true } : row
  ));
  assert.equal(hasAuthoritativeCorrectness(withMark), true);
});

test("question distributions count options, Not sure and confidence without labels", () => {
  const rows = questionDistributions(DEMO_ADMIN_DATA.diagnosticResponses);
  const opening = rows.find((row) => row.questionKey === "RDY-OPEN-001");
  assert.ok(opening);
  assert.equal(opening.responseCount, 2);
  assert.ok(opening.optionCounts.some((option) => option.id === "somewhat"));
  assert.ok(opening.confidenceCounts.some((item) => item.value === "somewhat"));
  const hardware = rows.find((row) => row.questionKey === "RDY-FIT-001");
  assert.equal(hardware?.notSureCount, 1);
  assert.match(QUESTION_LABEL_GAP, /not yet available from admin_api/i);
});

test("empty and error states are staff-facing", async () => {
  const source = await readFile(new URL("src/views/readiness-diagnostic.tsx", root), "utf8");
  assert.match(source, /No diagnostic sessions yet/);
  assert.match(source, /Readiness Diagnostic could not be loaded/);
  assert.match(source, /error/);
});
