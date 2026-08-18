export const ADMIN_MODULE_IDS = [
  "dashboard",
  "hubs",
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
  visibleInNavigation?: boolean;
}

export const ADMIN_MODULES: readonly AdminModuleDefinition[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "DB", group: "Overview", eyebrow: "Platform overview", description: "Operational readiness across hubs, contracts and services.", capability: "dashboard.read", dataState: "available" },
  { id: "hubs", label: "Hub registry", shortLabel: "HB", group: "Overview", eyebrow: "Hub management", description: "Discover, inspect and prepare lifecycle changes for every learner hub.", capability: "hubs.read", dataState: "available" },
  { id: "courses", label: "Courses", shortLabel: "CO", group: "Learning", eyebrow: "Curriculum administration", description: "Review the platform course catalogue and hub associations.", capability: "courses.read", dataState: "partial" },
  { id: "content-library", label: "Content Library", shortLabel: "CL", group: "Learning", eyebrow: "Reusable master assets", description: "Manage reusable questions, activities, templates and resources. This is not publication.", capability: "content-library.read", dataState: "available" },
  { id: "composition", label: "Composition", shortLabel: "CP", group: "Learning", eyebrow: "Assemble a curriculum draft", description: "Assemble library assets into a standard curriculum draft. Publication happens in Curriculum authoring.", capability: "composition.author", dataState: "available" },
  { id: "curriculum", label: "Curriculum authoring", shortLabel: "CU", group: "Learning", eyebrow: "Edit and publish a hub curriculum", description: "Open a hub/course package as a draft, edit teaching copy, validate, approve and publish to the platform.", capability: "curriculum.author", dataState: "partial" },
  { id: "activities", label: "Activity catalogue", shortLabel: "AC", group: "Learning", eyebrow: "Deferred delivery catalogue", description: "Reserved for a future group-delivery activity catalogue. Teaching content is edited in Curriculum authoring or Content Library.", capability: "activities.read", dataState: "pending", visibleInNavigation: false },
  { id: "learners", label: "Learners", shortLabel: "LE", group: "People", eyebrow: "Learner administration", description: "Inspect learner profiles and their platform relationships.", capability: "learners.read", dataState: "available" },
  { id: "teachers", label: "Teachers", shortLabel: "TE", group: "People", eyebrow: "Staff administration", description: "Review teacher profiles, group access and platform roles.", capability: "teachers.read", dataState: "partial" },
  { id: "groups", label: "Groups", shortLabel: "GR", group: "People", eyebrow: "Cohort administration", description: "Review academic groups, registration state and course links.", capability: "groups.read", dataState: "available" },
  { id: "enrolments", label: "Enrolments", shortLabel: "EN", group: "People", eyebrow: "Learner administration", description: "Inspect current and historical multi-course enrolments.", capability: "enrolments.read", dataState: "available" },
  { id: "assignments", label: "Assignments", shortLabel: "AS", group: "Operations", eyebrow: "Learning delivery", description: "Review activity delivery, assignment windows and group availability.", capability: "assignments.read", dataState: "available" },
  { id: "results", label: "Results", shortLabel: "RS", group: "Operations", eyebrow: "Markbook", description: "Inspect group, learner and activity results using shared educational interpretation.", capability: "results.read", dataState: "available" },
  { id: "attempts", label: "Attempts", shortLabel: "AT", group: "Operations", eyebrow: "Learning evidence", description: "Inspect safe submission summaries without opening the Results workflow.", capability: "attempts.read", dataState: "available" },
  { id: "analytics", label: "Analytics", shortLabel: "AN", group: "Operations", eyebrow: "Assessment and insight", description: "Review assessment overview, group/learner/activity performance, topic and skill rollups, and explainable attention signals.", capability: "analytics.read", dataState: "available" },
  { id: "monitoring", label: "Monitoring", shortLabel: "MO", group: "Operations", eyebrow: "Platform operations", description: "Track service health, compatibility and operational signals.", capability: "monitoring.read", dataState: "partial" },
  { id: "certification", label: "Certification", shortLabel: "CE", group: "Assurance", eyebrow: "LHDS assurance", description: "Review hub accessibility, testing, security and compatibility evidence.", capability: "certification.read", dataState: "partial" },
  { id: "configuration", label: "Configuration", shortLabel: "CF", group: "Assurance", eyebrow: "Platform governance", description: "Review platform contracts, feature state and administrative boundaries.", capability: "configuration.read", dataState: "available" },
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
