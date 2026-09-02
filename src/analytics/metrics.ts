export const METRIC_DEFINITIONS = Object.freeze({
  firstResult: {
    label: "First Result",
    definition: "Score from the learner’s first completed attempt for the activity.",
  },
  latestResult: {
    label: "Latest Result",
    definition: "Score from the learner’s most recent completed attempt for the activity.",
  },
  bestResult: {
    label: "Best Result",
    definition: "Highest score achieved across completed attempts for the same learner and activity.",
  },
  bestResultAverage: {
    label: "Best-result Average",
    definition: "Average of each assigned learner-activity Best Result in the current scope.",
  },
  highestResult: {
    label: "Highest Result",
    definition: "Highest completed-attempt score observed in this group or activity aggregate. This is not an average.",
  },
  attemptAverage: {
    label: "Attempt Average",
    definition: "Average score across completed attempts.",
  },
  completion: {
    label: "Completion",
    definition: "Learners with a completed attempt divided by assigned learners.",
  },
  participation: {
    label: "Participation",
    definition: "Learners with at least one attempt divided by assigned learners.",
  },
  attempts: {
    label: "Attempts",
    definition: "Number of recorded attempts, not the number of learners.",
  },
  awaitingReview: {
    label: "Awaiting review",
    definition: "Responses that still require teacher review.",
  },
} as const);

export type MetricDefinitionKey = keyof typeof METRIC_DEFINITIONS;

export function percentageLabel(value: number | null | undefined) {
  if (value == null) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toFixed(1)}%`;
}

export function ratioLabel(part: number, whole: number) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) {
    return `${part} / ${whole}`;
  }
  return `${part} / ${whole}`;
}

export function activityStatus(attemptCount: number, completedAttemptCount: number) {
  if (attemptCount <= 0) return "Not started";
  if (completedAttemptCount <= 0) return "In progress";
  return "Complete";
}

export function displayLabel(title: string | null | undefined, fallbackKey: string) {
  const trimmed = title?.trim();
  return trimmed || fallbackKey;
}

export function secondaryKey(title: string | null | undefined, key: string) {
  const trimmed = title?.trim();
  return trimmed && trimmed !== key ? key : null;
}

export function mean(values: readonly number[]) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  return Math.round((finite.reduce((sum, value) => sum + value, 0) / finite.length) * 100) / 100;
}
