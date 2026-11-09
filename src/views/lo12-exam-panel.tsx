import { examCohort, type Lo12Record } from "../exam/lo12";

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

export function Lo12ExamPanel({ records = [], enrolled = [] }: { records?: Lo12Record[]; enrolled?: string[] }) {
  const summary = examCohort(records, enrolled);
  return (
    <section aria-labelledby="lo12-exam-heading">
      <h2 id="lo12-exam-heading">Unit 3 Exam Practice: LO1 and LO2</h2>
      <p>
        Written answers are marked here. Keyword matching is not used. Marks stay hidden from the student until you finalise them.
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
        Mark each question with admin_api.review_response. The total is the sum of those five marks.
        Students do not see marks or comments until you call admin_api.release_timed_paper_results.
        Extra time for this paper is admin_api.set_timed_paper_allowance. It does not change the knowledge report’s word-count rule.
      </p>
    </section>
  );
}
