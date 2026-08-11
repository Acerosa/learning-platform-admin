import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("responsive breakpoints cover laptop, tablet and mobile layouts", () => {
  for (const width of ["80rem", "64rem", "48rem", "32rem"]) {
    assert.match(css, new RegExp(`@media \\(max-width: ${width}\\)`));
  }
});

test("large tables scroll inside their container", () => {
  assert.match(css, /\.table-wrap\s*\{[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto/s);
  assert.doesNotMatch(css, /body\s*\{[^}]*overflow-x:\s*auto/s);
});

test("mobile navigation is off-canvas with an explicit backdrop", () => {
  assert.match(css, /\.admin-sidebar\s*\{[^}]*transform:\s*translateX\(-100%\)/s);
  assert.match(css, /\.admin-sidebar--open\s*\{[^}]*translateX\(0\)/s);
  assert.match(css, /\.navigation-backdrop/);
});

test("motion and forced-colour preferences are respected", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
});
