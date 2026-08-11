import assert from "node:assert/strict";
import test from "node:test";
import { renderText } from "./helpers/render.mjs";

const routes = [
  ["/", "Dashboard"],
  ["/hubs", "Hub registry"],
  ["/courses", "Courses"],
  ["/curriculum", "Curriculum"],
  ["/activities", "Activities"],
  ["/learners", "Learners"],
  ["/teachers", "Teachers"],
  ["/groups", "Groups"],
  ["/enrolments", "Enrolments"],
  ["/assignments", "Assignments"],
  ["/analytics", "Analytics"],
  ["/monitoring", "Monitoring"],
  ["/certification", "Certification"],
  ["/configuration", "Configuration"],
  ["/audit", "Audit"],
];

for (const [route, heading] of routes) {
  test(`${route} renders the ${heading} module`, async () => {
    const { response, html } = await renderText(route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.match(html, new RegExp(`<h1>${heading}<\\/h1>`));
    assert.match(html, /Learning Platform Administration/);
    assert.match(html, /admin_api 0\.1\.0 · draft/);
    assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  });
}

test("unknown module routes return not found", async () => {
  const { response } = await renderText("/not-a-module");
  assert.equal(response.status, 404);
});

test("dashboard reports real foundation boundaries", async () => {
  const { html } = await renderText("/");
  assert.match(html, /2 active · 1 draft/);
  assert.match(html, /Administrative writes/);
  assert.match(html, /No live audit source/);
});

test("hub registry exposes safe view and prepared actions", async () => {
  const { html } = await renderText("/hubs");
  assert.match(html, /Unit 3 Cyber Security Hub/);
  assert.match(html, /T Level Digital Software Development Hub/);
  assert.match(html, /Register hub/);
  assert.match(html, /Not certified/);
});
