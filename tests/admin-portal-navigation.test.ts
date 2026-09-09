import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeAdminAuthCallbackUrl,
  shouldBootstrapAdminData,
  shouldClearAdminData,
  shouldEnterPasswordRecovery,
  shouldPreservePortalDataOnRefresh,
} from "../src/stores/admin-portal-auth.ts";

const root = new URL("../", import.meta.url);

test("auth bootstrap runs once for INITIAL_SESSION and SIGNED_IN only", () => {
  assert.equal(shouldBootstrapAdminData("INITIAL_SESSION"), true);
  assert.equal(shouldBootstrapAdminData("SIGNED_IN"), true);
  assert.equal(shouldBootstrapAdminData("TOKEN_REFRESHED"), false);
  assert.equal(shouldBootstrapAdminData("USER_UPDATED"), false);
  assert.equal(shouldBootstrapAdminData("PASSWORD_RECOVERY"), false);
  assert.equal(shouldClearAdminData("SIGNED_OUT"), true);
  assert.equal(shouldClearAdminData("SIGNED_IN"), false);
});

test("background refresh preserves ready portal data", () => {
  const ready = { status: "ready", bootstrapReady: true };
  assert.equal(shouldPreservePortalDataOnRefresh(ready), true);
  assert.equal(shouldPreservePortalDataOnRefresh({ status: "loading", bootstrapReady: false }), false);
  assert.equal(
    shouldPreservePortalDataOnRefresh({ status: "ready", bootstrapReady: false }),
    false,
  );
  assert.equal(
    shouldPreservePortalDataOnRefresh({ status: "loading", bootstrapReady: false }, { background: true }),
    true,
  );
});

test("AdminPortalProvider is mounted once at the app root, not per route page", async () => {
  const [layout, portalPage, modulePage, homePage, pagesMain] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("src/views/admin-portal-page.tsx", root), "utf8"),
    readFile(new URL("app/[module]/page.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("github-pages/main.tsx", root), "utf8"),
  ]);

  assert.match(layout, /AdminPortalRoot/);
  assert.match(layout, /AdminPortalProvider|admin-portal-root/);
  assert.doesNotMatch(portalPage, /AdminPortalProvider/);
  assert.match(portalPage, /AdminPortalFrame/);
  assert.match(homePage, /AdminPortalFrame/);
  assert.match(modulePage, /AdminPortalFrame/);
  assert.match(pagesMain, /AdminPortalProvider/);
  assert.match(pagesMain, /applyAdminAuthCallbackLocation/);
  assert.match(pagesMain, /AdminPortalFrame moduleId=\{moduleId\}/);
  assert.match(pagesMain, /window\.location\.hash/);
  assert.doesNotMatch(pagesMain, /window\.location\.search/);
  assert.doesNotMatch(pagesMain, /AdminPortalPage/);
});

test("GitHub Pages recovery token_hash stays on the search string", () => {
  const pagesRoot = "https://acerosa.github.io/learning-platform-admin/";
  assert.equal(
    normalizeAdminAuthCallbackUrl(`${pagesRoot}?token_hash=recovery-hash&type=recovery`),
    `${pagesRoot}?token_hash=recovery-hash&type=recovery`,
  );
  assert.equal(
    normalizeAdminAuthCallbackUrl(`${pagesRoot}#/?token_hash=recovery-hash&type=recovery`),
    `${pagesRoot}?token_hash=recovery-hash&type=recovery`,
  );
  assert.equal(
    shouldEnterPasswordRecovery("INITIAL_SESSION", {
      search: "?token_hash=recovery-hash&type=recovery",
    }),
    false,
  );
  assert.equal(
    shouldBootstrapAdminData("SIGNED_IN", {
      search: "?token_hash=recovery-hash&type=recovery",
    }),
    false,
  );
  assert.equal(
    shouldEnterPasswordRecovery("SIGNED_IN", { search: "?code=magic-link-code" }),
    false,
  );
});

test("auth bootstrap uses onAuthStateChange without a separate initial refresh", async () => {
  const source = await readFile(new URL("src/stores/admin-portal.tsx", root), "utf8");
  assert.match(source, /onAuthStateChange/);
  assert.match(source, /shouldBootstrapAdminData/);
  assert.doesNotMatch(source, /setTimeout\(\(\) => void refresh\(\)/);
  assert.doesNotMatch(source, /initialRefresh/);
});

test("refresh preserves cached data instead of clearing it by default", async () => {
  const source = await readFile(new URL("src/stores/admin-portal.tsx", root), "utf8");
  assert.match(source, /shouldPreservePortalDataOnRefresh/);
  assert.match(source, /refreshing: true/);
  assert.match(source, /background: state\.status === "ready" && state\.bootstrapReady/);
});

test("module frame keeps portal visible while cached data refreshes", async () => {
  const source = await readFile(new URL("src/views/admin-portal-page.tsx", root), "utf8");
  assert.match(source, /portal\.status === "loading" && !portal\.bootstrapReady/);
});

test("internal Admin links use Next client navigation outside GitHub Pages", async () => {
  const source = await readFile(new URL("src/components/admin-link.tsx", root), "utf8");
  assert.match(source, /from "next\/link"/);
  assert.match(source, /<Link href=\{href\}/);
});

test("GitHub Pages internal links stay hash-based without full reload", async () => {
  const source = await readFile(new URL("src/components/admin-link.tsx", root), "utf8");
  assert.match(source, /navigateHash/);
  assert.match(source, /event\.preventDefault\(\)/);
});

test("hubs module does not render children until the hub list is ready", async () => {
  const [shell, portal, authoring] = await Promise.all([
    readFile(new URL("src/components/module-data-shell.tsx", root), "utf8"),
    readFile(new URL("src/stores/admin-portal.tsx", root), "utf8"),
    readFile(new URL("src/views/curriculum-authoring.tsx", root), "utf8"),
  ]);
  assert.match(shell, /shouldRenderModuleChildren/);
  assert.match(portal, /client\.auth\.getSession\(\)/);
  assert.match(portal, /stateRef\.current = state;/);
  assert.doesNotMatch(
    authoring,
    /hubs\.length \? hubs : \[\{ hubCode: selectedHubCode/,
  );
});
