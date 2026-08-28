"use client";

import { useEffect, useMemo } from "react";
import type { AdminModuleDataKey } from "../api/admin-module-data";
import { useAdminPortal } from "./admin-portal";

export function useAdminModuleData(moduleKey: AdminModuleDataKey) {
  const portal = useAdminPortal();
  const entry = portal.moduleCache[moduleKey];

  useEffect(() => {
    if (portal.status !== "ready") return;
    void portal.ensureModuleData(moduleKey);
  }, [moduleKey, portal, portal.status]);

  return useMemo(() => ({
    status: entry.status,
    data: entry.data,
    error: entry.error,
    refresh: () => portal.refreshModuleData(moduleKey),
  }), [entry.data, entry.error, entry.status, moduleKey, portal]);
}
