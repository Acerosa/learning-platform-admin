import type { AdminModuleId } from "./modules";

export type PeopleTab = "learners" | "groups" | "staff";
export type AssessmentTab = "assignments" | "results";
export type SystemTab = "status" | "audit" | "access" | "advanced";

export type LegacyRouteContext = {
  peopleTab?: PeopleTab;
  assessmentTab?: AssessmentTab;
  systemTab?: SystemTab;
  /** Prefer hub registry instead of a standalone courses screen. */
  aliasHubRegistry?: boolean;
};

const LEGACY_ROUTE_CONTEXT: Partial<Record<AdminModuleId, LegacyRouteContext>> = {
  courses: { aliasHubRegistry: true },
  learners: { peopleTab: "learners" },
  teachers: { peopleTab: "staff" },
  groups: { peopleTab: "groups" },
  enrolments: { peopleTab: "learners" },
  assignments: { assessmentTab: "assignments" },
  results: { assessmentTab: "results" },
  attempts: { assessmentTab: "results" },
  monitoring: { systemTab: "status" },
  certification: { systemTab: "status" },
  configuration: { systemTab: "advanced" },
  audit: { systemTab: "audit" },
};

export function legacyRouteContext(moduleId: AdminModuleId): LegacyRouteContext {
  if (moduleId === "people") return { peopleTab: "learners" };
  if (moduleId === "assessment") return { assessmentTab: "assignments" };
  if (moduleId === "system") return { systemTab: "status" };
  return LEGACY_ROUTE_CONTEXT[moduleId] ?? {};
}

/** Optional client redirect target when a legacy URL has a canonical primary route. */
export function legacyRedirectTarget(moduleId: AdminModuleId): string | null {
  switch (moduleId) {
    case "courses":
      return "/hubs";
    case "learners":
      return "/people";
    case "teachers":
      return "/people";
    case "groups":
      return "/people";
    case "enrolments":
      return "/people";
    case "assignments":
      return "/assessment";
    case "results":
      return "/assessment";
    case "attempts":
      return "/assessment";
    case "monitoring":
      return "/system";
    case "certification":
      return "/system";
    case "configuration":
      return "/system";
    case "audit":
      return "/system";
    default:
      return null;
  }
}
