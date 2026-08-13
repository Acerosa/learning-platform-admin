import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createActivity, createBlock, emptyPackage } from "../src/content/factories.ts";
import { exportActivityPackage } from "../src/content/export.ts";
import { validatePackage } from "../src/content/validate.ts";

const require = createRequire(import.meta.url);
const unit14Engine = require("../../unit-14-software-engineering-for-business-hub/content/engine/index.js");

test("exported admin activity is accepted by the Unit 14 validator and renderer", () => {
  const pkg = emptyPackage("authoring-hub", "Authoring hub", "ocr-level-3-it");
  const activity = createActivity({ id: "admin-interop-activity", title: "Interop activity", status: "available" });
  const heading = createBlock(activity.id, "heading", []);
  heading.content = { ...heading.content, text: "Interop heading" };
  const question = createBlock(activity.id, "single-choice", [heading.id]);
  question.content = {
    ...question.content,
    prompt: "Is this synthetic test content?",
    options: [
      { id: "a", label: "Yes" },
      { id: "b", label: "No" },
    ],
    correctOptionId: "a",
  };
  activity.blocks = [heading, question];
  pkg.activities = [activity];

  const adminResult = validatePackage(pkg);
  assert.equal(adminResult.valid, true, adminResult.issues.map((issue) => issue.message).join("\n"));

  const exported = JSON.parse(exportActivityPackage(pkg, activity.id));
  const unit14Result = unit14Engine.validatePackage(exported);
  assert.equal(unit14Result.valid, true, unit14Engine.formatIssues(unit14Result.issues));
  const html = unit14Engine.renderActivity(exported.activities[0]);
  assert.match(html, /Interop activity/);
  assert.match(html, /Interop heading/);
  assert.match(html, /synthetic test content/);
  assert.doesNotMatch(html, /<script/i);
});
