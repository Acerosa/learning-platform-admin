import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ADMIN_DATA } from "../src/services/demo-admin-service.ts";
import {
  assessmentOverviewFromSnapshot,
  assessmentReadinessFromSnapshot,
  interventionSignalsFromSnapshot,
} from "../src/results/from-admin-snapshot.ts";

test("demo analytics overview interprets backend assessment KPIs", () => {
  const overview = assessmentOverviewFromSnapshot(DEMO_ADMIN_DATA);
  assert.ok(overview);
  assert.equal(overview.activeLearners, 2);
  assert.equal(overview.topicMetadataCoverage, "present");
  assert.equal(overview.skillMetadataCoverage, "present");
});

test("demo readiness indicators stay explainable", () => {
  const readiness = assessmentReadinessFromSnapshot(DEMO_ADMIN_DATA);
  assert.equal(readiness.length, 5);
  assert.ok(readiness.every((item) => item.explanation.length > 0));
});

test("demo intervention signals expose explicit reasons", () => {
  const signals = interventionSignalsFromSnapshot(DEMO_ADMIN_DATA);
  assert.ok(signals.length >= 1);
  assert.ok(signals.every((signal) => /attention|assigned|completion|review|declined|success/i.test(signal.reason) || signal.reason.length > 0));
  assert.ok(signals.some((signal) => signal.key === "assigned-never-attempted" || signal.key === "unresolved-review-backlog" || signal.key === "low-completion"));
});
