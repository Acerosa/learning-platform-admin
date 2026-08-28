import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  shouldBootstrapAdminData,
  shouldClearAdminData,
  shouldPreservePortalDataOnRefresh,
} from "../src/stores/admin-portal-auth.ts";

const root = new URL("../", import.meta.url);

test("auth bootstrap runs once for INITIAL_SESSION and SIGNED_IN only", () => {
  assert.equal(shouldBootstrapAdminData("INITIAL_SESSION"), true);
  assert.equal(shouldBootstrapAdminData("SIGNED_IN"), true);
  assert.equal(shouldBootstrapAdminData("TOKEN_REFRESHED"), false);
  assert.equal(shouldBootstrapAdminData("USER_UPDATED"), false);
  assert.equal(shouldClearAdminData("SIGNED_OUT"), true);
  assert.equal(shouldClearAdminData("SIGNED_IN"), false);
});

test("background refresh preserves ready portal data", () => {
  const ready = { status: "ready", data: { hubs: [] } };
  assert.equal(shouldPreservePortalDataOnRefresh(ready), true);
  assert.equal(shouldPreservePortalDataOnRefresh({ status: "loading", data: null }), false);
  assert.equal(
    shouldPreservePortalDataOnRefresh({ status: "ready", data: null }),
    false,
  );
  assert.equal(
    shouldPreservePortalDataOnRefresh({ status: "loading", data: null }, { background: true }),
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
  assert.match(pagesMain, /AdminPortalFrame moduleId=\{moduleId\}/);
  assert.doesNotMatch(pagesMain, /AdminPortalPage/);
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
  assert.match(source, /background: state\.status === "ready" && state\.data !== null/);
});

test("module frame keeps portal visible while cached data refreshes", async () => {
  const source = await readFile(new URL("src/views/admin-portal-page.tsx", root), "utf8");
  assert.match(source, /portal\.status === "loading" && !portal\.data/);
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
