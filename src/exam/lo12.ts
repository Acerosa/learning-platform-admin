import { examCohort, matchClassLearners, paperDurationLabel } from "./lo12.mjs";

export type Lo12Record = {
  activity_key: string;
  status: string;
  marking_status?: string;
  awarded?: Record<string, number> | null;
  responses?: { topic?: string; revise?: string } | null;
  student_id: string;
};

export { examCohort, matchClassLearners, paperDurationLabel };
