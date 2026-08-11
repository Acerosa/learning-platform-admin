import { notFound } from "next/navigation";
import { AdminPortalPage } from "@/src/views/admin-portal-page";
import {
  ADMIN_MODULES,
  isAdminModuleId,
} from "@/src/router/modules";

export function generateStaticParams() {
  return ADMIN_MODULES.filter((module) => module.id !== "dashboard").map(
    (module) => ({ module: module.id }),
  );
}

export default async function ModuleRoute({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;

  if (!isAdminModuleId(module) || module === "dashboard") {
    notFound();
  }

  return <AdminPortalPage moduleId={module} />;
}
