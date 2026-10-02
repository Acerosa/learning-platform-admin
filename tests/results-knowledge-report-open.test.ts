import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { individualReportText } from "../src/results/knowledge-report-pdf.ts";
import type { KnowledgeReportRow } from "../src/results/knowledge-reports.ts";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
  url: "http://localhost/",
});
dom.window.Element.prototype.scrollIntoView = () => {};
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { KnowledgeReportsView } = await import("../src/views/knowledge-reports.tsx");

const ADVISORY = "Automated content analysis is provided to assist teacher review and is not an assessment or support decision.";

const LEARNER_A = {
  student_number: "LEARNER-A",
  learner_name: "Learner A",
  group_code: "GROUP-1",
  group_name: "Group One",
  course_key: "ocr-level-3-it",
  activity_key: "u3-cyber-security-knowledge-report",
  report_title: "Cyber Security Knowledge Report",
  assignment_id: "assignment-a",
  completion_status: "submitted",
  response_id: "response-a",
  word_count: 408,
  minimum_words: 500,
  minimum_met: false,
  duration_seconds: 1800,
  elapsed_seconds: 1800,
  submission_method: "additional_time_expired",
  standard_time_word_count: 285,
  additional_time_eligible: true,
  additional_time_started: true,
  additional_time_used_seconds: 900,
  words_added: 123,
  additional_time_threshold_words: 400,
  additional_time_allowance_seconds: 900,
  requires_review: true,
  submitted_at: "2026-10-02T10:43:06.378Z",
  overall_relevance: "moderate",
  repetition_flag: false,
};

const LEARNER_B = {
  student_number: "LEARNER-B",
  learner_name: "Learner B",
  group_code: "GROUP-1",
  group_name: "Group One",
  course_key: "ocr-level-3-it",
  activity_key: "u3-cyber-security-knowledge-report",
  report_title: "Cyber Security Knowledge Report",
  assignment_id: "assignment-b",
  completion_status: "submitted",
  response_id: "response-b",
  word_count: 507,
  minimum_words: 500,
  minimum_met: true,
  duration_seconds: 1800,
  elapsed_seconds: 1457,
  submission_method: "manual",
  requires_review: true,
  submitted_at: "2026-09-23T19:51:01.000Z",
  overall_relevance: "high",
  repetition_flag: false,
};

const LEARNER_C = {
  ...LEARNER_A,
  student_number: "LEARNER-C",
  learner_name: "Learner C",
  assignment_id: "assignment-c",
  response_id: "response-c",
  group_code: "GROUP-2",
  group_name: "Other Group",
};

const ESSAY_A = "Learner A final paragraph.\n\nLearner A second paragraph.";
const STANDARD_A = "Learner A work during standard time.";
const ESSAY_B = "Learner B legacy essay.\n\nLearner B kept the line break.";
const PAYLOAD_A = {
  text: ESSAY_A,
  standardTimeText: STANDARD_A,
  wordCount: 408,
  minimumMet: false,
  elapsedSeconds: 1800,
  durationSeconds: 1800,
  submissionMethod: "additional_time_expired",
  standardTimeWordCount: 285,
  additionalTimeEligible: true,
  additionalTimeOffered: true,
  additionalTimeStarted: true,
  additionalTimeUsedSeconds: 900,
  additionalTimeSeconds: 900,
  wordsAddedDuringAdditionalTime: 123,
};
const PAYLOAD_B = {
  text: ESSAY_B,
  wordCount: 507,
  minimumMet: true,
  elapsedSeconds: 1457,
  durationSeconds: 1800,
  submissionMethod: "manual",
};

const REVIEW = [{
  analysis_version: "1",
  overall_relevance: "moderate",
  summary: "The writing discusses cyber security.",
  topics: [{ key: "cia", label: "CIA Triad", coverage: "partial", reason: "Mentioned once." }],
  repetition_flag: false,
  repetition_note: null,
}];

