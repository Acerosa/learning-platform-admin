export type ResultSourceId =
  | "induction-readiness"
  | "assignment-markbook"
  | "l2e"
  | "l3e"
  | "unit-3-cyber-security"
  | "tlevel"
  | "unit-14";

export type ResultSourceKind = "diagnostic" | "assignment-markbook" | "unavailable";

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
    kind: "unavailable",
    description: "L2E results will use this Results shell when that hub is connected.",
    available: false,
  },
  {
    id: "l3e",
    label: "L3E",
    kind: "unavailable",
    description: "L3E results will use this Results shell when that hub is connected.",
    available: false,
  },
  {
    id: "unit-3-cyber-security",
    label: "Unit 3 Cyber Security",
    kind: "unavailable",
    description: "Unit 3 results will use this Results shell when that hub is connected.",
    available: false,
  },
  {
    id: "tlevel",
    label: "T Level",
    kind: "unavailable",
    description: "T Level results will use this Results shell when that hub is connected.",
    available: false,
  },
  {
    id: "unit-14",
    label: "Unit 14",
    kind: "unavailable",
    description: "Unit 14 results will use this Results shell when that hub is connected.",
    available: false,
  },
]);

export function resultSourceById(id: string | null | undefined): ResultSourceDefinition | null {
  return RESULT_SOURCES.find((source) => source.id === id) ?? null;
}

export function isResultSourceId(value: string): value is ResultSourceId {
  return RESULT_SOURCES.some((source) => source.id === value);
}
