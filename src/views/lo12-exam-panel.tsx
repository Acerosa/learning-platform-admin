"use client";

import { useEffect, useState } from "react";
import type { LearnerRecord, ResponseRecord, ReviewResponseRequest } from "../api/admin-api";
import { canReleaseMarking, examCohort, markingStateLabel, matchClassLearners, paperDurationLabel, type Lo12Record } from "../exam/lo12";

const GUIDANCE = [
  {
    id: "mm-1",
    marks: 3,
    guidance: "Confidentiality has failed because the tax return reached another client. A developed answer names the consequence for that client, such as disclosure of their financial information. Do not award the marks for naming a different CIA aim unless the answer justifies it from the email.",
  },
  {
    id: "mm-2",
    marks: 4,
    guidance: "The threat is unauthorised use or change of bookings. The vulnerability is a password that is guessable and has never been changed. Two marks for each developed point. A label without the scenario stays at one mark.",
  },
  {
    id: "mm-3",
    marks: 3,
    guidance: "The attacker is an insider, specifically a former member of staff. The motivation is the grievance after dismissal. Identification alone is not the full three marks. The answer should use the deleted stock records.",
  },
  {
    id: "mm-4",
    marks: 4,
    guidance: "Two impacts, explained. Suitable points are applicants not receiving offers on time, and staff being unable to work on admissions. Repeating 'the college is disrupted' does not earn a second impact.",
  },
  {
    id: "mm-5",
    marks: 6,
    guidance: "Discuss both the data-protection duty to donors and the operational effect on a charity that relies on volunteers and trust. A one-sided answer, or one that ignores the published names and amounts, is not full marks. There is no single required conclusion.",
  },
];

const PAPER = "u3-lo12-timed-mini-mock";