function evidenceFor(studentNumber: string): unknown[] {
  if (studentNumber === "LEARNER-A") return [{ response_payload: PAYLOAD_A, feedback_summary: "Useful structure." }];
  if (studentNumber === "LEARNER-B") return [{ response_payload: PAYLOAD_B }];
  return [];
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderReports(options: { failStudent?: string } = {}) {
  const calls: { name: string; params: Record<string, unknown> }[] = [];
  let releaseLoading: (() => void) | null = null;
  const loadingGate = new Promise<void>((resolve) => {
    releaseLoading = resolve;
  });
  const callRpc = async (name: string, params: Record<string, unknown>) => {
    calls.push({ name, params });
    if (name === "list_knowledge_report_cohort") return [LEARNER_A, LEARNER_B, LEARNER_C];
    if (name === "list_hub_learning_result_evidence") {
      const studentNumber = String(params.p_student_number);
      if (options.failStudent === studentNumber) throw new Error("evidence unavailable");
      if (studentNumber === "LEARNER-A") await loadingGate;
      return evidenceFor(studentNumber);
    }
    if (name === "ensure_knowledge_report_content_review") return REVIEW;
    throw new Error(`unexpected rpc ${name}`);
  };
  const rootElement = document.createElement("div");
  document.body.append(rootElement);
  const root = createRoot(rootElement);
  await act(async () => {
    root.render(createElement(KnowledgeReportsView, {
      hubCode: "unit-3-cyber-security",
      callRpc,
      dataSource: { mode: "live", state: "ready" },
    }));
  });
  await settle();
  return {
    calls,
    releaseLoading: () => releaseLoading?.(),
    unmount() {
      act(() => root.unmount());
      rootElement.remove();
    },
  };
}

function openButton(name: string): HTMLButtonElement {
  const row = [...document.querySelectorAll("tbody tr")].find((item) => item.textContent?.includes(name));
  assert.ok(row, `row for ${name}`);
  const button = [...row.querySelectorAll("button")].find((item) => item.textContent === "Open");
  assert.ok(button, `Open button for ${name}`);
  return button as HTMLButtonElement;
}

test("Open shows a 1.1.0 learner, then a legacy learner, without stale evidence", async () => {
  const view = await renderReports();
  try {
    assert.equal(document.querySelector("[data-testid=knowledge-report-cohort]")?.textContent?.includes(ESSAY_A), false);
    const group = document.querySelector("#knowledge-report-group") as HTMLSelectElement | null;
    assert.ok(group);
    await act(async () => {
      group.value = "GROUP-1";
      group.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    const first = openButton("Learner A");
    await act(async () => {
      first.click();
    });
    assert.match(document.querySelector("[data-testid=knowledge-report-detail-loading]")?.textContent ?? "", /Loading the submitted report/);
    assert.equal(document.querySelector("[data-testid=knowledge-report-text]"), null);
    view.releaseLoading();
    await settle();

    const detail = document.querySelector("[data-testid=knowledge-report-detail]");
    assert.equal(detail?.querySelector("h2")?.textContent, "Learner A");
    assert.equal(document.querySelector("[data-testid=knowledge-report-text]")?.textContent, ESSAY_A);
    assert.equal(document.querySelector("[data-testid=knowledge-report-standard-text]")?.textContent, STANDARD_A);
    assert.match(detail?.textContent ?? "", /Work Produced During Standard Time/);
    assert.match(detail?.textContent ?? "", /Final Submitted Work/);
    assert.match(detail?.textContent ?? "", /30 minutes/);
    assert.match(detail?.textContent ?? "", /285/);
    assert.match(detail?.textContent ?? "", /15 minutes/);
    assert.match(detail?.textContent ?? "", /\+123/);
    assert.match(detail?.textContent ?? "", /Additional time expired/);
    assert.match(detail?.textContent ?? "", /The writing discusses cyber security/);
    assert.match(detail?.textContent ?? "", new RegExp(ADVISORY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(document.querySelector("[data-testid=knowledge-report-cohort]"), null);
    assert.equal(document.body.textContent?.includes(ESSAY_B), false);

    const evidenceCall = view.calls.find((call) => call.name === "list_hub_learning_result_evidence");
    assert.equal(evidenceCall?.params.p_student_number, "LEARNER-A");
    assert.equal(evidenceCall?.params.p_assignment_id, "assignment-a");
    assert.equal(JSON.stringify(evidenceCall?.params).includes(ESSAY_A), false);

    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid=knowledge-report-back]")?.click();
    });
    await settle();
    assert.ok(document.querySelector("[data-testid=knowledge-report-cohort]"));
    assert.equal(document.querySelector<HTMLSelectElement>("#knowledge-report-group")?.value, "GROUP-1");
    assert.equal(document.body.textContent?.includes(ESSAY_A), false);

    await act(async () => {
      openButton("Learner B").click();
    });
    await settle();
    assert.equal(document.querySelector("[data-testid=knowledge-report-detail] h2")?.textContent, "Learner B");
    assert.equal(document.querySelector("[data-testid=knowledge-report-text]")?.textContent, ESSAY_B);
    assert.equal(document.querySelector("[data-testid=knowledge-report-standard-text]"), null);
    const legacyText = document.querySelector("[data-testid=knowledge-report-detail]")?.textContent ?? "";
    assert.match(legacyText, /Manual/);
    assert.match(legacyText, /Not recorded/);
    assert.equal(legacyText.includes(ESSAY_A), false);
    assert.equal(legacyText.includes("Work Produced During Standard Time"), false);
    assert.equal(legacyText.includes("+0"), false);
  } finally {
    view.unmount();
  }
});

test("an evidence API failure is visible and the cohort can be opened again", async () => {
  const view = await renderReports({ failStudent: "LEARNER-A" });
  try {
    await act(async () => {
      openButton("Learner A").click();
    });
    await settle();
    const error = document.querySelector("[data-testid=knowledge-report-detail-error]");
    assert.equal(error?.textContent, "evidence unavailable");
    assert.equal(document.querySelector("[data-testid=knowledge-report-text]"), null);
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid=knowledge-report-back]")?.click();
    });
    await settle();
    assert.ok(document.querySelector("[data-testid=knowledge-report-cohort]"));
    assert.ok(openButton("Learner B"));
  } finally {
    view.unmount();
  }
});

