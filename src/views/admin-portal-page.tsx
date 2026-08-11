import { AdminShell } from "../layouts/admin-shell";
import type { AdminModuleId } from "../router/modules";
import { ModuleContent } from "./module-content";

export function AdminPortalPage({ moduleId }: { moduleId: AdminModuleId }) {
  return (
    <AdminShell activeModule={moduleId}>
      <ModuleContent moduleId={moduleId} />
    </AdminShell>
  );
}
