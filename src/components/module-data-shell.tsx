"use client";

import type { ReactNode } from "react";
import type { AdminModuleDataKey } from "../api/admin-module-data";
import { moduleLoadingLabel } from "../api/admin-module-data";
import { useAdminModuleData } from "../stores/use-admin-module-data";

function ModuleLoadingState({ label }: { label: string }) {
  return (
    <div className="module-loading" role="status" aria-live="polite">
      <span className="module-loading__spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

function ModuleErrorState({
  label,
  message,
  onRetry,
}: {
  label: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="module-loading module-loading--error" role="alert">
      <p><strong>{label}</strong></p>
      <p>{message}</p>
      <button className="button button--secondary" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function ModuleDataShell({
  moduleKey,
  children,
}: {
  moduleKey: AdminModuleDataKey;
  children: ReactNode;
}) {
  const moduleState = useAdminModuleData(moduleKey);

  if (moduleState.status === "loading") {
    return <ModuleLoadingState label={moduleLoadingLabel(moduleKey)} />;
  }

  if (moduleState.status === "error") {
    return (
      <ModuleErrorState
        label={`${moduleLoadingLabel(moduleKey).replace(/…$/, "")} unavailable`}
        message={moduleState.error ?? "This module could not be loaded."}
        onRetry={() => void moduleState.refresh()}
      />
    );
  }

  return <>{children}</>;
}
