"use client";

import { useMemo, useState } from "react";
import type { HubRecord } from "../api/admin-api";
import { AdminLink } from "../components/admin-link";
import { HubDetailDialog } from "../components/hub-detail-dialog";
import {
  PendingActionDialog,
  type PendingAction,
} from "../components/pending-action-dialog";
import { StatusBadge, type BadgeTone } from "../components/status-badge";
import { getAdminModule, type AdminModuleId } from "../router/modules";
import {
  ASSIGNMENTS,
  CONTRACTS,
  ENROLMENTS,
  GROUPS,
  HEALTH,
  HUBS,
  LEARNERS,
  TEACHERS,
} from "../services/demo-admin-service";
import { formatDate } from "../utils/format";

const COURSES = [
  {
    key: "ocr-level-3-it",
    title: "OCR Level 3 IT",
    hub: "Unit 3 Cyber Security Hub",
    curriculum: "76 reviewed activity definitions",
    state: "migration review",
  },
  {
    key: "t-level-digital-software-development",
    title: "T Level Digital Software Development",
    hub: "T Level Digital Software Development Hub",
    curriculum: "5 foundation activity definitions",
    state: "foundation",
  },
] as const;

const ATTENTION_ITEMS = [
  { priority: "P0", title: "Administrative writes are not yet defined", detail: "The admin API 0.1.0 contract is deliberately read-only.", owner: "Backend platform" },
  { priority: "P1", title: "Hosted migration handoff remains pending", detail: "The backend foundation is not yet reconciled with hosted migration history.", owner: "Platform operations" },
  { priority: "P3", title: "Two active hubs remain uncertified", detail: "Both registered hubs are in testing and have open LHDS conformance work.", owner: "Quality review" },
  { priority: "P5", title: "Monitoring collectors are not configured", detail: "Health and audit foundations exist, but no external pipeline is connected.", owner: "Platform operations" },
] as const;

const ANALYTIC_LENSES = [
  ["Learner progress", "Completion, attempts and outcome coverage"],
  ["Group progress", "Cohort comparison and completion distribution"],
  ["Question performance", "Response-level success and misconception patterns"],
  ["Topic performance", "Topic and skill aggregation"],
  ["Learning outcomes", "Coverage and achievement by outcome"],
  ["Submission trends", "Timing, success and retry behaviour"],
  ["Completion", "Required and optional activity completion"],
  ["Intervention indicators", "Reviewed signals for staff follow-up"],
] as const;

const CERTIFICATION_AREAS = [
  "Accessibility",
  "Testing",
  "Performance",
  "Security",
  "Documentation",
  "Compatibility",
] as const;

