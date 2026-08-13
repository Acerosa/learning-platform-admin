import assert from "node:assert/strict";
import test from "node:test";
import { renderText } from "./helpers/render.mjs";

const routes = [
  ["/", "Dashboard"],
  ["/hubs", "Hub registry"],
  ["/courses", "Courses"],
  ["/curriculum", "Curriculum authoring"],
  ["/activities", "Activities"],
  ["/learners", "Learners"],
  ["/teachers", "Teachers"],
  ["/groups", "Groups"],
  ["/enrolments", "Enrolments"],
  ["/assignments", "Assignments"],
  ["/attempts", "Attempts"],
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
    assert.match(html, /admin_api 0\.2\.0 · draft/);
    assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  });
}

test("curriculum authoring exposes local draft workspace tabs", async () => {
  const { html } = await renderText("/curriculum");
  assert.match(html, /Authoring views/);
  assert.match(html, /Curriculum/);
  assert.match(html, /Weeks/);
  assert.match(html, /Activities/);
  assert.match(html, /Imports/);
  assert.match(html, /Drafts/);
  assert.match(html, /Ready for Review/);
  assert.match(html, /Publication/);
  assert.match(html, /History/);
  assert.match(html, /Compare/);
  assert.match(html, /Archive/);
  assert.match(html, /Learners consume Published content/);
});

test("unknown module routes return not found", async () => {
  const { response } = await renderText("/not-a-module");
  assert.equal(response.status, 404);
});

test("dashboard reports the Phase 2 data snapshot", async () => {
  const { html } = await renderText("/");
  assert.match(html, /Active learners/);
  assert.match(html, /Recent attempts/);
  assert.match(html, /Platform health/);
  assert.match(html, /4(?:<!-- -->)? active/);
});

test("hub registry exposes safe view and prepared actions", async () => {
  const { html } = await renderText("/hubs");
  assert.match(html, /Unit 3 Cyber Security Hub/);
  assert.match(html, /T Level Digital Software Development Hub/);
  assert.match(html, /Register hub/);
  assert.match(html, /not recorded/i);
});

test("attempt and analytics routes expose summary data without responses", async () => {
  const attempts = await renderText("/attempts");
  const analytics = await renderText("/analytics");
  assert.match(attempts.html, /Summary evidence only/);
  assert.match(attempts.html, /SYNTH-0001/);
  assert.doesNotMatch(attempts.html, /response_payload/i);
  assert.match(analytics.html, /Backend-derived aggregates/);
  assert.match(analytics.html, /80\.0%/);
});
