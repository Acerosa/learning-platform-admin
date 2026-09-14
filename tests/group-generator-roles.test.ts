import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Group Generator configures specialist roles and staff overrides", async () => {
  const source = await readFile(new URL("../src/views/group-generator.tsx", import.meta.url), "utf8");
  assert.match(source, /ROLE_PRESETS/);
  assert.match(source, /Cyber Security Analyst/);
  assert.match(source, /p_specialist_role_title/);
  assert.match(source, /set_grouping_participant_role/);
  assert.match(source, /roleOverrideOptions/);
  assert.match(source, /project_manager/);
  assert.match(source, /specialistRoleTitle/);
});

test("admin-api registers grouping role RPCs", async () => {
  const source = await readFile(new URL("../src/api/admin-api.ts", import.meta.url), "utf8");
  assert.match(source, /setGroupingSessionSpecialistRole/);
  assert.match(source, /setGroupingParticipantRole/);
  assert.match(source, /admin_api\.set_grouping_participant_role/);
});
