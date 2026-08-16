"use client";

import { useMemo, useState } from "react";
import type {
  AdminDataSnapshot,
  HubRecord,
} from "../api/admin-api";
import { AdminLink } from "../components/admin-link";
import { HubDetailDialog } from "../components/hub-detail-dialog";
import { RegisterHubDialog } from "../components/register-hub-dialog";
import {
  PendingActionDialog,
  type PendingAction,
} from "../components/pending-action-dialog";
import { StatusBadge, type BadgeTone } from "../components/status-badge";
import { loadDrafts } from "../content/draft-store";
import { hubHealthReport } from "../content/hub-health";
import { manifestFromHubRecord } from "../content/hub-manifest";
import { hubPublicationStatus } from "../content/hub-publication";
import { getAdminModule, type AdminModuleId } from "../router/modules";
import { AdminHubRegistrationError } from "../services/supabase-admin-service";
import { useAdminPortal } from "../stores/admin-portal";
import { formatDate } from "../utils/format";
import { CurriculumAuthoringPage } from "./curriculum-authoring";
import { ResultsMarkbookPage } from "./results-markbook";

function toneForStatus(status: string): BadgeTone {
  if (["active", "healthy", "certified", "open", "production", "completed", "succeeded", "published", "pass"].includes(status)) return "positive";
  if (["testing", "partial", "draft", "degraded", "maintenance", "ready-for-review", "in-review", "approved", "warn"].includes(status)) return "warning";
  if (["unavailable", "failed", "inactive", "denied", "fail"].includes(status)) return "danger";
  if (["pending", "unknown", "retired", "archived", "superseded", "none"].includes(status)) return "neutral";
  return "info";
}

