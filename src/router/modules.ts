export const PRIMARY_NAVIGATION_IDS = [
  "dashboard",
  "hubs",
  "people",
  "assessment",
  "analytics",
  "system",
] as const;

export type PrimaryNavigationId = (typeof PRIMARY_NAVIGATION_IDS)[number];

export const LEGACY_MODULE_IDS = [
  "courses",
  "curriculum",
  "activities",
  "content-library",
  "composition",
  "learners",
  "teachers",
  "groups",
  "enrolments",
  "assignments",
  "results",
  "attempts",
  "monitoring",
  "certification",
  "configuration",
  "audit",
] as const;

export type LegacyModuleId = (typeof LEGACY_MODULE_IDS)[number];

export const ADMIN_MODULE_IDS = [
  ...PRIMARY_NAVIGATION_IDS,
  ...LEGACY_MODULE_IDS,
] as const;

export type AdminModuleId = (typeof ADMIN_MODULE_IDS)[number];

export type AdminNavigationGroup =
  | "Overview"
  | "Hubs & Curriculum"
  | "People"
  | "Assignments & Results"
  | "Analytics"
  | "System";

export interface AdminModuleDefinition {
  id: AdminModuleId;
  label: string;
  shortLabel: string;
  group: AdminNavigationGroup;
  eyebrow: string;
  description: string;
  capability: string;
  dataState: "available" | "partial" | "pending";
  /** Primary sidebar only — legacy routes stay reachable by URL. */
  visibleInNavigation?: boolean;
  /** Maps legacy URLs to a primary navigation highlight. */
  navigationHighlight?: PrimaryNavigationId;
}

export const PRIMARY_NAVIGATION: readonly AdminModuleDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    shortLabel: "DB",
    group: "Overview",
    eyebrow: "Platform overview",
    description: "Operational readiness across hubs, contracts and services.",
    capability: "dashboard.read",
    dataState: "available",
  },
  {
    id: "hubs",
    label: "Hubs & Curriculum",
    shortLabel: "HC",
    group: "Hubs & Curriculum",
    eyebrow: "Hub and curriculum management",
    description: "Discover hubs, inspect publication state and author curriculum for each course.",
    capability: "hubs.read",
    dataState: "available",
  },
  {
    id: "people",
    label: "People",
    shortLabel: "PE",
    group: "People",
    eyebrow: "Learners, groups and staff",
    description: "Inspect learners, academic groups, staff authority and enrolment relationships.",
    capability: "learners.read",
    dataState: "available",
  },
  {
    id: "assessment",
    label: "Assignments & Results",
    shortLabel: "AR",
    group: "Assignments & Results",
    eyebrow: "Delivery and markbook",
    description: "Review assignments, group results and learner attempt summaries.",
    capability: "assignments.read",
    dataState: "available",
  },
  {
    id: "analytics",
    label: "Analytics",
    shortLabel: "AN",
    group: "Analytics",
    eyebrow: "Assessment and insight",
    description: "Review completion, performance, and learners needing attention.",
    capability: "analytics.read",
    dataState: "available",
  },
  {
    id: "system",
    label: "System",
    shortLabel: "SY",
    group: "System",
    eyebrow: "Operations and governance",
    description: "Platform status, audit events, access and advanced configuration.",
    capability: "monitoring.read",
    dataState: "partial",
  },
] as const;

