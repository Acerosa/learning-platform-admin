"use client";

import {
  AdminAccessDenied,
  AdminLoadingState,
  AdminPasswordReset,
  AdminRecoveryContinue,
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

  if (portal.status === "recovery-continue") {
    return (
      <AdminRecoveryContinue
        message={portal.authMessage}
        onContinue={portal.continueRecovery}
      />
    );
  }
  if (portal.status === "authenticating") {
    return (
      <AdminLoadingState
        title="Signing in"
        message="Checking your details with Supabase Auth."
      />
    );
  }
  if (portal.status === "recovery") {
    return (
      <AdminPasswordReset
        message={portal.authMessage}
        onUpdatePassword={portal.updatePassword}
        onCancel={portal.signOut}
      />
    );
  }
  if (portal.status === "loading" && !portal.bootstrapReady) {
    return (
      <AdminLoadingState
        title="Connecting to the live backend"
        message="Restoring the staff session and checking backend authority."
      />
    );
  }
  if (portal.status === "signed-out") {
    return (
      <AdminSignIn
        message={portal.authMessage}
        onSignIn={portal.signIn}
        onMagicLink={portal.requestMagicLink}
        onForgotPassword={portal.requestPasswordReset}
      />
    );
  }
  if (portal.status === "access-denied") {
    return (
      <AdminAccessDenied
        displayName={portal.session.displayName}
        message={portal.authMessage}
        onSignOut={portal.signOut}
      />
    );
  }
  if (portal.status === "error" || !portal.bootstrapReady) {
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