function PageHeader({
  moduleId,
  actionLabel,
  onAction,
}: {
  moduleId: AdminModuleId;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const currentModule = getAdminModule(moduleId);
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{currentModule.eyebrow}</p>
        <h1>{currentModule.label}</h1>
        <p>{currentModule.description}</p>
      </div>
      {actionLabel && onAction ? (
        <button className="button button--primary" type="button" onClick={onAction}>
          <span aria-hidden="true">＋</span>{actionLabel}
        </button>
      ) : null}
    </header>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "warning" | "info";
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__label"><span aria-hidden="true" />{label}</div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state__mark" aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function scoreLabel(score: number, maxScore: number) {
  return `${score} / ${maxScore}`;
}

function percentageLabel(value: number | null) {
  return value === null ? "No completed attempts" : `${value.toFixed(1)}%`;
}

function DashboardPage({ data }: { data: AdminDataSnapshot }) {
  const summary = data.dashboardSummary;
  const recentAttempts = data.attempts.slice(0, 5);
  return (
    <>
      <PageHeader moduleId="dashboard" />
      <section className="metrics-grid" aria-label="Live platform summary">
        <MetricCard label="Registered hubs" value={String(summary.registeredHubs)} detail={`${summary.activeHubs} active`} tone="info" />
        <MetricCard label="Active learners" value={String(summary.activeLearners)} detail="Backend learner registry" tone="positive" />
        <MetricCard label="Active groups" value={String(summary.activeGroups)} detail={`${summary.activeEnrolments} active enrolments`} tone="info" />
        <MetricCard label="Assignments" value={String(summary.assignments)} detail="Current and historical records" tone="neutral" />
        <MetricCard label="Recent attempts" value={String(summary.recentAttempts)} detail="Received in the last seven days" tone="positive" />
        <MetricCard label="Average score" value={percentageLabel(summary.averageScorePercentage)} detail={`${summary.completedAttempts} completed attempts`} tone="info" />
      </section>
      <div className="dashboard-grid">
        <section className="panel panel--span-2" aria-labelledby="hub-readiness-title">
          <div className="panel__header">
            <div><p className="eyebrow">Registry</p><h2 id="hub-readiness-title">Hub readiness</h2></div>
            <AdminLink className="text-link" href="/hubs">Open registry <span aria-hidden="true">→</span></AdminLink>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Hub</th><th scope="col">Core</th><th scope="col">Manifest</th><th scope="col">Lifecycle</th><th scope="col">Certification</th></tr></thead>
              <tbody>{data.hubs.map((hub) => (
                <tr key={hub.hubCode}>
                  <th scope="row"><span className="table-primary">{hub.hubName}</span><code>{hub.hubCode}</code></th>
                  <td>{hub.coreVersion}</td>
                  <td>{hub.manifestVersion}</td>
                  <td><StatusBadge label={hub.status} tone={toneForStatus(hub.status)} /></td>
                  <td><StatusBadge label={hub.certificationState ?? "not recorded"} tone={hub.certificationState === "certified" ? "positive" : "neutral"} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
        <section className="panel" aria-labelledby="health-title">
          <div className="panel__header"><div><p className="eyebrow">Operations</p><h2 id="health-title">Platform health</h2></div><span className="count-chip">{summary.healthyServices} / {summary.serviceCount}</span></div>
          {data.health.length ? <ul className="health-list">{data.health.map((health) => (
            <li key={health.serviceKey}>
              <span className={`health-dot health-dot--${health.status}`} aria-hidden="true" />
              <span><strong>{health.label}</strong><small>{health.message}</small></span>
              <StatusBadge label={health.status} tone={toneForStatus(health.status)} />
            </li>
          ))}</ul> : <EmptyState title="No health signals" body="No safe operational status rows are available." />}
        </section>
        <section className="panel panel--span-2" aria-labelledby="recent-attempts-title">
          <div className="panel__header"><div><p className="eyebrow">Evidence</p><h2 id="recent-attempts-title">Recent attempts</h2></div><AdminLink className="text-link" href="/attempts">View attempts <span aria-hidden="true">→</span></AdminLink></div>
          {recentAttempts.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Learner</th><th scope="col">Activity</th><th scope="col">Score</th><th scope="col">Status</th><th scope="col">Completed</th></tr></thead><tbody>{recentAttempts.map((attempt) => <tr key={attempt.attemptId}><th scope="row"><code>{attempt.learnerNumber}</code></th><td><span className="table-primary">{attempt.activityKey}</span><small>{attempt.activityVersion}</small></td><td>{scoreLabel(attempt.score, attempt.maxScore)}</td><td><StatusBadge label={attempt.status} tone={toneForStatus(attempt.status)} /></td><td>{formatDate(attempt.completedAt)}</td></tr>)}</tbody></table></div> : <EmptyState title="No attempts yet" body="Completed attempt summaries will appear here." />}
        </section>
        <section className="panel" aria-labelledby="contracts-title">
          <div className="panel__header"><div><p className="eyebrow">Compatibility</p><h2 id="contracts-title">Platform contracts</h2></div><span className="count-chip">{summary.activeContracts} active</span></div>
          <ul className="contract-list">{data.contracts.filter((contract) => contract.status !== "retired").map((contract) => <li key={`${contract.contractKey}-${contract.version}`}><span><strong>{contract.contractKey}</strong><small>{contract.version}</small></span><StatusBadge label={contract.status} tone={toneForStatus(contract.status)} /></li>)}</ul>
        </section>
      </div>
    </>
  );
}

function HubRegistryPage({ data, actionError, onRegister, onEdit, onToggleActive }: {
  data: AdminDataSnapshot;
  actionError: string | null;
  onRegister: () => void;
  onEdit: (hub: HubRecord) => void;
  onToggleActive: (hub: HubRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedHubCode, setSelectedHubCode] = useState<string | null>(null);
  const localDrafts = typeof window === "undefined" ? [] : loadDrafts();
  const visibleHubs = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    return data.hubs.filter((hub) => {
      const matchesQuery = !normalised || `${hub.hubName} ${hub.hubCode} ${hub.description}`.toLowerCase().includes(normalised);
      return matchesQuery && (status === "all" || hub.status === status);
    });
  }, [data.hubs, query, status]);

  const selectedHub = selectedHubCode
    ? data.hubs.find((hub) => hub.hubCode === selectedHubCode) ?? null
    : null;

  const selectedLinks = selectedHub
    ? data.hubCourseLinks.filter((link) => link.hubCode === selectedHub.hubCode)
    : [];
  const selectedPublication = selectedHub ? hubPublicationStatus(selectedHub, data, localDrafts) : null;
  const selectedHealth = selectedHub ? hubHealthReport(selectedHub, data, localDrafts) : null;
  const selectedHistory = selectedHub
    ? data.auditEvents.filter((event) => event.entityType === "hub" && event.entityKey === selectedHub.hubCode)
    : [];

  return (
    <>
      <PageHeader moduleId="hubs" actionLabel="Register hub" onAction={onRegister} />
      <section className="panel">
        <div className="toolbar">
          <div className="toolbar__search"><label htmlFor="hub-search">Search hubs</label><input id="hub-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, code or description" /></div>
          <div><label htmlFor="hub-status">Lifecycle</label><select id="hub-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All states</option><option value="planned">Planned</option><option value="development">Development</option><option value="testing">Testing</option><option value="production">Production</option><option value="maintenance">Maintenance</option><option value="archived">Archived</option></select></div>
          <span className="toolbar__count" role="status">{visibleHubs.length} of {data.hubs.length} hubs</span>
        </div>
        {visibleHubs.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Hub</th><th scope="col">Version</th><th scope="col">Courses</th><th scope="col">Curriculum</th><th scope="col">Health</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleHubs.map((hub) => {
          const links = data.hubCourseLinks.filter((link) => link.hubCode === hub.hubCode && link.active);
          const publication = hubPublicationStatus(hub, data, localDrafts);
          const health = hubHealthReport(hub, data, localDrafts);
          return <tr key={hub.hubCode}><th scope="row"><span className="hub-cell"><span className="hub-cell__mark" aria-hidden="true">{hub.hubName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><span><span className="table-primary">{hub.hubName}</span><code>{hub.hubCode}</code></span></span></th><td>{hub.hubVersion}</td><td>{links.map((link) => link.courseTitle).join(", ") || "No active link"}</td><td><StatusBadge label={publication.displayLabel} tone={toneForStatus(publication.displayStatus)} /></td><td><StatusBadge label={health.summary} tone={toneForStatus(health.status)} /></td><td><StatusBadge label={hub.active ? hub.status : `${hub.status} · inactive`} tone={toneForStatus(hub.active ? hub.status : "inactive")} /></td><td><button className="button button--small button--secondary" type="button" onClick={() => setSelectedHubCode(hub.hubCode)}>View</button></td></tr>;
        })}</tbody></table></div> : <EmptyState title="No hubs match" body="Change the search or lifecycle filter." />}
      </section>
      <HubDetailDialog
        hub={selectedHub}
        courseLinks={selectedLinks}
        publication={selectedPublication}
        health={selectedHealth}
        history={selectedHistory}
        actionError={actionError}
        onClose={() => setSelectedHubCode(null)}
        onEdit={(hub) => { setSelectedHubCode(null); onEdit(hub); }}
        onToggleActive={onToggleActive}
      />
    </>
  );
}

function CoursesPage({ data, openPending }: { data: AdminDataSnapshot; openPending: (action: PendingAction) => void }) {
  return (
    <>
      <PageHeader moduleId="courses" actionLabel="Create course" onAction={() => openPending({ title: "Create a course" })} />
      {data.courses.length ? <div className="card-grid card-grid--2">{data.courses.map((course) => {
        const links = data.hubCourseLinks.filter((link) => link.courseKey === course.courseKey);
        return <article className="record-card" key={course.courseKey}><div className="record-card__header"><span className="record-card__mark" aria-hidden="true">CR</span><StatusBadge label={course.active ? "active" : "inactive"} tone={course.active ? "positive" : "neutral"} /></div><h2>{course.courseTitle}</h2><code>{course.courseKey}</code><dl><div><dt>Code</dt><dd>{course.code ?? "Not recorded"}</dd></div><div><dt>Linked hubs</dt><dd>{links.length ? links.map((link) => link.hubCode).join(", ") : "None"}</dd></div></dl></article>;
      })}</div> : <EmptyState title="No courses" body="No course catalogue rows are available." />}
      <section className="notice-card notice-card--info"><strong>Course catalogue</strong><p>The MVP displays <code>admin_api.courses</code> and hub associations. Creating or editing a course remains deferred.</p></section>
    </>
  );
}

function DeferredLearningPage({ moduleId, openPending }: { moduleId: "activities"; openPending: (action: PendingAction) => void }) {
  return <><PageHeader moduleId={moduleId} actionLabel="Create activity" onAction={() => openPending({ title: "Create activity" })} /><section className="panel"><EmptyState title="Administration contract deferred" body="The Phase 2 MVP does not add activity-catalogue authoring or protected-schema reads. Canonical activity composition lives in Curriculum authoring. Existing portal workflow boundaries remain prepared for a reviewed backend contract." /></section></>;
}

function LearnersPage({ data, openPending }: { data: AdminDataSnapshot; openPending: (action: PendingAction) => void }) {
  return <><PageHeader moduleId="learners" actionLabel="Add learner" onAction={() => openPending({ title: "Add a learner" })} /><section className="panel"><div className="panel__header"><div><p className="eyebrow">Minimised directory</p><h2>Learners</h2></div><span className="count-chip">{data.learners.length} records</span></div>{data.learners.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Learner</th><th scope="col">Student number</th><th scope="col">Active groups</th><th scope="col">Active enrolments</th><th scope="col">Status</th></tr></thead><tbody>{data.learners.map((learner) => <tr key={learner.studentNumber}><th scope="row">{learner.displayName}</th><td><code>{learner.studentNumber}</code></td><td>{learner.groupCodes.join(", ") || "None"}</td><td>{learner.activeEnrolmentCount}</td><td><StatusBadge label={learner.active ? "active" : "inactive"} tone={learner.active ? "positive" : "neutral"} /></td></tr>)}</tbody></table></div> : <EmptyState title="No learners" body="No learner records are visible to this authorised session." />}</section><section className="notice-card notice-card--info"><strong>Privacy by design</strong><p>The list omits contact details, internal UUIDs and response payloads.</p></section></>;
}

function TeachersPage({ data, openPending }: { data: AdminDataSnapshot; openPending: (action: PendingAction) => void }) {
  return <><PageHeader moduleId="teachers" actionLabel="Invite teacher" onAction={() => openPending({ title: "Invite a teacher" })} /><section className="panel"><div className="panel__header"><div><p className="eyebrow">Active platform roles</p><h2>Staff administration context</h2></div></div>{data.teachers.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Staff</th><th scope="col">Reference</th><th scope="col">Backend role</th><th scope="col">Role state</th></tr></thead><tbody>{data.teachers.map((teacher) => <tr key={`${teacher.staffReference}-${teacher.roleLabel}`}><th scope="row">{teacher.displayName}</th><td><code>{teacher.staffReference}</code></td><td>{teacher.roleLabel}</td><td><StatusBadge label={teacher.active ? "active" : "revoked"} tone={teacher.active ? "positive" : "neutral"} /></td></tr>)}</tbody></table></div> : <EmptyState title="No platform roles" body="No staff-role records are visible." />}</section><section className="notice-card notice-card--warning"><strong>Backend-authoritative roles</strong><p>A teacher profile alone does not grant portal authority. Active roles are read from the backend and every data request remains protected by RLS.</p></section></>;
}

function GroupsPage({ data, openPending }: { data: AdminDataSnapshot; openPending: (action: PendingAction) => void }) {
  return <><PageHeader moduleId="groups" actionLabel="Create group" onAction={() => openPending({ title: "Create a group" })} /><section className="panel"><div className="panel__header"><div><p className="eyebrow">Cohorts</p><h2>Academic groups</h2></div><span className="count-chip">{data.groups.length} groups</span></div>{data.groups.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Group</th><th scope="col">Academic year</th><th scope="col">Year</th><th scope="col">Course</th><th scope="col">Learners</th><th scope="col">Registration</th><th scope="col">Status</th></tr></thead><tbody>{data.groups.map((group) => <tr key={group.groupCode}><th scope="row"><span className="table-primary">{group.groupName}</span><code>{group.groupCode}</code></th><td>{group.academicYear}</td><td>{group.yearGroup}</td><td><span className="table-primary">{group.courseTitle}</span><code>{group.courseKey}</code></td><td>{group.activeLearnerCount}</td><td><StatusBadge label={group.registrationOpen ? "open" : "closed"} tone={group.registrationOpen ? "positive" : "neutral"} /></td><td><StatusBadge label={group.active ? "active" : "inactive"} tone={group.active ? "positive" : "neutral"} /></td></tr>)}</tbody></table></div> : <EmptyState title="No groups" body="No group records are visible." />}</section><section className="notice-card notice-card--info"><strong>Registration keys stay protected</strong><p>The administration list shows registration state and never returns registration-key values.</p></section></>;
}

function EnrolmentsPage({ data, openPending }: { data: AdminDataSnapshot; openPending: (action: PendingAction) => void }) {
  return <><PageHeader moduleId="enrolments" actionLabel="Create enrolment" onAction={() => openPending({ title: "Create an enrolment" })} /><section className="panel"><div className="panel__header"><div><p className="eyebrow">Current and historical relationships</p><h2>Enrolments</h2></div><span className="count-chip">{data.enrolments.length} records</span></div>{data.enrolments.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Learner</th><th scope="col">Group</th><th scope="col">Joined</th><th scope="col">Left</th><th scope="col">Status</th></tr></thead><tbody>{data.enrolments.map((enrolment, index) => <tr key={`${enrolment.learnerNumber}-${enrolment.groupCode}-${index}`}><th scope="row"><code>{enrolment.learnerNumber}</code></th><td>{enrolment.groupCode}</td><td>{formatDate(enrolment.joinedOn)}</td><td>{formatDate(enrolment.leftOn)}</td><td><StatusBadge label={enrolment.status} tone={toneForStatus(enrolment.status)} /></td></tr>)}</tbody></table></div> : <EmptyState title="No enrolments" body="No current or historical enrolments are visible." />}</section></>;
}

function AssignmentsPage({ data, openPending }: { data: AdminDataSnapshot; openPending: (action: PendingAction) => void }) {
  return <><PageHeader moduleId="assignments" actionLabel="Create assignment" onAction={() => openPending({ title: "Create an assignment" })} /><section className="panel"><div className="panel__header"><div><p className="eyebrow">Learning delivery</p><h2>Assignments</h2></div><span className="count-chip">{data.assignments.length} records</span></div>{data.assignments.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Activity</th><th scope="col">Version</th><th scope="col">Group</th><th scope="col">Opens</th><th scope="col">Due</th><th scope="col">Required</th><th scope="col">Status</th></tr></thead><tbody>{data.assignments.map((assignment, index) => <tr key={`${assignment.groupCode}-${assignment.activityKey}-${index}`}><th scope="row"><code>{assignment.activityKey}</code></th><td>{assignment.activityVersion}</td><td>{assignment.groupCode}</td><td>{assignment.opensAt ? formatDate(assignment.opensAt) : "Always available"}</td><td>{formatDate(assignment.dueAt)}</td><td>{assignment.required ? "Yes" : "No"}</td><td><StatusBadge label={assignment.active ? "active" : "inactive"} tone={assignment.active ? "positive" : "neutral"} /></td></tr>)}</tbody></table></div> : <EmptyState title="No assignments" body="No assignment records are visible." />}</section><section className="notice-card notice-card--warning"><strong>Mutation workflow pending</strong><p>Assignment creation remains disabled until an audited, idempotent backend RPC is approved.</p></section></>;
}

function AttemptsPage({ data }: { data: AdminDataSnapshot }) {
  return <><PageHeader moduleId="attempts" /><section className="panel"><div className="panel__header"><div><p className="eyebrow">Summary evidence only</p><h2>Attempt history</h2></div><span className="count-chip">{data.attempts.length} records</span></div>{data.attempts.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Learner</th><th scope="col">Group</th><th scope="col">Activity</th><th scope="col">Attempt</th><th scope="col">Score</th><th scope="col">Marking</th><th scope="col">Evidence</th><th scope="col">Completed</th><th scope="col">Status</th></tr></thead><tbody>{data.attempts.map((attempt) => <tr key={attempt.attemptId}><th scope="row"><code>{attempt.learnerNumber}</code></th><td>{attempt.groupCode}</td><td><span className="table-primary">{attempt.activityKey}</span><small>{attempt.activityVersion}</small></td><td>{attempt.attemptNumber}</td><td>{scoreLabel(attempt.score, attempt.maxScore)}</td><td>{attempt.markingSource}</td><td>{attempt.evidenceLevel.replaceAll("_", " ")}</td><td>{formatDate(attempt.completedAt)}</td><td><StatusBadge label={attempt.status} tone={toneForStatus(attempt.status)} /></td></tr>)}</tbody></table></div> : <EmptyState title="No attempts" body="No summary-level attempt records are available." />}</section><section className="notice-card notice-card--info"><strong>Response payloads excluded</strong><p>This general list intentionally reads no learner response content.</p></section></>;
}

function AnalyticsPage({ data }: { data: AdminDataSnapshot }) {
  return <><PageHeader moduleId="analytics" /><section className="metrics-grid" aria-label="Backend analytics summary"><MetricCard label="Completed attempts" value={String(data.dashboardSummary.completedAttempts)} detail="Backend aggregate" tone="positive" /><MetricCard label="Average score" value={percentageLabel(data.dashboardSummary.averageScorePercentage)} detail="Across completed attempts" tone="info" /><MetricCard label="Activity groups" value={String(data.activityPerformance.length)} detail="Grouped performance rows" tone="neutral" /></section><section className="panel"><div className="panel__header"><div><p className="eyebrow">Backend-derived aggregates</p><h2>Activity performance</h2></div></div>{data.activityPerformance.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Activity</th><th scope="col">Group</th><th scope="col">Learners</th><th scope="col">Completed</th><th scope="col">Average</th><th scope="col">Best</th><th scope="col">Latest</th></tr></thead><tbody>{data.activityPerformance.map((row) => <tr key={`${row.groupCode}-${row.activityKey}-${row.activityVersion}`}><th scope="row"><span className="table-primary">{row.activityKey}</span><small>{row.activityVersion}</small></th><td>{row.groupCode}</td><td>{row.learnerCount}</td><td>{row.completedAttempts}</td><td>{percentageLabel(row.averageScorePercentage)}</td><td>{percentageLabel(row.bestScorePercentage)}</td><td>{formatDate(row.latestCompletedAt)}</td></tr>)}</tbody></table></div> : <EmptyState title="No completed attempts" body="The backend analytics view has no aggregate rows yet." />}</section></>;
}

function MonitoringPage({ data }: { data: AdminDataSnapshot }) {
  return <><PageHeader moduleId="monitoring" />{data.health.length ? <div className="card-grid card-grid--4">{data.health.map((health) => <article className="health-card" key={health.serviceKey}><div><span className={`health-dot health-dot--${health.status}`} aria-hidden="true" /><StatusBadge label={health.status} tone={toneForStatus(health.status)} /></div><h2>{health.label}</h2><p>{health.message}</p><small>{health.checkedAt ? `Checked ${formatDate(health.checkedAt)} · ${health.source}` : `No check available · ${health.source}`}</small></article>)}</div> : <section className="panel"><EmptyState title="No health signals" body="No safe health rows are available." /></section>}<section className="notice-card notice-card--info"><strong>Safe operational surface</strong><p>Only public status messages and validity timestamps are selected. Diagnostics, connection details and stack traces are excluded.</p></section></>;
}

function CertificationPage({ data }: { data: AdminDataSnapshot }) {
  const certified = data.hubs.filter((hub) => hub.certificationState === "certified").length;
  return <><PageHeader moduleId="certification" /><section className="certification-summary"><div><p className="eyebrow">Platform assurance</p><strong>{certified}</strong><span>certified hubs</span></div><p>Certification metadata is shown only when it exists in the reviewed backend manifest. Missing metadata is not inferred.</p></section><div className="card-grid card-grid--2">{data.hubs.map((hub) => <article className="certification-card" key={hub.hubCode}><div className="certification-card__header"><div><p className="eyebrow">{hub.hubCode}</p><h2>{hub.hubName}</h2></div><StatusBadge label={hub.certificationState ?? "not recorded"} tone={hub.certificationState === "certified" ? "positive" : "neutral"} /></div></article>)}</div></>;
}

function ConfigurationPage({ data, openPending }: { data: AdminDataSnapshot; openPending: (action: PendingAction) => void }) {
  return <><PageHeader moduleId="configuration" actionLabel="Propose change" onAction={() => openPending({ title: "Propose a platform configuration change" })} /><section className="panel"><div className="panel__header"><div><p className="eyebrow">Version governance</p><h2>Platform contracts</h2></div><span className="count-chip">{data.contracts.length} versions</span></div>{data.contracts.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Contract</th><th scope="col">Version</th><th scope="col">Status</th><th scope="col">Boundary</th></tr></thead><tbody>{data.contracts.map((contract) => <tr key={`${contract.contractKey}-${contract.version}`}><th scope="row"><code>{contract.contractKey}</code></th><td>{contract.version}</td><td><StatusBadge label={contract.status} tone={toneForStatus(contract.status)} /></td><td>{contract.boundary}</td></tr>)}</tbody></table></div> : <EmptyState title="No contracts" body="No platform contract versions are visible." />}</section><section className="notice-card notice-card--warning"><strong>No frontend role rules</strong><p>The portal uses backend staff context and does not infer permissions from email addresses, routes or feature flags.</p></section></>;
}

function AuditPage({ data }: { data: AdminDataSnapshot }) {
  const [query, setQuery] = useState("");
  const visibleEvents = data.auditEvents.filter((event) => `${event.eventKey} ${event.entityType} ${event.entityKey ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <><PageHeader moduleId="audit" /><section className="panel"><h2 className="sr-only">Audit events</h2><div className="toolbar"><div className="toolbar__search"><label htmlFor="audit-query">Search safe audit fields</label><input id="audit-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Action or target key" /></div><span className="toolbar__count" role="status">{visibleEvents.length} events</span></div>{visibleEvents.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Event</th><th scope="col">Actor</th><th scope="col">Entity</th><th scope="col">Target</th><th scope="col">Outcome</th><th scope="col">Occurred</th></tr></thead><tbody>{visibleEvents.map((event, index) => <tr key={`${event.eventKey}-${event.occurredAt}-${index}`}><th scope="row"><code>{event.eventKey}</code></th><td>{event.actorType}</td><td>{event.entityType}</td><td>{event.entityKey ?? "—"}</td><td><StatusBadge label={event.outcome} tone={toneForStatus(event.outcome)} /></td><td>{formatDate(event.occurredAt)}</td></tr>)}</tbody></table></div> : <EmptyState title={query ? "No matching audit events" : "No audit events"} body="No safe event summaries are available for this query." />}</section><section className="notice-card notice-card--info"><strong>Sensitive context stays protected</strong><p>The portal does not select audit context, tokens, credentials or arbitrary learner PII.</p></section></>;
}

export function ModuleContent({ moduleId }: { moduleId: AdminModuleId }) {
  const { data, session, dataSource, publishCurriculum, registerHub, updateHub, reviewResponse } = useAdminPortal();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editingHub, setEditingHub] = useState<HubRecord | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  if (!data) return null;
  const openPending = (action: PendingAction) => setPendingAction(action);
  const hubDialogOpen = registerOpen || Boolean(editingHub);
  let content: React.ReactNode;

  switch (moduleId) {
    case "dashboard": content = <DashboardPage data={data} />; break;
    case "hubs": content = (
      <HubRegistryPage
        data={data}
        actionError={editingHub ? null : registerError}
        onRegister={() => { setEditingHub(null); setRegisterError(null); setRegisterOpen(true); }}
        onEdit={(hub) => { setRegisterOpen(false); setRegisterError(null); setEditingHub(hub); }}
        onToggleActive={async (hub) => {
          const courseKeys = data.hubCourseLinks
            .filter((link) => link.hubCode === hub.hubCode && link.active)
            .map((link) => link.courseKey);
          setRegisterError(null);
          try {
            await updateHub({
              manifest: manifestFromHubRecord(hub, courseKeys),
              status: hub.status,
              active: !hub.active,
            });
          } catch (caught) {
            setRegisterError(
              caught instanceof AdminHubRegistrationError
                ? caught.message
                : caught instanceof Error
                  ? caught.message
                  : "The hub could not be updated.",
            );
          }
        }}
      />
    ); break;
    case "courses": content = <CoursesPage data={data} openPending={openPending} />; break;
    case "curriculum": content = (
      <CurriculumAuthoringPage
        hubs={data.hubs}
        links={data.hubCourseLinks}
        actor={session.displayName}
        publications={data.curriculumPublications}
        platformAvailable={dataSource.mode === "live" && dataSource.state === "ready"}
        onPublishToPlatform={publishCurriculum}
      />
    ); break;
    case "activities": content = <DeferredLearningPage moduleId="activities" openPending={openPending} />; break;
    case "learners": content = <LearnersPage data={data} openPending={openPending} />; break;
    case "teachers": content = <TeachersPage data={data} openPending={openPending} />; break;
    case "groups": content = <GroupsPage data={data} openPending={openPending} />; break;
    case "enrolments": content = <EnrolmentsPage data={data} openPending={openPending} />; break;
    case "assignments": content = <AssignmentsPage data={data} openPending={openPending} />; break;
    case "results": content = <ResultsMarkbookPage data={data} onReviewResponse={reviewResponse} />; break;
    case "attempts": content = <AttemptsPage data={data} />; break;
    case "analytics": content = <AnalyticsPage data={data} />; break;
    case "monitoring": content = <MonitoringPage data={data} />; break;
    case "certification": content = <CertificationPage data={data} />; break;
    case "configuration": content = <ConfigurationPage data={data} openPending={openPending} />; break;
    case "audit": content = <AuditPage data={data} />; break;
    default: content = <DashboardPage data={data} />;
  }

  return (
    <>
      {content}
      <PendingActionDialog action={pendingAction} onClose={() => setPendingAction(null)} />
      {hubDialogOpen ? (
        <RegisterHubDialog
          key={editingHub ? `edit:${editingHub.hubCode}` : "register"}
          open={hubDialogOpen}
          mode={editingHub ? "edit" : "register"}
          initialHub={editingHub}
          data={data}
          demoMode={dataSource.mode === "demo"}
          submitting={registering}
          error={registerError}
          onClose={() => {
            if (!registering) {
              setRegisterOpen(false);
              setEditingHub(null);
              setRegisterError(null);
            }
          }}
          onConfirm={async (request) => {
            setRegistering(true);
            setRegisterError(null);
            try {
              if (editingHub) await updateHub(request);
              else await registerHub(request);
              setRegisterOpen(false);
              setEditingHub(null);
            } catch (caught) {
              setRegisterError(
                caught instanceof AdminHubRegistrationError
                  ? caught.message
                  : caught instanceof Error
                    ? caught.message
                    : editingHub ? "The hub could not be updated." : "The hub could not be registered.",
              );
            } finally {
              setRegistering(false);
            }
          }}
        />
      ) : null}
    </>
  );
}
