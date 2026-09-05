import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  diagnosticPercentageLabel,
  diagnosticScoreLabel,
  filterDiagnosticSessions,
  lastActivityAt,
  unansweredQuestions,
  questionCatalogue,
} from "../src/analytics/diagnostic.ts";
import { sliceDemoModuleData } from "../src/api/admin-module-data.ts";
import {
  ASSIGNMENT_MARKBOOK_SOURCE_ID,
  INDUCTION_READINESS_SOURCE_ID,
  RESULT_SOURCES,
  resultSourceById,
} from "../src/results/result-sources.ts";
import { DEMO_ADMIN_DATA } from "../src/services/demo-admin-service.ts";

const root = new URL("../", import.meta.url);

test("Results sources expose Induction / Readiness without a one-off architecture", () => {
  const induction = resultSourceById(INDUCTION_READINESS_SOURCE_ID);
  assert.ok(induction);
  assert.equal(induction?.available, true);
  assert.equal(induction?.kind, "diagnostic");
  assert.equal(induction?.expectedQuestionCount, 25);
  assert.equal(induction?.hubCode, "level-3-it-year-1-readiness");
  assert.equal(resultSourceById(ASSIGNMENT_MARKBOOK_SOURCE_ID)?.kind, "assignment-markbook");
  assert.ok(RESULT_SOURCES.some((source) => source.id === "unit-3-cyber-security" && !source.available));
  assert.ok(RESULT_SOURCES.some((source) => source.id === "tlevel" && !source.available));
});

test("assignments-results module data includes diagnostic sittings", () => {
  const slice = sliceDemoModuleData(DEMO_ADMIN_DATA, "assignments-results");
  assert.equal(slice.diagnosticSessions.length, DEMO_ADMIN_DATA.diagnosticSessions.length);
  assert.equal(slice.diagnosticResponses.length, DEMO_ADMIN_DATA.diagnosticResponses.length);
  assert.equal(slice.diagnosticSummary.length, DEMO_ADMIN_DATA.diagnosticSummary.length);
});

test("Results area defaults to Induction and reuses the diagnostic page", async () => {
  const [area, assessment, diagnostic, sources] = await Promise.all([
    readFile(new URL("src/views/results-area.tsx", root), "utf8"),
    readFile(new URL("src/views/assessment-area.tsx", root), "utf8"),
    readFile(new URL("src/views/readiness-diagnostic.tsx", root), "utf8"),
    readFile(new URL("src/results/result-sources.ts", root), "utf8"),
  ]);
  assert.match(area, /data-testid="results-area"/);
  assert.match(sources, /Induction \/ Readiness/);
  assert.match(area, /ReadinessDiagnosticPage/);
  assert.match(area, /variant="results"/);
  assert.match(area, /not available yet/);
  assert.match(area, /INDUCTION_READINESS_SOURCE_ID/);
  assert.match(assessment, /ResultsArea/);
  assert.match(diagnostic, /Results → Induction \/ Readiness/);
  assert.match(diagnostic, /Loading diagnostic sittings/);
  assert.match(diagnostic, /No matching sessions/);
  assert.match(diagnostic, /diagnostic-date/);
  assert.match(diagnostic, /Open/);
});

test("date and version filters keep recent completed sittings visible", () => {
  const now = Date.parse("2026-09-05T12:00:00Z");
  const recent = filterDiagnosticSessions(DEMO_ADMIN_DATA.diagnosticSessions, {
    status: "all",
    query: "",
    date: "last-7-days",
    now,
  });
  assert.equal(recent.length, 2);
  const completed = filterDiagnosticSessions(DEMO_ADMIN_DATA.diagnosticSessions, {
    status: "completed",
    query: "",
    version: "1.0.0",
    date: "all",
  });
  assert.equal(completed.length, 1);
  const old = filterDiagnosticSessions(DEMO_ADMIN_DATA.diagnosticSessions, {
    status: "all",
    query: "",
    date: "last-24-hours",
    now,
  });
  assert.equal(old.length, 0);
});

test("unavailable score and percentage render as em dash", () => {
  const responses = DEMO_ADMIN_DATA.diagnosticResponses.filter(
    (row) => row.sessionId === "diag-session-completed",
  );
  assert.equal(diagnosticScoreLabel(responses), "—");
  assert.equal(diagnosticPercentageLabel(responses, 25), "—");
  const marked = responses.map((row, index) => (index === 0 ? { ...row, isCorrect: true } : row));
  assert.equal(diagnosticPercentageLabel(marked, 25), "—");
  assert.match(diagnosticScoreLabel(marked), /marked/);
});

test("in-progress sittings keep started status and last activity", () => {
  const started = DEMO_ADMIN_DATA.diagnosticSessions.find((row) => row.status === "started");
  assert.ok(started);
  assert.equal(started?.completedAt, null);
  assert.equal(lastActivityAt(started!), started!.startedAt);
});

test("unanswered questions are identifiers against the stored catalogue", () => {
  const catalogue = questionCatalogue(DEMO_ADMIN_DATA.diagnosticResponses);
  const started = DEMO_ADMIN_DATA.diagnosticResponses.filter(
    (row) => row.sessionId === "diag-session-started",
  );
  const missing = unansweredQuestions(started, catalogue);
  assert.ok(missing.length > 0);
  assert.ok(missing.every((item) => item.questionKey && item.activityId));
});
