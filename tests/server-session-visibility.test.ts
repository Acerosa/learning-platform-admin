import assert from "node:assert/strict";
import test from "node:test";
import {
  sessionVisibilityStatusForAction,
  supportsServerSessionVisibility,
} from "../src/content/server-session-visibility.ts";

test("T Level hub is gated onto server session visibility", () => {
  assert.equal(supportsServerSessionVisibility("tlevel-software-development"), true);
  assert.equal(supportsServerSessionVisibility("unit-3-cyber-security"), false);
  assert.equal(supportsServerSessionVisibility("unit-14-software-engineering-for-business"), false);
});

test("post/remove map to available/planned without client version math", () => {
  assert.equal(sessionVisibilityStatusForAction("post"), "available");
  assert.equal(sessionVisibilityStatusForAction("remove"), "planned");
});
