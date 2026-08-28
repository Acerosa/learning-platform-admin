import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@learning-platform/core/tokens.css";
import "@learning-platform/core/theme.css";
import "../app/globals.css";
import { AdminPortalProvider } from "../src/stores/admin-portal";
import { isAdminModuleId, type AdminModuleId } from "../src/router/modules";
import { AdminPortalFrame } from "../src/views/admin-portal-page";

function readModuleFromHash(): AdminModuleId {
  const moduleId = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return moduleId && isAdminModuleId(moduleId) ? moduleId : "dashboard";
}

function GitHubPagesApp() {
  const [moduleId, setModuleId] = useState<AdminModuleId>(readModuleFromHash);

  useEffect(() => {
    const updateModule = () => setModuleId(readModuleFromHash());
    window.addEventListener("hashchange", updateModule);
    return () => window.removeEventListener("hashchange", updateModule);
  }, []);

  return <AdminPortalFrame moduleId={moduleId} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AdminPortalProvider>
      <GitHubPagesApp />
    </AdminPortalProvider>
  </StrictMode>,
);
