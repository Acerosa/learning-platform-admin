import assert from "node:assert/strict";
import test from "node:test";
import { canReleaseMarking, examCohort, markingStateLabel, matchClassLearners, paperDurationLabel } from "../src/exam/lo12.mjs";

test("class average ignores unmarked mini-mocks", () => {
  const summary = examCohort([
    {
      student_id: "a",
      activity_key: "mini-mock",
      status: "submitted",
      marking_status: "finalised",
      awarded: { "mm-1": 3, "mm-2": 4, "mm-3": 3, "mm-4": 4, "mm-5": 6 },
    },
    {
      student_id: "b",
      activity_key: "mini-mock",
      status: "submitted",
      marking_status: "pending",
      awarded: null,
    },
  ], ["a", "b", "c"]);
  assert.equal(summary.average, 20);
  assert.equal(summary.awaiting, 1);
  assert.equal(summary.notAttempted, 1);
  assert.equal(summary.complete, 1);
});

test("learner search uses name or student number only", () => {
  const learners = [
    { studentNumber: "SYNTH-0001", displayName: "Synthetic Student A" },
    { studentNumber: "SYNTH-0002", displayName: "Synthetic Student B" },
  ];
  assert.equal(matchClassLearners(learners, "student a").length, 1);
  assert.equal(matchClassLearners(learners, "synth-0002")[0].studentNumber, "SYNTH-0002");
  assert.equal(paperDurationLabel(1200, 600), "30 min");
  assert.equal(markingStateLabel("in_progress"), "Marking in progress");
  assert.equal(markingStateLabel("finalised"), "Marking finalised");
  assert.equal(markingStateLabel("released"), "Results released");
  assert.equal(canReleaseMarking("finalised"), true);
  assert.equal(canReleaseMarking("in_progress"), false);
  assert.equal(canReleaseMarking("released"), false);
});
