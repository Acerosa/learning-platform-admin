import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { GROUPING_POLL_MS, groupingPollShouldRun } from "../src/views/grouping-poll.ts";

test("Group Generator polls get_grouping_session only while a live session needs it", () => {
  assert.equal(GROUPING_POLL_MS, 2500);
  assert.equal(groupingPollShouldRun({
    live: false, hasSession: true, status: "joining", hidden: false
  }), false);
  assert.equal(groupingPollShouldRun({
    live: true, hasSession: false, status: "joining", hidden: false
  }), false);
  assert.equal(groupingPollShouldRun({
    live: true, hasSession: true, status: "closed", hidden: false
  }), false);
  assert.equal(groupingPollShouldRun({
    live: true, hasSession: true, status: null, hidden: false
  }), false);
  assert.equal(groupingPollShouldRun({
    live: true, hasSession: true, status: "joining", hidden: true
  }), false);
  assert.equal(groupingPollShouldRun({
    live: true, hasSession: true, status: "joining", hidden: false
  }), true);
  assert.equal(groupingPollShouldRun({
    live: true, hasSession: true, status: "proposed", hidden: false
  }), true);
  assert.equal(groupingPollShouldRun({
    live: true, hasSession: true, status: "published", hidden: false
  }), true);
});

test("idle Group Generator request rates are zero after close or with no session", () => {
  assert.equal(60000 / GROUPING_POLL_MS, 24);
  assert.equal(groupingPollShouldRun({
    live: true, hasSession: false, status: "joining", hidden: false
  }) ? 24 : 0, 0);
  assert.equal(groupingPollShouldRun({
    live: true, hasSession: true, status: "closed", hidden: false
  }) ? 24 : 0, 0);
  assert.equal(groupingPollShouldRun({
    live: true, hasSession: true, status: "joining", hidden: true
  }) ? 24 : 0, 0);
});

test("Group Generator poller is keyed by session id/status and pauses while hidden", async () => {
  const source = await readFile(new URL("../src/views/group-generator.tsx", import.meta.url), "utf8");
  assert.match(source, /groupingPollShouldRun/);
  assert.match(source, /GROUPING_POLL_MS/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /session\?\.id, session\?\.status/);
  assert.doesNotMatch(source, /\[live, session, refreshSession\]/);
  assert.match(source, /document\.visibilityState === "hidden"/);
});
