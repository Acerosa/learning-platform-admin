import assert from "node:assert/strict";
import test from "node:test";
import { examCohort } from "../src/exam/lo12.mjs";

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
