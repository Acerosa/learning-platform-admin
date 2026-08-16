import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ADMIN_DATA } from "../src/services/demo-admin-service.ts";
import {
  interpretStoredAttempt,
  resultsDashboard,
  reviewQueue,
} from "../src/results/from-admin-snapshot.ts";

test("demo results consume shared interpretation rather than local scoring", () => {
  const dashboard = resultsDashboard(DEMO_ADMIN_DATA);
  assert.equal(dashboard.attemptCount, 2);
  assert.equal(dashboard.marking.reviewCount, 1);
  const queue = reviewQueue(DEMO_ADMIN_DATA.responses);
  assert.equal(queue[0]?.reason, "needs-marking");
  const interpreted = interpretStoredAttempt(
    DEMO_ADMIN_DATA.attempts[0],
    DEMO_ADMIN_DATA.responses.filter((response) => response.attemptId === DEMO_ADMIN_DATA.attempts[0].attemptId),
  );
  assert.equal(interpreted.responses[0]?.correctness, "correct");
});
