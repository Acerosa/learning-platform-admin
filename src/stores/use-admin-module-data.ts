"use client";

import { useEffect, useMemo } from "react";
import type { AdminModuleDataKey } from "../api/admin-module-data";
import { shouldAutoLoadModule } from "./admin-module-loader";
import { useAdminPortal } from "./admin-portal";

export function useAdminModuleData(moduleKey: AdminModuleDataKey) {
  const {
    status: portalStatus,
    moduleCache,
    ensureModuleData,
    refreshModuleData,
  } = useAdminPortal();
  const entry = moduleCache[moduleKey];

  useEffect(() => {
    if (!shouldAutoLoadModule(portalStatus, entry.status)) return;
    void ensureModuleData(moduleKey);
  }, [moduleKey, entry.status, portalStatus, ensureModuleData]);

  return useMemo(() => ({
    status: entry.status,
    data: entry.data,
    error: entry.error,
    refresh: () => refreshModuleData(moduleKey),
  }), [entry.data, entry.error, entry.status, moduleKey, refreshModuleData]);
}
