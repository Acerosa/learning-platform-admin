export type ResultSourceId =
  | "induction-readiness"
  | "assignment-markbook"
  | "l2e"
  | "l3e"
  | "unit-3-cyber-security"
  | "tlevel"
  | "unit-14"
  | "knowledge-reports";

export type ResultSourceKind = "diagnostic" | "assignment-markbook" | "hub-learning" | "knowledge-reports" | "unavailable";

export interface ResultSourceDefinition {
  id: ResultSourceId;
  label: string;
  kind: ResultSourceKind;
  description: string;
  available: boolean;
  hubCode?: string;
  expectedQuestionCount?: number;
}

export const INDUCTION_READINESS_SOURCE_ID: ResultSourceId = "induction-readiness";
export const ASSIGNMENT_MARKBOOK_SOURCE_ID: ResultSourceId = "assignment-markbook";

export const RESULT_SOURCES: readonly ResultSourceDefinition[] = Object.freeze([
  {
    id: "induction-readiness",
    label: "Induction / Readiness",
    kind: "diagnostic",
    description: "Level 3 IT Year 1 readiness diagnostic sittings.",
    available: true,
    hubCode: "level-3-it-year-1-readiness",
    expectedQuestionCount: 25,
  },
  {
    id: "assignment-markbook",
    label: "Assignment markbook",
    kind: "assignment-markbook",
    description: "Group, learner and activity results from stored attempts.",
    available: true,
  },
  {
    id: "l2e",
    label: "L2E",
    kind: "hub-learning",
    description: "Exploring Emerging Digital Technologies current class work.",
    available: true,
    hubCode: "l2e-exploring-emerging-digital-technologies",
  },
  {
    id: "l3e",
    label: "L3E",
    kind: "unavailable",
    description: "No L3E hub is registered, so this source stays unavailable.",
    available: false,
  },
  {
    id: "unit-3-cyber-security",
    label: "Unit 3 Cyber Security",
    kind: "hub-learning",
    description: "Unit 3 Cyber Security current class work.",
    available: true,
    hubCode: "unit-3-cyber-security",
  },
  {
    id: "tlevel",
    label: "T Level",
    kind: "hub-learning",
    description: "T Level Digital Software Development current class work.",
    available: true,
    hubCode: "tlevel-software-development",
  },
  {
    id: "unit-14",
    label: "Unit 14",
    kind: "hub-learning",
    description: "Unit 14 Software Engineering for Business current class work. Production currently has practice and saved progress rather than official attempts.",
    available: true,
    hubCode: "unit-14-software-engineering-for-business",
  },
  {
    id: "knowledge-reports",
    label: "Knowledge Reports",
    kind: "knowledge-reports",
    description: "Timed knowledge reports for the assigned cohort. The report list comes from the hub, not from one fixed activity.",
    available: true,
    hubCode: "unit-3-cyber-security",
  },
]);

export function resultSourceById(id: string | null | undefined): ResultSourceDefinition | null {
  return RESULT_SOURCES.find((source) => source.id === id) ?? null;
}

export function isResultSourceId(value: string): value is ResultSourceId {
  return RESULT_SOURCES.some((source) => source.id === value);
}
