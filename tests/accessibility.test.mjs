import assert from "node:assert/strict";
import test from "node:test";
import axe from "axe-core";
import { JSDOM } from "jsdom";
import { renderText } from "./helpers/render.mjs";

async function audit(pathname) {
  const { html } = await renderText(pathname);
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: `http://localhost${pathname}`,
  });
  dom.window.eval(axe.source);
  return dom.window.axe.run(dom.window.document, {
    rules: {
      "color-contrast": { enabled: false },
      "region": { enabled: false },
    },
  });
}

for (const route of ["/", "/hubs", "/learners", "/attempts", "/analytics", "/audit"]) {
  test(`${route} has no automated WCAG A/AA structural violations`, async () => {
    const results = await audit(route);
    assert.equal(
      results.violations.length,
      0,
      JSON.stringify(
        results.violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.length,
        })),
      ),
    );
  });
}

test("dashboard exposes navigation, main landmark and skip link", async () => {
  const { html } = await renderText("/");
  assert.match(html, /class="skip-link" href="#admin-main"/);
  assert.match(html, /<aside[^>]+aria-label="Administration navigation"/);
  assert.match(html, /<main id="admin-main"/);
  assert.match(html, /<th scope="col">/);
  assert.match(html, /<th scope="row">/);
});
