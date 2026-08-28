import assert from "node:assert/strict";
import test from "node:test";
import { renderText } from "./helpers/render.mjs";

const primaryRoutes = [
  ["/", "Dashboard"],
  ["/hubs", "Hubs & Curriculum"],
  ["/people", "People"],
  ["/assessment", "Assignments & Results"],
  ["/analytics", "Analytics"],
  ["/system", "System"],
];

for (const [route, heading] of primaryRoutes) {
  test(`${route} renders the ${heading} primary area`, async () => {
    const { response, html } = await renderText(route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.match(html, new RegExp(`<h1>${heading.replace(/&/g, "&amp;")}<\\/h1>`));
    assert.match(html, /Learning Platform Administration/);
    assert.match(html, /admin_api 0\.2\.0 · draft/);
  });
}

const legacyRoutes = [
  ["/courses", "Hubs & Curriculum"],
  ["/curriculum", "Curriculum"],
  ["/content-library", "Content Library"],
  ["/composition", "Composition"],
  ["/activities", "Activity catalogue"],
  ["/learners", "Learners"],
  ["/teachers", "Staff"],
  ["/groups", "Groups"],
  ["/enrolments", "Enrolments"],
  ["/assignments", "Assignments"],
  ["/results", "Results"],
  ["/attempts", "Attempts"],
  ["/monitoring", "Monitoring"],
  ["/certification", "Certification"],
  ["/configuration", "Configuration"],
  ["/audit", "Audit"],
];

for (const [route, heading] of legacyRoutes) {
  test(`legacy ${route} still resolves (${heading})`, async () => {
    const { response, html } = await renderText(route);
    assert.equal(response.status, 200);
    assert.match(html, new RegExp(`<h1>${heading.replace(/&/g, "&amp;")}<\\/h1>`));
  });
}

test("primary navigation exposes only six destinations", async () => {
  const { html } = await renderText("/");
  for (const label of ["Dashboard", "Hubs &amp; Curriculum", "People", "Assignments &amp; Results", "Analytics", "System"]) {
    assert.match(html, new RegExp(label));
  }
  for (const hidden of ["Content Library", "Composition", "Enrolments", "Monitoring", "Certification", "Configuration"]) {
    assert.doesNotMatch(html, new RegExp(`<span>${hidden}</span>`));
  }
});

test("curriculum authoring exposes simplified workspace", async () => {
  const { html } = await renderText("/curriculum");
  assert.match(html, /Authoring views/);
  assert.match(html, /Curriculum/);
  assert.match(html, /Weeks/);
  assert.match(html, /Activities/);
  assert.match(html, /Save draft/);
  assert.match(html, /Preview/);
  assert.match(html, /Publish/);
  assert.match(html, /Review \(advanced\)/);
  assert.match(html, /Publication \(advanced\)/);
  assert.match(html, /Published means the backend platform catalogue is updated/);
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
  assert.match(html, /No curriculum/);
});

test("attempt and analytics routes expose summary data without responses", async () => {
  const attempts = await renderText("/attempts");
  const analytics = await renderText("/analytics");
  assert.match(attempts.html, /Summary evidence only/);
  assert.match(attempts.html, /SYNTH-0001/);
  assert.doesNotMatch(attempts.html, /response_payload/i);
  assert.match(analytics.html, /Backend-derived aggregates/);
  assert.match(analytics.html, /Assessment overview/);
  assert.match(analytics.html, /70\.0%/);
  assert.doesNotMatch(analytics.html, /response_payload/i);
});