test("opening an unauthorised learner does not reveal another report", async () => {
  const view = await renderReports();
  try {
    await act(async () => {
      openButton("Learner C").click();
    });
    view.releaseLoading();
    await settle();
    assert.match(document.querySelector("[data-testid=knowledge-report-detail-error]")?.textContent ?? "", /No submitted report was returned/);
    assert.equal(document.body.textContent?.includes(ESSAY_A), false);
    assert.equal(document.body.textContent?.includes(ESSAY_B), false);
    const call = view.calls.filter((item) => item.name === "list_hub_learning_result_evidence").at(-1);
    assert.equal(call?.params.p_student_number, "LEARNER-C");
    assert.equal(call?.params.p_assignment_id, "assignment-c");
    assert.equal(call?.params.p_hub_code, "unit-3-cyber-security");
  } finally {
    view.unmount();
  }
});

test("Download Student PDF uses the opened learner's frozen report", async () => {
  const view = await renderReports();
  const downloads: string[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => "blob:knowledge-report";
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function click() {
    downloads.push(this.download);
  };
  try {
    await act(async () => {
      openButton("Learner A").click();
    });
    view.releaseLoading();
    await settle();
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent === "Download Student PDF");
    assert.ok(button);
    await act(async () => {
      button.click();
    });
    await settle();
    assert.deepEqual(downloads, ["LEARNER-A-knowledge-report.pdf"]);
    const pdfText = individualReportText({
      row: {
        learnerName: "Learner A",
        groupName: "Group One",
        reportTitle: "Cyber Security Knowledge Report",
        submittedAt: "2026-10-02T10:43:06.378Z",
        wordCount: 408,
        minimumWords: 500,
        minimumMet: false,
        durationSeconds: 1800,
        elapsedSeconds: 1800,
        submissionMethod: "additional_time_expired",
        standardTimeWordCount: 285,
        additionalTimeEligible: true,
        additionalTimeStarted: true,
        additionalTimeUsedSeconds: 900,
        wordsAdded: 123,
        additionalTimeThresholdWords: 400,
        additionalTimeAllowanceSeconds: 900,
        completionStatus: "submitted",
      } as KnowledgeReportRow,
      reportText: ESSAY_A,
      standardTimeText: STANDARD_A,
      standardEndedAt: "2026-10-02T10:27:51.545Z",
      additionalTimeStartedAt: "2026-10-02T10:28:06.049Z",
      contentReview: {
        analysisVersion: "1",
        overallRelevance: "moderate",
        summary: "The writing discusses cyber security.",
        topics: [{ key: "cia", label: "CIA Triad", coverage: "partial", reason: "Mentioned once." }],
        repetitionFlag: false,
        repetitionNote: null,
      },
      teacherFeedback: "Useful structure.",
      reviewedBy: null,
      generatedAt: new Date("2026-10-02T12:00:00.000Z"),
    });
    assert.match(pdfText, /Individual Student Evidence Report/);
    assert.match(pdfText, /Learner A/);
    assert.match(pdfText, new RegExp(ESSAY_A.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(pdfText, /Work Produced During Standard Time/);
    assert.match(pdfText, new RegExp(STANDARD_A));
    assert.equal(pdfText.includes(ESSAY_B), false);
    const legacyPdf = individualReportText({
      row: {
        learnerName: "Learner B",
        groupName: "Group One",
        reportTitle: "Cyber Security Knowledge Report",
        submittedAt: "2026-09-23T19:51:01.000Z",
        wordCount: 507,
        minimumWords: 500,
        minimumMet: true,
        durationSeconds: 1800,
        elapsedSeconds: 1457,
        submissionMethod: "manual",
        completionStatus: "submitted",
      } as KnowledgeReportRow,
      reportText: ESSAY_B,
      standardTimeText: null,
      contentReview: null,
      teacherFeedback: null,
      reviewedBy: null,
      generatedAt: new Date("2026-10-02T12:00:00.000Z"),
    });
    assert.match(legacyPdf, new RegExp(ESSAY_B.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(legacyPdf, /not recorded for this attempt/);
    assert.equal(legacyPdf.includes("Work Produced During Standard Time"), false);
    assert.equal(legacyPdf.includes(ESSAY_A), false);
    assert.deepEqual(PAYLOAD_A.text, ESSAY_A);
    assert.equal(view.calls.some((call) => /update|save_activity|response_payload/.test(call.name)), false);
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    view.unmount();
  }
});
