import assert from "node:assert/strict";
import test from "node:test";
import type { AdminDataSnapshot } from "../src/api/admin-api.ts";
import { AdminReadError } from "../src/services/supabase-admin-service.ts";
import type { AdminModuleDataKey, AdminModulePayload, DashboardData } from "../src/api/admin-module-data.ts";
import {
  createEmptyModuleCache,
  sliceDemoModuleData,
} from "../src/api/admin-module-data.ts";
import {
  formatModuleLoadError,
  isModuleReady,
  shouldAutoLoadModule,
  shouldBeginModuleLoad,
} from "../src/stores/admin-module-loader.ts";
import {
  shouldBootstrapAdminData,
  shouldClearAdminData,
  shouldPreservePortalDataOnRefresh,
} from "../src/stores/admin-portal-auth.ts";
import { DEMO_ADMIN_DATA } from "../src/services/demo-admin-service.ts";

const sliceModuleData = sliceDemoModuleData as (
  snapshot: AdminDataSnapshot,
  moduleKey: AdminModuleDataKey,
) => AdminModulePayload[AdminModuleDataKey];

type PortalStatus = "loading" | "ready" | "signed-out" | "error";

class ModuleLoadSimulator {
  portalStatus: PortalStatus = "ready";
  cache = createEmptyModuleCache();
  loadCount = 0;
  refreshCount = 0;
  private inFlight = new Map<AdminModuleDataKey, Promise<void>>();

  get entry() {
    return this.cache.dashboard;
  }

  runAutoLoadEffect(moduleKey: AdminModuleDataKey = "dashboard") {
    const entry = this.cache[moduleKey];
    if (shouldAutoLoadModule(this.portalStatus, entry.status)) {
      void this.ensureModuleData(moduleKey);
    }
  }

  async ensureModuleData(moduleKey: AdminModuleDataKey) {
    await this.loadModuleData(moduleKey, { refresh: false });
  }

  async refreshModuleData(moduleKey: AdminModuleDataKey) {
    await this.loadModuleData(moduleKey, { refresh: true });
  }

