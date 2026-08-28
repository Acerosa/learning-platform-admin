"use client";

import {
  AdminAccessDenied,
  AdminLoadingState,
  AdminSignIn,
  AdminUnavailable,
} from "../components/admin-access-gate";
import { AdminShell } from "../layouts/admin-shell";
import type { AdminModuleId } from "../router/modules";
import {
  useAdminPortal,
} from "../stores/admin-portal";
import { ModuleContent } from "./module-content";

export function AdminPortalFrame({ moduleId }: { moduleId: AdminModuleId }) {
  const portal = useAdminPortal();

  if (portal.status === "loading" && !portal.data) return <AdminLoadingState />;
  if (portal.status === "signed-out") {
    return (
      <AdminSignIn
        message={portal.authMessage}
        onSignIn={portal.signIn}
        onSignUp={portal.signUp}
        onMagicLink={portal.requestMagicLink}
      />
    );
  }
  if (portal.status === "access-denied") {
    return (
      <AdminAccessDenied
        displayName={portal.session.displayName}
        message={portal.authMessage}
        onClaimInitialAdmin={portal.claimInitialAdmin}
        onSignOut={portal.signOut}
      />
    );
  }
  if (portal.status === "error" || !portal.data) {
    return <AdminUnavailable message={portal.authMessage} onRetry={portal.retry} />;
  }

  return (
    <AdminShell
      activeModule={moduleId}
      session={portal.session}
      dataSource={portal.dataSource}
      onSignOut={portal.config.mode === "live" ? portal.signOut : undefined}
    >
      <ModuleContent moduleId={moduleId} />
    </AdminShell>
  );
}
