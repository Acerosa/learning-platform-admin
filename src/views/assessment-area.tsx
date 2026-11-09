"use client";

import { useState } from "react";
import type { AdminDataSnapshot, LearnerRecord, ReviewResponseRequest } from "../api/admin-api";
import type { PendingAction } from "../components/pending-action-dialog";
import { getAdminModule } from "../router/modules";
import type { AssessmentTab } from "../router/legacy-routes";
import { AssignmentsPanel } from "./admin-assessment-panels";
import { Lo12ExamPanel } from "./lo12-exam-panel";
import { ResultsArea } from "./results-area";

function AreaTabs<T extends string>({
  label,
  tabs,
  active,
  onChange,
}: {
  label: string;
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div className="authoring-tabs" role="tablist" aria-label={label}>
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={active === item.id ? "is-active" : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const ASSESSMENT_TABS = [
  { id: "assignments" as const, label: "Assignments" },
  { id: "results" as const, label: "Results" },
  { id: "exam-practice" as const, label: "Exam Practice" },
];

export function AssessmentArea({
  data,
  initialTab = "assignments",
  openPending,
  legacyHeading,
  onReviewResponse,
  onReleaseExamResults,
  onLoadExamAllowance,
  onSetExamAllowance,
  onLoadExamMarkingStatus,
  onFinaliseExamMarking,
  onLoadClassLearners,
  includeAttempts = false,
}: {
  data: AdminDataSnapshot;
  initialTab?: AssessmentTab;
  openPending: (action: PendingAction) => void;
  legacyHeading?: string;
  onReviewResponse: Parameters<typeof ResultsArea>[0]["onReviewResponse"];
  onReleaseExamResults?: (attemptId: string) => Promise<unknown>;
  onLoadExamAllowance?: (studentNumber: string) => Promise<{ extraSeconds: number; standardDurationSeconds: number; totalSeconds: number } | null>;
  onSetExamAllowance?: (studentNumber: string, extraSeconds: number) => Promise<{ extraSeconds: number; standardDurationSeconds: number; totalSeconds: number } | null>;
  onLoadExamMarkingStatus?: (attemptId: string) => Promise<string | null>;
  onFinaliseExamMarking?: (attemptId: string) => Promise<string | null>;
  onLoadClassLearners?: () => Promise<readonly Pick<LearnerRecord, "studentNumber" | "displayName">[]>;
  includeAttempts?: boolean;
}) {
  const [tab, setTab] = useState<AssessmentTab>(initialTab);
  const moduleDef = getAdminModule("assessment");

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{moduleDef.eyebrow}</p>
          <h1>{legacyHeading ?? moduleDef.label}</h1>
          <p>{moduleDef.description}</p>
        </div>
      </header>
      <AreaTabs label="Assignments and results views" tabs={ASSESSMENT_TABS} active={tab} onChange={setTab} />
      <div role="tabpanel">
        {tab === "assignments" ? <AssignmentsPanel data={data} openPending={openPending} /> : null}
        {tab === "results" ? (
          <ResultsArea
            data={data}
            onReviewResponse={onReviewResponse}
            includeAttempts={includeAttempts}
          />
        ) : null}
        {tab === "exam-practice" ? (
          <Lo12ExamPanel
            responses={data.responses}
            onLoadClassLearners={onLoadClassLearners}
            onReviewResponse={onReviewResponse as (request: ReviewResponseRequest) => Promise<unknown>}
            onRelease={onReleaseExamResults}
            onLoadAllowance={onLoadExamAllowance}
            onSetAllowance={onSetExamAllowance}
            onLoadMarkingStatus={onLoadExamMarkingStatus}
            onFinalise={onFinaliseExamMarking}
          />
        ) : null}
      </div>
    </>
  );
}
