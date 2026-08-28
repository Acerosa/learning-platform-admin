import assert from "node:assert/strict";
import test from "node:test";
import { createWeek } from "../src/content/factories.ts";
import {
  loadDrafts,
  migrateRecord,
  persistDrafts,
  saveDraft,
  STORAGE_QUOTA_WARNING,
} from "../src/content/draft-store.ts";
import { createDraft } from "../src/content/versioning.ts";
import { isStorageQuotaError, writeLocalStorageItem } from "../src/content/local-storage.ts";

class MemoryStorage {
  #data = new Map<string, string>();

  getItem(key: string) {
    return this.#data.has(key) ? this.#data.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.#data.set(key, value);
  }

  removeItem(key: string) {
    this.#data.delete(key);
  }

  get size() {
    return this.#data.size;
  }
}

test("isStorageQuotaError recognises quota failures", () => {
  assert.equal(isStorageQuotaError(new DOMException("quota", "QuotaExceededError")), true);
  assert.equal(isStorageQuotaError(new DOMException("quota", "NS_ERROR_DOM_QUOTA_REACHED")), true);
  assert.equal(isStorageQuotaError(new Error("Something else")), false);
});

test("persistDrafts returns quotaExceeded without throwing", () => {
  const storage = new MemoryStorage();
  const original = globalThis.window;
  globalThis.window = {
    localStorage: {
      setItem(key: string, value: string) {
        storage.setItem(key, value);
        if (storage.size > 0 && value.length > 10) {
          throw new DOMException("quota", "QuotaExceededError");
        }
      },
      removeItem(key: string) {
        storage.removeItem(key);
      },
    },
  } as Window & typeof globalThis;

  try {
    const draft = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada");
    draft.package.weeks = [createWeek({ id: "week-1", teachingWeek: 1, title: "Week 1" })];
    const result = persistDrafts([draft]);
    assert.equal(result.ok, false);
    assert.equal(result.quotaExceeded, true);
  } finally {
    globalThis.window = original;
  }
});

test("loadDrafts migrates and prunes immutable publication history from existing storage", () => {
  const storage = new MemoryStorage();
  const original = globalThis.window;
  const unit3Draft = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada");
  const l2eDraft = createDraft("l2-emerging-tech", "L2 Emerging Tech", "l2-emerging-tech", "Ada");
  const published = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada");
  published.status = "published";
  published.version = "0.2.0";
  storage.setItem("lp.admin.authoring.records.v2", JSON.stringify([published, l2eDraft, unit3Draft]));

  globalThis.window = { localStorage: storage } as unknown as Window & typeof globalThis;

  try {
    const loaded = loadDrafts();
    assert.equal(loaded.length, 2);
    assert.ok(loaded.every((item) => item.status === "draft"));
    assert.ok(loaded.some((item) => item.hubId === "unit-3-cyber-security"));
    assert.ok(loaded.some((item) => item.hubId === "l2-emerging-tech"));
    const rewritten = JSON.parse(storage.getItem("lp.admin.authoring.records.v2") || "[]") as unknown[];
    assert.equal(rewritten.length, 2);
  } finally {
    globalThis.window = original;
  }
});

test("saveDraft keeps unrelated localStorage keys intact when recovering from quota", () => {
  const storage = new MemoryStorage();
  storage.setItem("supabase.auth.token", "keep-me");
  const original = globalThis.window;
  let attempts = 0;
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => storage.getItem(key),
      setItem(key: string, value: string) {
        attempts += 1;
        if (key === "lp.admin.authoring.records.v2" && attempts === 1) {
          throw new DOMException("quota", "QuotaExceededError");
        }
        storage.setItem(key, value);
      },
      removeItem: (key: string) => storage.removeItem(key),
    },
  } as Window & typeof globalThis;

  try {
    const draft = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada");
    saveDraft([], draft);
    assert.equal(storage.getItem("supabase.auth.token"), "keep-me");
    assert.ok(storage.getItem("lp.admin.authoring.records.v2"));
  } finally {
    globalThis.window = original;
  }
});

test("writeLocalStorageItem retries after removing the target key on quota failure", () => {
  const storage = new MemoryStorage();
  storage.setItem("lp.admin.authoring.records.v2", "stale");
  const original = globalThis.window;
  let attempts = 0;
  globalThis.window = {
    localStorage: {
      setItem(key: string, value: string) {
        attempts += 1;
        if (attempts === 1) throw new DOMException("quota", "QuotaExceededError");
        storage.setItem(key, value);
      },
      removeItem(key: string) {
        storage.removeItem(key);
      },
    },
  } as Window & typeof globalThis;

  try {
    const result = writeLocalStorageItem("lp.admin.authoring.records.v2", "[]");
    assert.equal(result.ok, true);
    assert.equal(storage.getItem("lp.admin.authoring.records.v2"), "[]");
  } finally {
    globalThis.window = original;
  }
});

test("storage quota warning copy is administrator-friendly", () => {
  assert.match(STORAGE_QUOTA_WARNING, /local browser draft cache is full/i);
  assert.match(STORAGE_QUOTA_WARNING, /platform content is unaffected/i);
});

test("migrateRecord preserves hub and course context", () => {
  const draft = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada");
  const migrated = migrateRecord(draft);
  assert.equal(migrated?.hubId, "unit-3-cyber-security");
  assert.equal(migrated?.courseKey, "ocr-level-3-it");
});
