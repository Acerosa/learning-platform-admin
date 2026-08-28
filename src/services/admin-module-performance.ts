import type { AdminModuleDataKey } from "../api/admin-module-data";

const DEV = process.env.NODE_ENV !== "production";

export interface AdminModulePerformanceSnapshot {
  bootstrapReads: readonly string[];
  moduleReads: Partial<Record<AdminModuleDataKey, readonly string[]>>;
  cacheHits: Partial<Record<AdminModuleDataKey, number>>;
  bootstrapStartedAt: number | null;
  bootstrapCompletedAt: number | null;
  moduleStartedAt: Partial<Record<AdminModuleDataKey, number>>;
  moduleCompletedAt: Partial<Record<AdminModuleDataKey, number>>;
}

const performanceState: AdminModulePerformanceSnapshot = {
  bootstrapReads: [],
  moduleReads: {},
  cacheHits: {},
  bootstrapStartedAt: null,
  bootstrapCompletedAt: null,
  moduleStartedAt: {},
  moduleCompletedAt: {},
};

export function resetAdminModulePerformance(): void {
  performanceState.bootstrapReads = [];
  performanceState.moduleReads = {};
  performanceState.cacheHits = {};
  performanceState.bootstrapStartedAt = null;
  performanceState.bootstrapCompletedAt = null;
  performanceState.moduleStartedAt = {};
  performanceState.moduleCompletedAt = {};
}

export function getAdminModulePerformanceSnapshot(): AdminModulePerformanceSnapshot {
  return {
    bootstrapReads: [...performanceState.bootstrapReads],
    moduleReads: { ...performanceState.moduleReads },
    cacheHits: { ...performanceState.cacheHits },
    bootstrapStartedAt: performanceState.bootstrapStartedAt,
    bootstrapCompletedAt: performanceState.bootstrapCompletedAt,
    moduleStartedAt: { ...performanceState.moduleStartedAt },
    moduleCompletedAt: { ...performanceState.moduleCompletedAt },
  };
}

export function markBootstrapStarted(): void {
  if (!DEV) return;
  performanceState.bootstrapStartedAt = Date.now();
  console.debug("[admin-perf] bootstrap started");
}

export function recordBootstrapReads(reads: readonly string[]): void {
  if (!DEV) return;
  performanceState.bootstrapReads = [...performanceState.bootstrapReads, ...reads];
  console.debug("[admin-perf] bootstrap reads:", reads.join(", "));
}

export function markBootstrapCompleted(): void {
  if (!DEV) return;
  performanceState.bootstrapCompletedAt = Date.now();
  const duration = performanceState.bootstrapStartedAt
    ? performanceState.bootstrapCompletedAt - performanceState.bootstrapStartedAt
    : null;
  console.debug(
    "[admin-perf] bootstrap completed",
    duration !== null ? `in ${duration}ms` : "",
    `(${performanceState.bootstrapReads.length} reads)`,
  );
}

export function markModuleLoadStarted(key: AdminModuleDataKey): void {
  if (!DEV) return;
  performanceState.moduleStartedAt[key] = Date.now();
  console.debug(`[admin-perf] module ${key} load started`);
}

export function recordModuleReads(key: AdminModuleDataKey, reads: readonly string[]): void {
  if (!DEV) return;
  const existing = performanceState.moduleReads[key] ?? [];
  performanceState.moduleReads[key] = [...existing, ...reads];
  console.debug(`[admin-perf] module ${key} reads:`, reads.join(", "));
}

export function markModuleLoadCompleted(key: AdminModuleDataKey): void {
  if (!DEV) return;
  performanceState.moduleCompletedAt[key] = Date.now();
  const started = performanceState.moduleStartedAt[key];
  const duration = started ? performanceState.moduleCompletedAt[key]! - started : null;
  const readCount = performanceState.moduleReads[key]?.length ?? 0;
  console.debug(
    `[admin-perf] module ${key} completed`,
    duration !== null ? `in ${duration}ms` : "",
    `(${readCount} reads)`,
  );
}

export function recordModuleCacheHit(key: AdminModuleDataKey): void {
  if (!DEV) return;
  performanceState.cacheHits[key] = (performanceState.cacheHits[key] ?? 0) + 1;
  console.debug(`[admin-perf] module ${key} cache hit`);
}