export const LEGACY_MODULES: readonly AdminModuleDefinition[] = [
  {
    id: "courses",
    label: "Courses",
    shortLabel: "CO",
    group: "Hubs & Curriculum",
    eyebrow: "Course catalogue",
    description: "Course information is shown in hub context. This legacy route opens the hub registry.",
    capability: "courses.read",
    dataState: "partial",
    visibleInNavigation: false,
    navigationHighlight: "hubs",
  },
  {
    id: "curriculum",
    label: "Curriculum",
    shortLabel: "CU",
    group: "Hubs & Curriculum",
    eyebrow: "Curriculum authoring",
    description: "Edit and publish a hub curriculum package.",
    capability: "curriculum.author",
    dataState: "partial",
    visibleInNavigation: false,
    navigationHighlight: "hubs",
  },
  {
    id: "content-library",
    label: "Content Library",
    shortLabel: "CL",
    group: "Hubs & Curriculum",
    eyebrow: "Reusable master assets",
    description: "Reusable questions, activities and templates. Open from curriculum editing when needed.",
    capability: "content-library.read",
    dataState: "available",
    visibleInNavigation: false,
    navigationHighlight: "hubs",
  },
  {
    id: "composition",
    label: "Composition",
    shortLabel: "CP",
    group: "Hubs & Curriculum",
    eyebrow: "Assemble curriculum drafts",
    description: "Legacy composition route. Prefer adding activities from the curriculum editor.",
    capability: "composition.author",
    dataState: "available",
    visibleInNavigation: false,
    navigationHighlight: "hubs",
  },
  {
    id: "activities",
    label: "Activity catalogue",
    shortLabel: "AC",
    group: "Hubs & Curriculum",
    eyebrow: "Deferred delivery catalogue",
    description: "Reserved for a future group-delivery activity catalogue.",
    capability: "activities.read",
    dataState: "pending",
    visibleInNavigation: false,
    navigationHighlight: "hubs",
  },
  {
    id: "learners",
    label: "Learners",
    shortLabel: "LE",
    group: "People",
    eyebrow: "Learner administration",
    description: "Inspect learner profiles and platform relationships.",
    capability: "learners.read",
    dataState: "available",
    visibleInNavigation: false,
    navigationHighlight: "people",
  },
  {
    id: "teachers",
    label: "Staff",
    shortLabel: "ST",
    group: "People",
    eyebrow: "Platform staff authority",
    description: "Review staff profiles, group access and platform roles.",
    capability: "teachers.read",
    dataState: "partial",
    visibleInNavigation: false,
    navigationHighlight: "people",
  },
  {
    id: "groups",
    label: "Groups",
    shortLabel: "GR",
    group: "People",
    eyebrow: "Cohort administration",
    description: "Review academic groups, registration state and course links.",
    capability: "groups.read",
    dataState: "available",
    visibleInNavigation: false,
    navigationHighlight: "people",
  },
  {
    id: "enrolments",
    label: "Enrolments",
    shortLabel: "EN",
    group: "People",
    eyebrow: "Learner relationships",
    description: "Enrolment records are shown on learner and group screens.",
    capability: "enrolments.read",
    dataState: "available",
    visibleInNavigation: false,
    navigationHighlight: "people",
  },
  {
    id: "assignments",
    label: "Assignments",
    shortLabel: "AS",
    group: "Assignments & Results",
    eyebrow: "Learning delivery",
    description: "Review activity delivery, assignment windows and group availability.",
    capability: "assignments.read",
    dataState: "available",
    visibleInNavigation: false,
    navigationHighlight: "assessment",
  },
  {
    id: "results",
    label: "Results",
    shortLabel: "RS",
    group: "Assignments & Results",
    eyebrow: "Markbook",
    description: "Inspect group, learner and activity results.",
    capability: "results.read",
    dataState: "available",
    visibleInNavigation: false,
    navigationHighlight: "assessment",
  },
  {
    id: "attempts",
    label: "Attempts",
    shortLabel: "AT",
    group: "Assignments & Results",
    eyebrow: "Learning evidence",
    description: "Attempt summaries are available from Results.",
    capability: "attempts.read",
    dataState: "available",
    visibleInNavigation: false,
    navigationHighlight: "assessment",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    shortLabel: "MO",
    group: "System",
    eyebrow: "Platform operations",
    description: "Legacy monitoring route. Opens System status.",
    capability: "monitoring.read",
    dataState: "partial",
    visibleInNavigation: false,
    navigationHighlight: "system",
  },
  {
    id: "certification",
    label: "Certification",
    shortLabel: "CE",
    group: "System",
    eyebrow: "LHDS assurance",
    description: "Assurance metadata is shown under System status.",
    capability: "certification.read",
    dataState: "partial",
    visibleInNavigation: false,
    navigationHighlight: "system",
  },
  {
    id: "configuration",
    label: "Configuration",
    shortLabel: "CF",
    group: "System",
    eyebrow: "Platform governance",
    description: "Advanced configuration is under System → Advanced.",
    capability: "configuration.read",
    dataState: "available",
    visibleInNavigation: false,
    navigationHighlight: "system",
  },
  {
    id: "audit",
    label: "Audit",
    shortLabel: "AU",
    group: "System",
    eyebrow: "Governance and traceability",
    description: "Search safe administrative audit events.",
    capability: "audit.read",
    dataState: "available",
    visibleInNavigation: false,
    navigationHighlight: "system",
  },
] as const;

export const ADMIN_MODULES: readonly AdminModuleDefinition[] = [
  ...PRIMARY_NAVIGATION,
  ...LEGACY_MODULES,
];

export const ADMIN_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  "Overview",
  "Hubs & Curriculum",
  "People",
  "Assignments & Results",
  "Analytics",
  "System",
];

export function isAdminModuleId(value: string): value is AdminModuleId {
  return ADMIN_MODULE_IDS.includes(value as AdminModuleId);
}

export function isPrimaryNavigationId(value: string): value is PrimaryNavigationId {
  return PRIMARY_NAVIGATION_IDS.includes(value as PrimaryNavigationId);
}

export function getAdminModule(id: AdminModuleId) {
  return ADMIN_MODULES.find((module) => module.id === id) ?? PRIMARY_NAVIGATION[0];
}

export function getModuleHref(id: AdminModuleId) {
  return id === "dashboard" ? "/" : `/${id}`;
}

/** Sidebar highlight for legacy URLs mapped into a primary area. */
export function resolveNavigationModule(moduleId: AdminModuleId): PrimaryNavigationId {
  if (isPrimaryNavigationId(moduleId)) return moduleId;
  const legacy = LEGACY_MODULES.find((module) => module.id === moduleId);
  return legacy?.navigationHighlight ?? "dashboard";
}

export function primaryNavigationModules() {
  return PRIMARY_NAVIGATION;
}