export function Lo12ExamPanel({
  records = [],
  enrolled = [],
  responses = [],
  learners = [],
  onLoadClassLearners,
  onReviewResponse,
  onRelease,
  onLoadAllowance,
  onSetAllowance,
  onLoadMarkingStatus,
  onFinalise,
}: {
  records?: Lo12Record[];
  enrolled?: string[];
  responses?: readonly ResponseRecord[];
  learners?: readonly Pick<LearnerRecord, "studentNumber" | "displayName">[];
  onLoadClassLearners?: () => Promise<readonly Pick<LearnerRecord, "studentNumber" | "displayName">[]>;
  onReviewResponse?: (request: ReviewResponseRequest) => Promise<unknown>;
  onRelease?: (attemptId: string) => Promise<unknown>;
  onLoadAllowance?: (studentNumber: string) => Promise<{ extraSeconds: number; standardDurationSeconds: number; totalSeconds: number } | null>;
  onSetAllowance?: (studentNumber: string, extraSeconds: number) => Promise<{ extraSeconds: number; standardDurationSeconds: number; totalSeconds: number } | null>;
  onLoadMarkingStatus?: (attemptId: string) => Promise<string | null>;
  onFinalise?: (attemptId: string) => Promise<string | null>;
}) {
  const summary = examCohort(records, enrolled);
  const scripts = responses.filter((response) => response.activityKey === PAPER);
  const attemptIds = [...new Set(scripts.map((response) => response.attemptId))];
  const [query, setQuery] = useState("");
  const [classLearners, setClassLearners] = useState(learners);
  const [studentNumber, setStudentNumber] = useState("");
  const [minutes, setMinutes] = useState(0);
  const [allowance, setAllowance] = useState<{ extraSeconds: number; standardDurationSeconds: number; totalSeconds: number } | null>(null);
  const [allowanceMessage, setAllowanceMessage] = useState("");
  const [savedMarks, setSavedMarks] = useState<Record<string, number>>({});
  const [markingStatus, setMarkingStatus] = useState<Record<string, string>>({});
  const [markingMessage, setMarkingMessage] = useState("");
  const matches = matchClassLearners(classLearners, query).slice(0, 8);

  useEffect(() => {
    if (!onLoadClassLearners) return;
    let cancelled = false;
    void onLoadClassLearners().then((rows) => {
      if (!cancelled) setClassLearners(rows);
    }).catch(() => {
      if (!cancelled) setClassLearners([]);
    });
    return () => { cancelled = true; };
  }, [onLoadClassLearners]);

  useEffect(() => {
    if (!studentNumber || !onLoadAllowance) {
      setAllowance(null);
      return;
    }
    let cancelled = false;
    void onLoadAllowance(studentNumber).then((row) => {
      if (!cancelled) setAllowance(row);
    }).catch(() => {
      if (!cancelled) setAllowanceMessage("This student is not in one of your classes.");
    });
    return () => { cancelled = true; };
  }, [onLoadAllowance, studentNumber]);

  const attemptKey = attemptIds.join(",");
  useEffect(() => {
    if (!onLoadMarkingStatus || !attemptKey) return;
    let cancelled = false;
    for (const attemptId of attemptKey.split(",")) {
      void onLoadMarkingStatus(attemptId).then((status) => {
        if (!cancelled && status) setMarkingStatus((current) => ({ ...current, [attemptId]: status }));
      }).catch(() => {
        if (!cancelled) setMarkingMessage("Marking status could not be loaded.");
      });
    }
    return () => { cancelled = true; };
  }, [attemptKey, onLoadMarkingStatus]);
  return (
    <section aria-labelledby="lo12-exam-heading">
      <h2 id="lo12-exam-heading">Unit 3 Exam Practice: LO1 and LO2</h2>
      <p>
        Written answers are marked here. Keyword matching is not used. Marks stay hidden from the student until you release the result.
        Pending scripts are not counted as zero.
      </p>
      <ul>
        <li>Started: {summary.started}</li>
        <li>Submitted: {summary.submitted}</li>
        <li>Not attempted: {summary.notAttempted}</li>
        <li>Awaiting marking: {summary.awaiting}</li>
        <li>Marking complete: {summary.complete}</li>
        <li>Average out of 20: {summary.average == null ? "Not available until marking is finalised" : summary.average.toFixed(1)}</li>
      </ul>
      <h3>Indicative marking</h3>
      {GUIDANCE.map((item) => (
        <article key={item.id}>
          <h4>{item.id} · {item.marks} marks</h4>
          <p>{item.guidance}</p>
        </article>
      ))}
      <p>
        Mark each question with the existing review. The total is the sum of those five marks, out of 20.
        Students do not see marks or comments until you release the result.
        Extra time for this paper does not change the knowledge report’s word-count rule.
      </p>
      <h3>Submitted scripts</h3>
      {scripts.length === 0 ? <p>No submitted mini-mock is waiting in this view.</p> : null}
      {attemptIds.map((attemptId) => (
        <article key={attemptId}>
          <h4>{scripts.find((response) => response.attemptId === attemptId)?.learnerNumber || "Learner"} · attempt total {
            scripts.filter((response) => response.attemptId === attemptId).reduce((sum, response) => sum + (savedMarks[response.responseId] ?? response.score ?? 0), 0)
          } / 20</h4>
          {scripts.filter((response) => response.attemptId === attemptId).map((response) => (
            <form
              key={response.responseId}
              style={{ display: "grid", gap: "0.35rem", margin: "0 0 1rem" }}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void onReviewResponse?.({
                  responseId: response.responseId,
                  awardedScore: Number(data.get("score")),
                  isCorrect: null,
                  feedbackSummary: String(data.get("feedback") || ""),
                  feedbackNextStep: String(data.get("next") || ""),
                }).then(() => {
                  setSavedMarks((current) => ({ ...current, [response.responseId]: Number(data.get("score")) }));
                });
              }}
            >
              <p>{response.questionKey} · {response.maxScore} marks</p>
              <p>{String(response.responsePayload.text || response.responsePayload.value || "")}</p>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Awarded marks
                <input name="score" type="number" min={0} max={response.maxScore} defaultValue={response.score ?? 0} required style={{ width: "6rem" }} />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Feedback
                <textarea name="feedback" defaultValue={response.feedbackSummary ?? ""} style={{ width: "100%", minHeight: "4.5rem" }} />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Next step
                <textarea name="next" defaultValue={response.feedbackNextStep ?? ""} style={{ width: "100%", minHeight: "3rem" }} />
              </label>
              <button type="submit">Save mark</button>
            </form>
          ))}
          <p>{markingStateLabel(markingStatus[attemptId])}</p>
          <button
            type="button"
            onClick={() => {
              void onFinalise?.(attemptId).then((status) => {
                if (status) {
                  setMarkingStatus((current) => ({ ...current, [attemptId]: status }));
                  setMarkingMessage(markingStateLabel(status));
                }
              }).catch(() => setMarkingMessage("Finalise marking after every question has a saved mark."));
            }}
            disabled={
              markingStatus[attemptId] === "finalised"
              || markingStatus[attemptId] === "released"
              || scripts.filter((response) => response.attemptId === attemptId).some((response) => savedMarks[response.responseId] == null && response.requiresReview)
            }
          >
            Finalise marking
          </button>
          <button
            type="button"
            disabled={!canReleaseMarking(markingStatus[attemptId])}
            onClick={() => {
              void onRelease?.(attemptId).then(() => {
                setMarkingStatus((current) => ({ ...current, [attemptId]: "released" }));
                setMarkingMessage("Results released");
              }).catch(() => setMarkingMessage("Results stay hidden until marking is finalised."));
            }}
          >
            Release results
          </button>
          {markingMessage ? <p role="status">{markingMessage}</p> : null}
        </article>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!studentNumber) return;
          void onSetAllowance?.(studentNumber, minutes * 60).then((row) => {
            if (row) setAllowance(row);
            setAllowanceMessage("Additional time saved for the mini-mock only.");
          }).catch(() => setAllowanceMessage("Additional time could not be saved."));
        }}
      >
        <h3>Additional time</h3>
        <p>This changes the timed mini-mock only. It does not change the knowledge report word-count rule.</p>
        <label>
          Find a student by name or student number
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <ul>
          {matches.map((learner) => (
            <li key={learner.studentNumber}>
              <button
                type="button"
                onClick={() => {
                  setStudentNumber(learner.studentNumber);
                  setAllowanceMessage("");
                }}
              >
                {learner.displayName} · {learner.studentNumber}
              </button>
            </li>
          ))}
        </ul>
        {studentNumber ? <p>Selected {studentNumber}</p> : <p>No student selected.</p>}
        {allowance ? (
          <p>
            Existing allowance {Math.round(allowance.extraSeconds / 60)} min.
            Total permitted time {paperDurationLabel(allowance.standardDurationSeconds, allowance.extraSeconds)}.
          </p>
        ) : null}
        <label>
          Extra minutes
          <input type="number" min={0} max={60} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} required />
        </label>
        <button type="submit" disabled={!studentNumber}>Save additional time</button>
        {allowanceMessage ? <p role="status">{allowanceMessage}</p> : null}
      </form>
    </section>
  );
}
