export const ADMIN_MODULE_IDS = [
  "dashboard",
  "hubs",
  "courses",
  "curriculum",
  "activities",
  "learners",
  "teachers",
  "groups",
  "enrolments",
  "assignments",
  "analytics",
  "monitoring",
  "certification",
  "configuration",
  "audit",
] as const;

export type AdminModuleId = (typeof ADMIN_MODULE_IDS)[number];
export type AdminNavigationGroup = "Overview" | "Learning" | "People" | "Operations" | "Assurance";

export interface AdminModuleDefinition {
  id: AdminModuleId;
  label: string;
  shortLabel: string;
  group: AdminNavigationGroup;
  eyebrow: string;
  description: string;
  capability: string;
  dataState: "available" | "partial" | "pending";
}

export const ADMIN_MODULES: readonly AdminModuleDefinition[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "DB", group: "Overview", eyebrow: "Platform overview", description: "Operational readiness across hubs, contracts and services.", capability: "dashboard.read", dataState: "partial" },
  { id: "hubs", label: "Hub registry", shortLabel: "HB", group: "Overview", eyebrow: "Hub management", description: "Discover, inspect and prepare lifecycle changes for every learner hub.", capability: "hubs.read", dataState: "available" },
  { id: "courses", label: "Courses", shortLabel: "CO", group: "Learning", eyebrow: "Curriculum administration", description: "Review the platform course catalogue and hub associations.", capability: "courses.read", dataState: "partial" },
  { id: "curriculum", label: "Curriculum", shortLabel: "CU", group: "Learning", eyebrow: "Curriculum administration", description: "Manage curriculum structure, metadata and publication readiness.", capability: "curriculum.read", dataState: "pending" },
  { id: "activities", label: "Activities", shortLabel: "AC", group: "Learning", eyebrow: "Curriculum administration", description: "Review activity definitions, evidence capabilities and lifecycle state.", capability: "activities.read", dataState: "partial" },
  { id: "learners", label: "Learners", shortLabel: "LE", group: "People", eyebrow: "Learner administration", description: "Inspect learner profiles and their platform relationships.", capability: "learners.read", dataState: "available" },
  { id: "teachers", label: "Teachers", shortLabel: "TE", group: "People", eyebrow: "Staff administration", description: "Review teacher profiles, group access and platform roles.", capability: "teachers.read", dataState: "partial" },
  { id: "groups", label: "Groups", shortLabel: "GR", group: "People", eyebrow: "Cohort administration", description: "Review academic groups, registration state and course links.", capability: "groups.read", dataState: "available" },
  { id: "enrolments", label: "Enrolments", shortLabel: "EN", group: "People", eyebrow: "Learner administration", description: "Inspect current and historical multi-course enrolments.", capability: "enrolments.read", dataState: "available" },
  { id: "assignments", label: "Assignments", shortLabel: "AS", group: "Operations", eyebrow: "Learning delivery", description: "Review activity delivery, assignment windows and group availability.", capability: "assignments.read", dataState: "available" },
  { id: "analytics", label: "Analytics", shortLabel: "AN", group: "Operations", eyebrow: "Evidence and insight", description: "Prepare learner, group, question and outcome analytics surfaces.", capability: "analytics.read", dataState: "pending" },
  { id: "monitoring", label: "Monitoring", shortLabel: "MO", group: "Operations", eyebrow: "Platform operations", description: "Track service health, compatibility and operational signals.", capability: "monitoring.read", dataState: "partial" },
  { id: "certification", label: "Certification", shortLabel: "CE", group: "Assurance", eyebrow: "LHDS assurance", description: "Review hub accessibility, testing, security and compatibility evidence.", capability: "certification.read", dataState: "partial" },
  { id: "configuration", label: "Configuration", shortLabel: "CF", group: "Assurance", eyebrow: "Platform governance", description: "Review platform contracts, feature state and administrative boundaries.", capability: "configuration.read", dataState: "partial" },
  { id: "audit", label: "Audit", shortLabel: "AU", group: "Assurance", eyebrow: "Governance and traceability", description: "Search safe administrative audit events without exposing sensitive context.", capability: "audit.read", dataState: "available" },
] as const;

export const ADMIN_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  "Overview",
  "Learning",
  "People",
  "Operations",
  "Assurance",
];

export function isAdminModuleId(value: string): value is AdminModuleId {
  return ADMIN_MODULE_IDS.includes(value as AdminModuleId);
}

export function getAdminModule(id: AdminModuleId) {
  return ADMIN_MODULES.find((module) => module.id === id) ?? ADMIN_MODULES[0];
}

export function getModuleHref(id: AdminModuleId) {
  return id === "dashboard" ? "/" : `/${id}`;
}