  private async loadModuleData(
    key: AdminModuleDataKey,
    options: { refresh: boolean; fail?: boolean },
  ) {
    const entry = this.cache[key];
    const refresh = options.refresh;

    if (!shouldBeginModuleLoad(entry, refresh)) {
      return;
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      await existing;
      return;
    }

    const promise = (async () => {
      if (refresh) {
        this.refreshCount += 1;
      } else {
        this.loadCount += 1;
      }

      this.cache = {
        ...this.cache,
        [key]: {
          ...this.cache[key],
          status: refresh && isModuleReady(entry) ? "refreshing" : "loading",
          error: null,
        },
      };

      await Promise.resolve();

      if (options.fail) {
        this.cache = {
          ...this.cache,
          [key]: {
            ...this.cache[key],
            status: "error",
            error: "Dashboard unavailable",
          },
        };
        return;
      }

      this.cache = {
        ...this.cache,
        [key]: {
          ...this.cache[key],
          status: "ready",
          data: sliceModuleData(DEMO_ADMIN_DATA, key),
          error: null,
        },
      };
    })();

    this.inFlight.set(key, promise);
    try {
      await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  async loadWithFailure(key: AdminModuleDataKey = "dashboard") {
    await this.loadModuleData(key, { refresh: false, fail: true });
  }
}

test("Test A: initial module load triggers exactly one automatic request", async () => {
  const sim = new ModuleLoadSimulator();
  assert.equal(sim.entry.status, "idle");
  assert.equal(shouldAutoLoadModule(sim.portalStatus, sim.entry.status), true);

  await sim.ensureModuleData("dashboard");
  assert.equal(sim.loadCount, 1);
  assert.equal(sim.entry.status, "ready");

  sim.runAutoLoadEffect();
  assert.equal(sim.loadCount, 1, "ready cache must not auto-load again");
});

test("Test B: module API failure stops at error without automatic retry", async () => {
  const sim = new ModuleLoadSimulator();
  await sim.loadWithFailure();

  assert.equal(sim.entry.status, "error");
  assert.equal(sim.loadCount, 1);
  assert.equal(shouldAutoLoadModule(sim.portalStatus, sim.entry.status), false);

  sim.runAutoLoadEffect();
  sim.runAutoLoadEffect();
  assert.equal(sim.loadCount, 1, "error must not auto-retry");
});

test("Test C: re-render while error does not issue additional automatic requests", async () => {
  const sim = new ModuleLoadSimulator();
  await sim.loadWithFailure();

  const before = sim.loadCount;
  for (let index = 0; index < 5; index += 1) {
    sim.portalStatus = "ready";
    sim.runAutoLoadEffect();
  }
  assert.equal(sim.loadCount, before);
  assert.equal(sim.entry.status, "error");
});

test("Test D: explicit retry performs exactly one new request", async () => {
  const sim = new ModuleLoadSimulator();
  await sim.loadWithFailure();

  await sim.refreshModuleData("dashboard");
  assert.equal(sim.refreshCount, 1);
  assert.equal(sim.loadCount, 1);
  assert.equal(sim.entry.status, "ready");
});

test("Test E: returning to a ready module uses cache without network reload", async () => {
  const sim = new ModuleLoadSimulator();
  await sim.ensureModuleData("dashboard");
  assert.equal(sim.entry.status, "ready");

  sim.cache.people = {
    status: "ready",
    data: sliceDemoModuleData(DEMO_ADMIN_DATA, "people"),
    error: null,
  };

  sim.runAutoLoadEffect("dashboard");
  assert.equal(sim.loadCount, 1);
  assert.equal(sim.entry.status, "ready");
});

test("Test F: concurrent renders while loading deduplicate to one request", async () => {
  const sim = new ModuleLoadSimulator();
  const first = sim.ensureModuleData("dashboard");
  const second = sim.ensureModuleData("dashboard");
  const third = sim.ensureModuleData("dashboard");
  await Promise.all([first, second, third]);
  assert.equal(sim.loadCount, 1);
  assert.equal(sim.entry.status, "ready");
});

test("Test G: auth bootstrap events follow intended policy", () => {
  assert.equal(shouldBootstrapAdminData("INITIAL_SESSION"), true);
  assert.equal(shouldBootstrapAdminData("SIGNED_IN"), true);
  assert.equal(shouldBootstrapAdminData("TOKEN_REFRESHED"), false);
  assert.equal(shouldClearAdminData("SIGNED_OUT"), true);
  assert.equal(shouldClearAdminData("TOKEN_REFRESHED"), false);
  assert.equal(
    shouldPreservePortalDataOnRefresh({ status: "ready", bootstrapReady: true }),
    true,
  );
});

test("shouldBeginModuleLoad encodes the module state machine", () => {
  const idle = createEmptyModuleCache().dashboard;
  assert.equal(shouldBeginModuleLoad(idle, false), true);
  assert.equal(shouldBeginModuleLoad({ ...idle, status: "loading" }, false), false);
  assert.equal(shouldBeginModuleLoad({ ...idle, status: "error", error: "failed" }, false), false);
  assert.equal(
    shouldBeginModuleLoad(
      {
        status: "ready",
        data: sliceDemoModuleData(DEMO_ADMIN_DATA, "dashboard") as DashboardData,
        error: null,
      },
      false,
    ),
    false,
  );
  assert.equal(
    shouldBeginModuleLoad({ ...idle, status: "error", error: "failed" }, true),
    true,
  );
});

test("formatModuleLoadError preserves safe AdminReadError diagnostics", () => {
  const message = formatModuleLoadError(
    "dashboard",
    new AdminReadError("access-denied", "recent_attempts"),
  );
  assert.match(message, /Loading dashboard could not be loaded\./);
  assert.match(message, /Operation: recent_attempts/);
  assert.match(message, /Code: access-denied/);
  assert.doesNotMatch(message, /eyJ/);
});
