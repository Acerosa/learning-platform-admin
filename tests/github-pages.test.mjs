import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("GitHub Pages publishes the dashboard artifact instead of the README", async () => {
  const [workflow, pagesIndex, pagesConfig, packageJson] = await Promise.all([
    readFile(new URL(".github/workflows/pages.yml", root), "utf8"),
    readFile(new URL("github-pages/index.html", root), "utf8"),
    readFile(new URL("vite.pages.config.ts", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(workflow, /actions\/deploy-pages@v5/);
  assert.match(workflow, /path: learning-platform-admin\/dist\/pages/);
  assert.match(pagesIndex, /id="root"/);
  assert.match(pagesIndex, /learning-platform-admin-router/);
  assert.match(pagesConfig, /base: "\/learning-platform-admin\/"/);
  assert.match(packageJson, /"build:pages": "vite build/);
});
