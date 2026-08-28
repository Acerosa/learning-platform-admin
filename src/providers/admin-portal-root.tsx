"use client";

import { AdminPortalProvider } from "../stores/admin-portal";

export function AdminPortalRoot({ children }: { children: React.ReactNode }) {
  return <AdminPortalProvider>{children}</AdminPortalProvider>;
}
