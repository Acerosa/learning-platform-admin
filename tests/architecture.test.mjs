import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return sourceFiles(url);
    return /\.(ts|tsx)$/.test(entry.name) ? [url] : [];
  }));
  return nested.flat();
}

test("package is the 0.2.0 administration repository and consumes platform core", async () => {
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(pkg.name, "learning-platform-admin");
  assert.equal(pkg.version, "0.2.0");
  assert.equal(pkg.dependencies["@learning-platform/core"], "file:../learning-platform-core");
  assert.equal(pkg.dependencies["@learning-platform/content"], "file:../learning-platform-content");
  assert.equal(pkg.dependencies["react-loading-skeleton"], undefined);
  assert.equal(pkg.dependencies["drizzle-orm"], undefined);
});

test("module registry has 16 unique hub-agnostic modules", async () => {
  const source = await readFile(new URL("src/router/modules.ts", root), "utf8");
  const ids = [...source.matchAll(/^\s+"([a-z-]+)",$/gm)].map((match) => match[1]);
  assert.equal(ids.length, 16);
  assert.equal(new Set(ids).size, 16);
  assert.deepEqual(ids, ["dashboard", "hubs", "courses", "curriculum", "activities", "learners", "teachers", "groups", "enrolments", "assignments", "attempts", "analytics", "monitoring", "certification", "configuration", "audit"]);
});

test("admin API names match the documented read-only backend surface", async () => {
  const source = await readFile(new URL("src/api/admin-api.ts", root), "utf8");
  for (const view of ["current_staff_context", "hubs", "hub_course_links", "platform_contracts", "staff_roles", "audit_events", "operational_health", "learners", "groups", "enrolments", "assignments", "attempts", "dashboard_summary", "activity_performance"]) {
    assert.match(source, new RegExp(`admin_api\\.${view}`));
  }
  assert.match(source, /status: "draft"/);
  assert.match(source, /mode: "read-only"/);
  assert.match(source, /pending-backend-contract/);
  assert.doesNotMatch(source, /\/rest\/v1|supabase\.co|service_role/i);
});

test("live integration uses Supabase Auth and the admin_api schema only", async () => {
  const [service, portal, accessGate] = await Promise.all([
    readFile(new URL("src/services/supabase-admin-service.ts", root), "utf8"),
    readFile(new URL("src/stores/admin-portal.tsx", root), "utf8"),
    readFile(new URL("src/components/admin-access-gate.tsx", root), "utf8"),
  ]);
  assert.match(service, /schema\("admin_api"\)/);
  assert.match(service, /current_staff_context/);
  assert.doesNotMatch(service, /schema\("(?:learning|platform)"\)/);
  assert.doesNotMatch(service, /response_payload|diagnostics/);
  assert.match(portal, /signInWithPassword/);
  assert.match(portal, /signInWithOtp/);
  assert.match(portal, /onAuthStateChange/);
  assert.match(service, /auth\.signUp/);
  assert.match(service, /claim_initial_platform_admin/);
  assert.match(accessGate, /Create account/);
  assert.match(accessGate, /Confirm password/);
  assert.match(accessGate, /One-time setup code/);
  assert.match(portal, /No demo data has been substituted/);
  assert.doesNotMatch(`${service}\n${portal}\n${accessGate}`, /service_role|sb_secret_/i);
});

test("source contains no email-based role or permission checks", async () => {
  const files = await sourceFiles(new URL("src/", root));
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /email\s*[!=]==?[^\n]*(role|permission)|(?:role|permission)[^\n]*email\s*[!=]==?/i);
  assert.doesNotMatch(source, /@(?:college|school|admin)\./i);
  assert.match(source, /grantedActions/);
});

test("shared theme service is used instead of a duplicate theme store", async () => {
  const layout = await readFile(new URL("app/layout.tsx", root), "utf8");
  const adapter = await readFile(new URL("src/theme/use-platform-theme.ts", root), "utf8");
  assert.match(layout, /@learning-platform\/core\/tokens\.css/);
  assert.match(layout, /@learning-platform\/core\/theme\.css/);
  assert.match(adapter, /createThemeService/);
  assert.match(adapter, /applyBranding/);
});

test("required documentation exists", async () => {
  for (const file of ["README.md", "docs/architecture.md", "docs/modules.md", "docs/integration.md", "docs/permissions.md", "docs/deployment.md", "docs/testing.md", "docs/curriculum-authoring.md", "docs/publication-workflow.md"]) {
    const content = await readFile(new URL(file, root), "utf8");
    assert.ok(content.length > 300, `${file} should be substantive`);
  }
});

test("curriculum authoring stays local and does not add backend write RPCs", async () => {
  const [mutations, service, authoring] = await Promise.all([
    readFile(new URL("src/services/pending-admin-mutations.ts", root), "utf8"),
    readFile(new URL("src/services/supabase-admin-service.ts", root), "utf8"),
    readFile(new URL("src/views/curriculum-authoring.tsx", root), "utf8"),
  ]);
  assert.match(mutations, /updateCurriculum: pending/);
  assert.doesNotMatch(service, /\.rpc\("(?:update_|create_|publish_|save_)/);
  assert.doesNotMatch(authoring, /schema\("(?:learning|platform)"\)|\.rpc\(/);
  assert.match(authoring, /local drafts/i);
});