function toneForStatus(status: string): BadgeTone {
  if (["active", "healthy", "certified", "open", "production"].includes(status)) return "positive";
  if (["testing", "partial", "draft", "not certified", "degraded"].includes(status)) return "warning";
  if (["unavailable", "failed", "inactive"].includes(status)) return "danger";
  if (["pending", "unknown"].includes(status)) return "neutral";
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

function DashboardPage() {
  return (
    <>
      <PageHeader moduleId="dashboard" />
      <section className="metrics-grid" aria-label="Platform summary">
        <MetricCard label="Registered hubs" value="2" detail="Both active in testing" tone="info" />
        <MetricCard label="Platform contracts" value="3" detail="2 active · 1 draft" tone="positive" />
        <MetricCard label="Hub certification" value="0 / 2" detail="Evidence review required" tone="warning" />
        <MetricCard label="Administrative writes" value="Pending" detail="Read-only foundation" tone="neutral" />
      </section>
      <section className="panel platform-coverage-panel" aria-labelledby="coverage-overview-title">
        <div className="panel__header"><div><p className="eyebrow">Dashboard coverage</p><h2 id="coverage-overview-title">Operational overview</h2></div><span className="count-chip">Foundation state</span></div>
        <div className="platform-coverage">
          {[
            ["Learners", "2 synthetic"],
            ["Teachers", "2 synthetic"],
            ["Assignments", "2 preview rows"],
            ["Submissions", "Data pending"],
            ["Activity completion", "Analytics pending"],
            ["API health", "Live check pending"],
            ["Deployment", "Integration pending"],
            ["Certification", "0 of 2"],
          ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="panel panel--span-2" aria-labelledby="hub-readiness-title">
          <div className="panel__header">
            <div><p className="eyebrow">Registry</p><h2 id="hub-readiness-title">Hub readiness</h2></div>
            <AdminLink className="text-link" href="/hubs">Open registry <span aria-hidden="true">→</span></AdminLink>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Hub</th><th scope="col">Compatibility</th><th scope="col">Lifecycle</th><th scope="col">Certification</th></tr></thead>
              <tbody>
                {HUBS.map((hub) => (
                  <tr key={hub.hubCode}>
                    <th scope="row"><span className="table-primary">{hub.hubName}</span><code>{hub.hubCode}</code></th>
                    <td>Platform {hub.platformVersion}</td>
                    <td><StatusBadge label={hub.status} tone={toneForStatus(hub.status)} /></td>
                    <td><StatusBadge label="not certified" tone="warning" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel" aria-labelledby="health-title">
          <div className="panel__header"><div><p className="eyebrow">Operations</p><h2 id="health-title">Platform health</h2></div></div>
          <ul className="health-list">
            {HEALTH.map((health) => (
              <li key={health.serviceKey}>
                <span className={`health-dot health-dot--${health.status}`} aria-hidden="true" />
                <span><strong>{health.label}</strong><small>{health.message}</small></span>
                <StatusBadge label={health.status} tone={toneForStatus(health.status)} />
              </li>
            ))}
          </ul>
        </section>
        <section className="panel panel--span-2" aria-labelledby="attention-title">
          <div className="panel__header"><div><p className="eyebrow">Priorities</p><h2 id="attention-title">Attention queue</h2></div><span className="count-chip">4 open</span></div>
          <div className="attention-list">
            {ATTENTION_ITEMS.map((item) => (
              <article key={item.title}>
                <span className="priority-chip">{item.priority}</span>
                <div><h3>{item.title}</h3><p>{item.detail}</p></div>
                <small>{item.owner}</small>
              </article>
            ))}
          </div>
        </section>
        <section className="panel" aria-labelledby="activity-title">
          <div className="panel__header"><div><p className="eyebrow">Audit</p><h2 id="activity-title">Recent activity</h2></div></div>
          <EmptyState title="No live audit source" body="Connect an authenticated admin_api client to display safe platform events." />
        </section>
      </div>
    </>
  );
}

function HubRegistryPage({ openPending }: { openPending: (action: PendingAction) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedHub, setSelectedHub] = useState<HubRecord | null>(null);
  const visibleHubs = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    return HUBS.filter((hub) => {
      const matchesQuery = !normalised || `${hub.hubName} ${hub.hubCode} ${hub.subject}`.toLowerCase().includes(normalised);
      return matchesQuery && (status === "all" || hub.status === status);
    });
  }, [query, status]);

  return (
    <>
      <PageHeader moduleId="hubs" actionLabel="Register hub" onAction={() => openPending({ title: "Register a hub" })} />
      <section className="panel">
        <div className="toolbar">
          <div className="toolbar__search"><label htmlFor="hub-search">Search hubs</label><input id="hub-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, code or subject" /></div>
          <div><label htmlFor="hub-status">Lifecycle</label><select id="hub-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All states</option><option value="testing">Testing</option><option value="production">Production</option><option value="archived">Archived</option></select></div>
          <span className="toolbar__count" role="status">{visibleHubs.length} of {HUBS.length} hubs</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Hub</th><th scope="col">Version</th><th scope="col">Platform</th><th scope="col">Status</th><th scope="col">Certification</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {visibleHubs.map((hub) => (
                <tr key={hub.hubCode}>
                  <th scope="row"><span className="hub-cell"><span className="hub-cell__mark" aria-hidden="true">{hub.hubName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><span><span className="table-primary">{hub.hubName}</span><code>{hub.hubCode}</code></span></span></th>
                  <td>{hub.hubVersion}</td><td>{hub.platformVersion}</td>
                  <td><StatusBadge label={hub.status} tone="info" /></td>
                  <td><StatusBadge label={hub.certified ? "certified" : "not certified"} tone={hub.certified ? "positive" : "warning"} /></td>
                  <td><div className="table-actions"><button className="button button--small button--secondary" type="button" onClick={() => setSelectedHub(hub)}>View</button><button className="icon-button" type="button" aria-label={`Edit ${hub.hubName}`} onClick={() => openPending({ title: "Edit hub", subject: hub.hubName })}>•••</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleHubs.length ? <EmptyState title="No hubs match" body="Change the search or lifecycle filter." /> : null}
      </section>
      <HubDetailDialog
        hub={selectedHub}
        onClose={() => setSelectedHub(null)}
        onEdit={(hub) => { setSelectedHub(null); openPending({ title: "Edit hub", subject: hub.hubName }); }}
        onDeactivate={(hub) => { setSelectedHub(null); openPending({ title: "Deactivate hub", subject: hub.hubName }); }}
      />
    </>
  );
}

function CoursesPage({ openPending }: { openPending: (action: PendingAction) => void }) {
  return (
    <>
      <PageHeader moduleId="courses" actionLabel="Create course" onAction={() => openPending({ title: "Create a course" })} />
      <div className="card-grid card-grid--2">
        {COURSES.map((course) => (
          <article className="record-card" key={course.key}>
            <div className="record-card__header"><span className="record-card__mark" aria-hidden="true">CR</span><StatusBadge label={course.state} tone="info" /></div>
            <h2>{course.title}</h2><code>{course.key}</code>
            <dl><div><dt>Registered hub</dt><dd>{course.hub}</dd></div><div><dt>Reviewed catalogue</dt><dd>{course.curriculum}</dd></div></dl>
            <div className="record-card__actions"><button className="button button--secondary" type="button" onClick={() => openPending({ title: "Edit course", subject: course.title })}>Review course</button></div>
          </article>
        ))}
      </div>
      <section className="notice-card notice-card--info"><strong>Administrative read gap</strong><p>The current admin API exposes course links through <code>admin_api.hub_course_links</code>, but not a dedicated course catalogue view or mutation RPC.</p></section>
    </>
  );
}

function CurriculumPage({ openPending }: { openPending: (action: PendingAction) => void }) {
  const hierarchy = ["Course", "Unit", "Week", "Session", "Activity", "Learning outcome"];
  return (
    <>
      <PageHeader moduleId="curriculum" actionLabel="Add curriculum item" onAction={() => openPending({ title: "Add a curriculum item" })} />
      <section className="panel" aria-labelledby="hierarchy-title">
        <div className="panel__header"><div><p className="eyebrow">LHDS hierarchy</p><h2 id="hierarchy-title">Curriculum structure</h2></div><StatusBadge label="contract pending" tone="warning" /></div>
        <ol className="hierarchy-flow">
          {hierarchy.map((level, index) => <li key={level}><span>{index + 1}</span><strong>{level}</strong>{index < hierarchy.length - 1 ? <span className="hierarchy-flow__arrow" aria-hidden="true">→</span> : null}</li>)}
        </ol>
      </section>
      <div className="dashboard-grid">
        <section className="panel panel--span-2" aria-labelledby="curriculum-readiness-title">
          <div className="panel__header"><div><p className="eyebrow">Reviewed manifests</p><h2 id="curriculum-readiness-title">Metadata readiness</h2></div></div>
          <div className="table-wrap"><table><thead><tr><th scope="col">Hub curriculum</th><th scope="col">Structure</th><th scope="col">Activity catalogue</th><th scope="col">Lifecycle</th><th scope="col">Outcomes</th></tr></thead><tbody><tr><th scope="row">Unit 3 Cyber Security</th><td><StatusBadge label="partial" tone="warning" /></td><td>76 definitions</td><td><StatusBadge label="pending" tone="neutral" /></td><td><StatusBadge label="partial" tone="warning" /></td></tr><tr><th scope="row">Software Development Foundations</th><td><StatusBadge label="partial" tone="warning" /></td><td>5 definitions</td><td><StatusBadge label="pending" tone="neutral" /></td><td><StatusBadge label="partial" tone="warning" /></td></tr></tbody></table></div>
        </section>
        <section className="panel" aria-labelledby="lifecycle-title"><div className="panel__header"><div><p className="eyebrow">Publication workflow</p><h2 id="lifecycle-title">Activity lifecycle</h2></div></div><ol className="vertical-steps">{["Draft", "Review", "Approved", "Published", "Retired", "Archived"].map((step, index) => <li key={step}><span>{index + 1}</span><strong>{step}</strong><small>{index < 2 ? "UI prepared" : "Backend contract pending"}</small></li>)}</ol></section>
      </div>
    </>
  );
}

function ActivitiesPage({ openPending }: { openPending: (action: PendingAction) => void }) {
  const activities = [
    ["Unit 3 Cyber Security", "76", "retrieval, classification, matching, reflection", "1.0 migration review"],
    ["Software Development Foundations", "5", "diagnostic, classification, scenario, knowledge check", "1.0.0–2.0.0"],
  ] as const;
  return (
    <>
      <PageHeader moduleId="activities" actionLabel="Create activity" onAction={() => openPending({ title: "Create an activity" })} />
      <section className="panel">
        <div className="panel__header"><div><p className="eyebrow">Reviewed source artefacts</p><h2>Activity catalogue</h2></div><span className="count-chip">81 known definitions</span></div>
        <div className="table-wrap"><table><thead><tr><th scope="col">Curriculum</th><th scope="col">Definitions</th><th scope="col">Interaction types</th><th scope="col">Version state</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{activities.map(([name, count, types, versions]) => <tr key={name}><th scope="row">{name}</th><td>{count}</td><td>{types}</td><td>{versions}</td><td><button className="button button--small button--secondary" type="button" onClick={() => openPending({ title: "Review activity catalogue", subject: name })}>Review</button></td></tr>)}</tbody></table></div>
      </section>
      <div className="card-grid card-grid--3">
        {[ ["Evidence", "Structured evidence is present, but schema-version coverage remains incomplete."], ["Versioning", "Software Development uses semantic versions; Unit 3 still has 1.0 source versions to migrate."], ["Lifecycle", "Draft-to-archive administration needs new backend workflow and audit contracts."] ].map(([title, detail]) => <article className="insight-card" key={title}><span aria-hidden="true">◇</span><h2>{title}</h2><p>{detail}</p></article>)}
      </div>
    </>
  );
}

function LearnersPage({ openPending }: { openPending: (action: PendingAction) => void }) {
  return (
    <>
      <PageHeader moduleId="learners" actionLabel="Add learner" onAction={() => openPending({ title: "Add a learner" })} />
      <section className="panel"><div className="panel__header"><div><p className="eyebrow">Synthetic local fixtures</p><h2>Learner directory preview</h2></div><span className="count-chip">2 records</span></div><div className="table-wrap"><table><thead><tr><th scope="col">Learner</th><th scope="col">Student number</th><th scope="col">Group</th><th scope="col">Enrolments</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{LEARNERS.map((learner) => <tr key={learner.studentNumber}><th scope="row"><span className="table-primary">{learner.displayName}</span></th><td><code>{learner.studentNumber}</code></td><td>{learner.groupCode}</td><td>{learner.enrolmentCount}</td><td><StatusBadge label={learner.active ? "active" : "inactive"} tone={learner.active ? "positive" : "neutral"} /></td><td><button className="button button--small button--secondary" type="button" onClick={() => openPending({ title: "Manage learner", subject: learner.displayName })}>View</button></td></tr>)}</tbody></table></div></section>
      <section className="notice-card notice-card--info"><strong>Privacy by design</strong><p>The preview uses synthetic fixture records and does not expose internal UUIDs. Responses and detailed evidence are intentionally absent from the general learner view.</p></section>
    </>
  );
}

function TeachersPage({ openPending }: { openPending: (action: PendingAction) => void }) {
  return (
    <>
      <PageHeader moduleId="teachers" actionLabel="Invite teacher" onAction={() => openPending({ title: "Invite a teacher" })} />
      <section className="panel"><div className="panel__header"><div><p className="eyebrow">Synthetic local fixtures</p><h2>Teacher profiles</h2></div></div><div className="table-wrap"><table><thead><tr><th scope="col">Teacher</th><th scope="col">Staff reference</th><th scope="col">Assigned groups</th><th scope="col">Course access</th><th scope="col">Administration context</th><th scope="col">Status</th></tr></thead><tbody>{TEACHERS.map((teacher) => <tr key={teacher.staffReference}><th scope="row">{teacher.displayName}</th><td><code>{teacher.staffReference}</code></td><td>{teacher.groupCount}</td><td>{teacher.courseAccess}</td><td>{teacher.roleLabel}</td><td><StatusBadge label={teacher.active ? "active" : "inactive"} tone={teacher.active ? "positive" : "neutral"} /></td></tr>)}</tbody></table></div></section>
      <section className="notice-card notice-card--warning"><strong>Backend-authoritative roles</strong><p>A teacher profile does not automatically grant platform administration. Access must continue through active <code>platform.staff_roles</code> records and backend RLS.</p></section>
    </>
  );
}

function GroupsPage({ openPending }: { openPending: (action: PendingAction) => void }) {
  return (
    <>
      <PageHeader moduleId="groups" actionLabel="Create group" onAction={() => openPending({ title: "Create a group" })} />
      <section className="panel"><div className="panel__header"><div><p className="eyebrow">Synthetic local fixtures</p><h2>Academic groups</h2></div></div><div className="table-wrap"><table><thead><tr><th scope="col">Group</th><th scope="col">Academic year</th><th scope="col">Year</th><th scope="col">Course and hub</th><th scope="col">Capacity</th><th scope="col">Registration</th><th scope="col">Status</th></tr></thead><tbody>{GROUPS.map((group) => <tr key={group.groupCode}><th scope="row"><span className="table-primary">{group.groupName}</span><code>{group.groupCode}</code></th><td>{group.academicYear}</td><td>{group.yearGroup}</td><td><span className="table-primary">{group.courseTitle}</span><small>{group.hubName}</small></td><td>{group.capacity ?? "Not exposed"}</td><td><StatusBadge label={group.registrationOpen ? "open" : "closed"} tone={group.registrationOpen ? "positive" : "neutral"} /></td><td><StatusBadge label={group.active ? "active" : "inactive"} tone={group.active ? "positive" : "neutral"} /></td></tr>)}</tbody></table></div></section>
      <section className="notice-card notice-card--info"><strong>Registration keys stay protected</strong><p>This administration surface displays registration state but does not reveal registration-key values in general tables.</p></section>
    </>
  );
}

function EnrolmentsPage({ openPending }: { openPending: (action: PendingAction) => void }) {
  return (
    <>
      <PageHeader moduleId="enrolments" actionLabel="Create enrolment" onAction={() => openPending({ title: "Create an enrolment" })} />
      <section className="panel"><div className="panel__header"><div><p className="eyebrow">Multi-course ready</p><h2>Enrolment history</h2></div></div><div className="table-wrap"><table><thead><tr><th scope="col">Learner</th><th scope="col">Group</th><th scope="col">Joined</th><th scope="col">Left</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{ENROLMENTS.map((enrolment) => <tr key={`${enrolment.learnerNumber}-${enrolment.groupCode}`}><th scope="row"><code>{enrolment.learnerNumber}</code></th><td>{enrolment.groupCode}</td><td>{formatDate(enrolment.joinedOn)}</td><td>{formatDate(enrolment.leftOn)}</td><td><StatusBadge label={enrolment.status} tone="positive" /></td><td><button className="button button--small button--secondary" type="button" onClick={() => openPending({ title: "Transfer enrolment", subject: enrolment.learnerNumber })}>Manage</button></td></tr>)}</tbody></table></div></section>
    </>
  );
}

function AssignmentsPage({ openPending }: { openPending: (action: PendingAction) => void }) {
  return (
    <>
      <PageHeader moduleId="assignments" actionLabel="Create assignment" onAction={() => openPending({ title: "Create an assignment" })} />
      <section className="panel"><div className="panel__header"><div><p className="eyebrow">Synthetic local fixtures</p><h2>Assignment delivery</h2></div></div><div className="table-wrap"><table><thead><tr><th scope="col">Activity</th><th scope="col">Version</th><th scope="col">Group</th><th scope="col">Window</th><th scope="col">Required</th><th scope="col">Completion</th><th scope="col">Status</th></tr></thead><tbody>{ASSIGNMENTS.map((assignment) => <tr key={`${assignment.groupCode}-${assignment.activityKey}`}><th scope="row"><code>{assignment.activityKey}</code></th><td>{assignment.activityVersion}</td><td>{assignment.groupCode}</td><td>{assignment.opensAt ? `${formatDate(assignment.opensAt)} – ${formatDate(assignment.dueAt)}` : "Always available fixture"}</td><td>{assignment.required ? "Yes" : "No"}</td><td>{assignment.completionState}</td><td><StatusBadge label={assignment.active ? "active" : "inactive"} tone={assignment.active ? "positive" : "neutral"} /></td></tr>)}</tbody></table></div></section>
      <section className="notice-card notice-card--warning"><strong>Mutation workflow pending</strong><p>Assignment creation needs an audited, idempotent backend RPC with availability, version and group validation before this UI can submit changes.</p></section>
    </>
  );
}

function AnalyticsPage() {
  return (
    <>
      <PageHeader moduleId="analytics" />
      <section className="notice-card notice-card--info"><strong>No fabricated analytics</strong><p>The backend has attempt and progress foundations, but no approved administrative analytics contract. These panels define the intended questions and remain empty until real aggregated data is available.</p></section>
      <div className="card-grid card-grid--4">
        {ANALYTIC_LENSES.map(([title, detail]) => <article className="analytics-placeholder" key={title}><div className="analytics-placeholder__header"><span aria-hidden="true">∿</span><StatusBadge label="contract pending" tone="neutral" /></div><h2>{title}</h2><p>{detail}</p><div className="analytics-placeholder__chart" aria-hidden="true"><span /><span /><span /><span /></div><small>Awaiting approved analytics view</small></article>)}
      </div>
    </>
  );
}

function MonitoringPage() {
  return (
    <>
      <PageHeader moduleId="monitoring" />
      <div className="card-grid card-grid--4">{HEALTH.map((health) => <article className="health-card" key={health.serviceKey}><div><span className={`health-dot health-dot--${health.status}`} aria-hidden="true" /><StatusBadge label={health.status} tone={toneForStatus(health.status)} /></div><h2>{health.label}</h2><p>{health.message}</p><small>{health.checkedAt ? `Checked ${formatDate(health.checkedAt)} · ${health.source}` : `No check available · ${health.source}`}</small></article>)}</div>
      <section className="panel" aria-labelledby="monitoring-coverage-title"><div className="panel__header"><div><p className="eyebrow">Planned coverage</p><h2 id="monitoring-coverage-title">Operational signals</h2></div></div><div className="coverage-grid">{["API availability", "Submission failures", "Authentication failures", "Migration version", "Hub compatibility", "System health"].map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><StatusBadge label={index === 5 ? "partial" : "pending"} tone={index === 5 ? "warning" : "neutral"} /></div>)}</div></section>
    </>
  );
}

function CertificationPage() {
  return (
    <>
      <PageHeader moduleId="certification" />
      <section className="certification-summary"><div><p className="eyebrow">Platform assurance</p><strong>0</strong><span>certified hubs</span></div><p>Both registered hubs have strong foundations and remain in testing. Certification should only follow complete functional, accessibility, security, compatibility, documentation and testing review.</p></section>
      <div className="card-grid card-grid--2">{HUBS.map((hub) => <article className="certification-card" key={hub.hubCode}><div className="certification-card__header"><div><p className="eyebrow">{hub.hubCode}</p><h2>{hub.hubName}</h2></div><StatusBadge label="not certified" tone="warning" /></div><ul>{CERTIFICATION_AREAS.map((area, index) => <li key={area}><span>{area}</span><StatusBadge label={index < 2 ? "partial" : "review required"} tone={index < 2 ? "warning" : "neutral"} /></li>)}</ul><div className="certification-card__footer"><small>Review history will appear after the audit API is connected.</small></div></article>)}</div>
    </>
  );
}

function ConfigurationPage({ openPending }: { openPending: (action: PendingAction) => void }) {
  return (
    <>
      <PageHeader moduleId="configuration" actionLabel="Propose change" onAction={() => openPending({ title: "Propose a platform configuration change" })} />
      <div className="dashboard-grid">
        <section className="panel panel--span-2"><div className="panel__header"><div><p className="eyebrow">Version governance</p><h2>Platform contracts</h2></div></div><div className="table-wrap"><table><thead><tr><th scope="col">Contract</th><th scope="col">Version</th><th scope="col">Status</th><th scope="col">Boundary</th></tr></thead><tbody>{CONTRACTS.map((contract) => <tr key={contract.contractKey}><th scope="row"><code>{contract.contractKey}</code></th><td>{contract.version}</td><td><StatusBadge label={contract.status} tone={toneForStatus(contract.status)} /></td><td>{contract.boundary}</td></tr>)}</tbody></table></div></section>
        <section className="panel"><div className="panel__header"><div><p className="eyebrow">Administration</p><h2>Permission model</h2></div></div><div className="permission-stack">{["Platform Administrator", "Curriculum Administrator", "Teacher", "Course Administrator", "Quality Reviewer", "Read-only Auditor"].map((role, index) => <div key={role}><span className="record-card__mark" aria-hidden="true">{index + 1}</span><strong>{role}</strong><small>{index < 2 || index === 5 ? "Backend role foundation" : "Future role mapping"}</small></div>)}</div></section>
      </div>
      <section className="notice-card notice-card--warning"><strong>No frontend role rules</strong><p>The portal consumes backend-granted actions. It does not infer permissions from email addresses or treat displayed roles as authorisation.</p></section>
    </>
  );
}

function AuditPage() {
  const [searched, setSearched] = useState(false);
  return (
    <>
      <PageHeader moduleId="audit" />
      <section className="panel">
        <h2 className="sr-only">Audit events</h2>
        <form className="audit-filters" onSubmit={(event) => { event.preventDefault(); setSearched(true); }}>
          <div><label htmlFor="audit-query">Search</label><input id="audit-query" type="search" placeholder="Action or safe target key" /></div>
          <div><label htmlFor="audit-actor">Actor</label><select id="audit-actor"><option>All actors</option><option>Staff</option><option>Learner</option><option>Service</option><option>System</option></select></div>
          <div><label htmlFor="audit-outcome">Outcome</label><select id="audit-outcome"><option>All outcomes</option><option>Succeeded</option><option>Failed</option><option>Denied</option></select></div>
          <div><label htmlFor="audit-from">From</label><input id="audit-from" type="date" /></div>
          <button className="button button--primary" type="submit">Apply filters</button>
        </form>
        <EmptyState title={searched ? "No matching demo events" : "No live audit events"} body="The read view is prepared. Connect an authorised admin_api client to search actor, action, target, timestamp and safe context." />
      </section>
      <section className="notice-card notice-card--info"><strong>Sensitive context stays protected</strong><p>Audit results must minimise context and never expose tokens, passwords, arbitrary learner PII or sensitive backend responses.</p></section>
    </>
  );
}

export function ModuleContent({ moduleId }: { moduleId: AdminModuleId }) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const openPending = (action: PendingAction) => setPendingAction(action);
  let content: React.ReactNode;

  switch (moduleId) {
    case "dashboard": content = <DashboardPage />; break;
    case "hubs": content = <HubRegistryPage openPending={openPending} />; break;
    case "courses": content = <CoursesPage openPending={openPending} />; break;
    case "curriculum": content = <CurriculumPage openPending={openPending} />; break;
    case "activities": content = <ActivitiesPage openPending={openPending} />; break;
    case "learners": content = <LearnersPage openPending={openPending} />; break;
    case "teachers": content = <TeachersPage openPending={openPending} />; break;
    case "groups": content = <GroupsPage openPending={openPending} />; break;
    case "enrolments": content = <EnrolmentsPage openPending={openPending} />; break;
    case "assignments": content = <AssignmentsPage openPending={openPending} />; break;
    case "analytics": content = <AnalyticsPage />; break;
    case "monitoring": content = <MonitoringPage />; break;
    case "certification": content = <CertificationPage />; break;
    case "configuration": content = <ConfigurationPage openPending={openPending} />; break;
    case "audit": content = <AuditPage />; break;
    default: content = <DashboardPage />;
  }

  return (
    <>
      {content}
      <PendingActionDialog action={pendingAction} onClose={() => setPendingAction(null)} />
    </>
  );
}
