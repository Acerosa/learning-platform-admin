"use client";

import { useState } from "react";
import type { AdminDataSnapshot } from "../api/admin-api";
import type { PendingAction } from "../components/pending-action-dialog";
import { getAdminModule } from "../router/modules";
import type { SystemTab } from "../router/legacy-routes";
import {
  SystemAccessPanel,
  SystemAdvancedPanel,
  SystemAuditPanel,
  SystemStatusPanel,
} from "./admin-system-panels";

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

const SYSTEM_TABS = [
  { id: "status" as const, label: "Status" },
  { id: "audit" as const, label: "Audit" },
  { id: "access" as const, label: "Access" },
  { id: "advanced" as const, label: "Advanced" },
];

export function SystemArea({
  data,
  initialTab = "status",
  openPending,
  legacyHeading,
}: {
  data: AdminDataSnapshot;
  initialTab?: SystemTab;
  openPending: (action: PendingAction) => void;
  legacyHeading?: string;
}) {
  const [tab, setTab] = useState<SystemTab>(initialTab);
  const moduleDef = getAdminModule("system");

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{moduleDef.eyebrow}</p>
          <h1>{legacyHeading ?? moduleDef.label}</h1>
          <p>{moduleDef.description}</p>
        </div>
      </header>
      <AreaTabs label="System views" tabs={SYSTEM_TABS} active={tab} onChange={setTab} />
      <div role="tabpanel">
        {tab === "status" ? <SystemStatusPanel data={data} /> : null}
        {tab === "audit" ? <SystemAuditPanel data={data} /> : null}
        {tab === "access" ? <SystemAccessPanel data={data} /> : null}
        {tab === "advanced" ? <SystemAdvancedPanel data={data} openPending={openPending} /> : null}
      </div>
    </>
  );
}
