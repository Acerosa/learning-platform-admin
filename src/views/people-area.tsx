"use client";

import { useState } from "react";
import type { AdminDataSnapshot } from "../api/admin-api";
import type { PendingAction } from "../components/pending-action-dialog";
import { getAdminModule } from "../router/modules";
import type { PeopleTab } from "../router/legacy-routes";
import {
  GroupsPanel,
  LearnersPanel,
  StaffPanel,
} from "./admin-people-panels";

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

const PEOPLE_TABS = [
  { id: "learners" as const, label: "Learners" },
  { id: "groups" as const, label: "Groups" },
  { id: "staff" as const, label: "Staff" },
];

export function PeopleArea({
  data,
  initialTab = "learners",
  openPending,
  legacyHeading,
  showEnrolments = false,
}: {
  data: AdminDataSnapshot;
  initialTab?: PeopleTab;
  openPending: (action: PendingAction) => void;
  legacyHeading?: string;
  showEnrolments?: boolean;
}) {
  const [tab, setTab] = useState<PeopleTab>(initialTab);
  const moduleDef = getAdminModule("people");

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{moduleDef.eyebrow}</p>
          <h1>{legacyHeading ?? moduleDef.label}</h1>
          <p>{moduleDef.description}</p>
        </div>
      </header>
      <AreaTabs label="People views" tabs={PEOPLE_TABS} active={tab} onChange={setTab} />
      <div role="tabpanel">
        {tab === "learners" ? <LearnersPanel data={data} openPending={openPending} showEnrolments={showEnrolments} /> : null}
        {tab === "groups" ? <GroupsPanel data={data} openPending={openPending} /> : null}
        {tab === "staff" ? <StaffPanel data={data} openPending={openPending} /> : null}
      </div>
    </>
  );
}
