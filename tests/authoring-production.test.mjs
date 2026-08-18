import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderText } from "./helpers/render.mjs";

const root = new URL("../", import.meta.url);

test("sidebar navigation exposes Content Library and Composition without Activities", async () => {
  const { html } = await renderText("/");
  assert.match(html, /Content Library/);
  assert.match(html, /Composition/);
  assert.match(html, /Curriculum authoring/);
  assert.doesNotMatch(html, />Activities<\/a>/);
  assert.doesNotMatch(html, /href="\/activities"/);
});

test("content library and composition stay registered for production routing", async () => {
  const [modules, library, composition, portal, service] = await Promise.all([
    readFile(new URL("src/router/modules.ts", root), "utf8"),
    readFile(new URL("src/views/content-library.tsx", root), "utf8"),
    readFile(new URL("src/views/composition.tsx", root), "utf8"),
    readFile(new URL("src/stores/admin-portal.tsx", root), "utf8"),
    readFile(new URL("src/services/supabase-admin-service.ts", root), "utf8"),
  ]);
  assert.match(modules, /id: "content-library"/);
  assert.match(modules, /id: "composition"/);
  assert.match(modules, /visibleInNavigation: false/);
  assert.match(library, /callRpc\("search_library"/);
  assert.match(library, /callRpc\("save_library_question"/);
  assert.match(library, /callRpc\("save_library_activity"/);
  assert.match(library, /callRpc\("publish_library_item"/);
  assert.match(library, /callRpc\("archive_library_item"/);
  assert.match(composition, /callRpc\("search_library"/);
  assert.match(composition, /p_status: "published"/);
  assert.match(composition, /No published activities found/);
  assert.match(composition, /composition-hub/);
  assert.match(composition, /Select a real hub and course/);
  assert.match(composition, /saveCurriculumDraft/);
  assert.match(composition, /Save as Curriculum Draft/);
  assert.match(portal, /getCurriculumDraft/);
  assert.match(service, /\.rpc\("get_curriculum_draft"/);
  assert.doesNotMatch(`${library}\n${composition}\n${portal}\n${service}`, /service_role|sb_secret_/i);
});
