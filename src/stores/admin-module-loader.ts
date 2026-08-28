import type { AdminDataSnapshot, AdminReadService } from "../api/admin-api.ts";
import type {
  AdminBootstrapData,
  AdminModuleCacheEntry,
  AdminModuleCacheState,
  AdminModuleDataKey,
  AdminModulePayload,
  ModuleLoadStatus,
} from "../api/admin-module-data.ts";
import { sliceDemoModuleData } from "../api/admin-module-data.ts";
import {
  loadAdminBootstrapData,
  loadAnalyticsData,
  loadAssignmentsResultsData,
  loadDashboardData,
  loadHubsCurriculumData,
  loadPeopleData,
  loadSystemData,
} from "../services/admin-data-loaders.ts";

export function isModuleReady(entry: AdminModuleCacheEntry): boolean {
  return entry.status === "ready" || entry.status === "refreshing";
}

export function invalidateModuleCache(
  cache: AdminModuleCacheState,
  keys: readonly AdminModuleDataKey[],
): AdminModuleCacheState {
  const next = { ...cache };
  for (const key of keys) {
    next[key] = { status: "idle", data: null, error: null };
  }
  return next;
}

export function setModuleCacheEntry<K extends AdminModuleDataKey>(
  cache: AdminModuleCacheState,
  key: K,
  patch: Partial<AdminModuleCacheEntry<K>>,
): AdminModuleCacheState {
  return {
    ...cache,
    [key]: {
      ...cache[key],
      ...patch,
    } as AdminModuleCacheEntry<K>,
  };
}

export function moduleStatusForLoad(
  current: ModuleLoadStatus,
  refresh: boolean,
): ModuleLoadStatus {
  if (refresh && (current === "ready" || current === "refreshing")) return "refreshing";
  return "loading";
}

export async function fetchAdminBootstrapData(
  service: AdminReadService,
  demoSnapshot?: AdminDataSnapshot | null,
): Promise<AdminBootstrapData> {
  if (demoSnapshot) {
    return Object.freeze({ dashboardSummary: demoSnapshot.dashboardSummary });
  }
  return loadAdminBootstrapData(service);
}

export async function fetchModuleData<K extends AdminModuleDataKey>(
  key: K,
  service: AdminReadService,
  options?: {
    bootstrap?: AdminBootstrapData | null;
    demoSnapshot?: AdminDataSnapshot | null;
  },
): Promise<AdminModulePayload[K]> {
  if (options?.demoSnapshot) {
    const slice = sliceDemoModuleData as (
      snapshot: AdminDataSnapshot,
      moduleKey: AdminModuleDataKey,
    ) => AdminModulePayload[AdminModuleDataKey];
    return slice(options.demoSnapshot, key) as AdminModulePayload[K];
  }

  switch (key) {
    case "dashboard":
      return loadDashboardData(service, options?.bootstrap) as Promise<AdminModulePayload[K]>;
    case "hubs-curriculum":
      return loadHubsCurriculumData(service) as Promise<AdminModulePayload[K]>;
    case "people":
      return loadPeopleData(service) as Promise<AdminModulePayload[K]>;
    case "assignments-results":
      return loadAssignmentsResultsData(service) as Promise<AdminModulePayload[K]>;
    case "analytics":
      return loadAnalyticsData(service) as Promise<AdminModulePayload[K]>;
    case "system":
      return loadSystemData(service) as Promise<AdminModulePayload[K]>;
  }
}

export const HUB_MUTATION_INVALIDATES: readonly AdminModuleDataKey[] = [
  "hubs-curriculum",
  "dashboard",
];

export const CURRICULUM_MUTATION_INVALIDATES: readonly AdminModuleDataKey[] = [
  "hubs-curriculum",
  "dashboard",
];

export const REVIEW_MUTATION_INVALIDATES: readonly AdminModuleDataKey[] = [
  "assignments-results",
  "analytics",
];
