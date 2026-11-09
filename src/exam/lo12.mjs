const QUESTIONS = [
  { id: "mm-1", marks: 3, outcome: "LO1" },
  { id: "mm-2", marks: 4, outcome: "LO1" },
  { id: "mm-3", marks: 3, outcome: "LO1" },
  { id: "mm-4", marks: 4, outcome: "LO2" },
  { id: "mm-5", marks: 6, outcome: "LO2" },
];

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
