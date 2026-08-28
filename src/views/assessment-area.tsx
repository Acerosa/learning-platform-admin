"use client";

import { useState } from "react";
import type { AdminDataSnapshot } from "../api/admin-api";
import type { PendingAction } from "../components/pending-action-dialog";
import { getAdminModule } from "../router/modules";
import type { AssessmentTab } from "../router/legacy-routes";
import { AssignmentsPanel, ResultsPanel } from "./admin-assessment-panels";

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
];

export function AssessmentArea({
  data,
  initialTab = "assignments",
  openPending,
  legacyHeading,
  onReviewResponse,
  includeAttempts = false,
}: {
  data: AdminDataSnapshot;
  initialTab?: AssessmentTab;
  openPending: (action: PendingAction) => void;
  legacyHeading?: string;
  onReviewResponse: Parameters<typeof ResultsPanel>[0]["onReviewResponse"];
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
          <ResultsPanel
            data={data}
            onReviewResponse={onReviewResponse}
            includeAttempts={includeAttempts}
          />
        ) : null}
      </div>
    </>
  );
}
