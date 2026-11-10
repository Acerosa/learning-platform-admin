const QUESTIONS = [
  { id: "mm-1", marks: 3, outcome: "LO1" },
  { id: "mm-2", marks: 4, outcome: "LO1" },
  { id: "mm-3", marks: 3, outcome: "LO1" },
  { id: "mm-4", marks: 4, outcome: "LO2" },
  { id: "mm-5", marks: 6, outcome: "LO2" },
];

export function matchClassLearners(learners, query) {
  const rows = (learners || []).filter((learner) => learner?.studentNumber && learner?.displayName);
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((learner) => (
    learner.displayName.toLowerCase().includes(needle)
    || learner.studentNumber.toLowerCase().includes(needle)
  ));
}

export function markingStateLabel(status) {
  if (status === "released") return "Results released";
  if (status === "finalised") return "Marking finalised";
  return "Marking in progress";
}

export function canReleaseMarking(status) {
  return status === "finalised";
}

export function paperDurationLabel(standardSeconds, extraSeconds) {
  const total = Math.max(0, Number(standardSeconds) || 0) + Math.max(0, Number(extraSeconds) || 0);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return seconds ? `${minutes} min ${seconds} sec` : `${minutes} min`;
}

export function examCohort(records, enrolled) {
  const mocks = records.filter((row) => row.activity_key === "mini-mock");
  const byStudent = new Map(mocks.map((row) => [row.student_id, row]));
  const started = mocks.filter((row) => row.status === "started" || row.status === "submitted");
  const submitted = mocks.filter((row) => row.status === "submitted");
  const awaiting = submitted.filter((row) => row.marking_status !== "finalised");
  const complete = submitted.filter((row) => row.marking_status === "finalised" && row.awarded);
  const notAttempted = enrolled.filter((id) => !byStudent.has(id));
  const scores = complete.map((row) =>
    QUESTIONS.reduce((sum, question) => sum + (row.awarded?.[question.id] || 0), 0)
  );
  return {
    started: started.length,
    submitted: submitted.length,
    notAttempted: notAttempted.length,
    awaiting: awaiting.length,
    complete: complete.length,
    average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
  };
}
