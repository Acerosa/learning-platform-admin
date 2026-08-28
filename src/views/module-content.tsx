"use client";

import { useMemo, useState } from "react";
import type {
  AdminDataSnapshot,
  HubRecord,
} from "../api/admin-api";
import type { DashboardData } from "../api/admin-module-data";
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
import { legacyRouteContext } from "../router/legacy-routes";
import { getAdminModule, type AdminModuleId } from "../router/modules";
import { AdminHubRegistrationError } from "../services/supabase-admin-service";
import { useAdminPortal } from "../stores/admin-portal";
import { moduleDataKeyForRoute, sliceDemoModuleData } from "../api/admin-module-data";
import { ModuleDataShell } from "../components/module-data-shell";
import { formatDate } from "../utils/format";
import { AssessmentArea } from "./assessment-area";
import { CurriculumAuthoringPage } from "./curriculum-authoring";
import { AnalyticsPage } from "./analytics";
import { ContentLibraryPage } from "./content-library";
import { CompositionPage } from "./composition";
import { PeopleArea } from "./people-area";
import { SystemArea } from "./system-area";

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

function weekCountForHub(hubCode: string, localDrafts: ReturnType<typeof loadDrafts>) {
  const draft = localDrafts
    .filter((item) => item.hubId === hubCode)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  return draft?.package.weeks.length ?? null;
}

function DashboardPage({ data }: { data: DashboardData }) {
  const summary = data.dashboardSummary;
  const recentAttempts = data.recentAttempts;
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
            <AdminLink className="text-link" href="/hubs">Open hubs <span aria-hidden="true">→</span></AdminLink>
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
          <div className="panel__header"><div><p className="eyebrow">Evidence</p><h2 id="recent-attempts-title">Recent attempts</h2></div><AdminLink className="text-link" href="/assessment">View results <span aria-hidden="true">→</span></AdminLink></div>
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
        {visibleHubs.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Hub</th><th scope="col">Course</th><th scope="col">Status</th><th scope="col">Active</th><th scope="col">Curriculum</th><th scope="col">Weeks</th><th scope="col">Health</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleHubs.map((hub) => {
          const links = data.hubCourseLinks.filter((link) => link.hubCode === hub.hubCode && link.active);
          const publication = hubPublicationStatus(hub, data, localDrafts);
          const health = hubHealthReport(hub, data, localDrafts);
          const weekCount = weekCountForHub(hub.hubCode, localDrafts);
          return (
            <tr key={hub.hubCode}>
              <th scope="row"><span className="hub-cell"><span className="hub-cell__mark" aria-hidden="true">{hub.hubName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><span><span className="table-primary">{hub.hubName}</span><code>{hub.hubCode}</code></span></span></th>
              <td>{links.map((link) => link.courseTitle).join(", ") || "No active link"}</td>
              <td><StatusBadge label={hub.status} tone={toneForStatus(hub.status)} /></td>
              <td><StatusBadge label={hub.active ? "active" : "inactive"} tone={hub.active ? "positive" : "neutral"} /></td>
              <td><StatusBadge label={publication.displayLabel} tone={toneForStatus(publication.displayStatus)} /></td>
              <td>{weekCount ?? "—"}</td>
              <td><StatusBadge label={health.summary} tone={toneForStatus(health.status)} /></td>
              <td>
                <button className="button button--small button--secondary" type="button" onClick={() => setSelectedHubCode(hub.hubCode)}>View</button>
                <AdminLink className="button button--small button--secondary" href="/curriculum">Curriculum</AdminLink>
              </td>
            </tr>
          );
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

function DeferredLearningPage({ moduleId }: { moduleId: "activities" }) {
  return (
    <>
      <PageHeader moduleId={moduleId} />
      <section className="panel">
        <EmptyState
          title="Activity catalogue is not the teaching editor"
          body="This route is reserved for a future group-delivery activity catalogue. Teaching activities are authored in Curriculum."
        />
      </section>
    </>
  );
}

function legacyHeading(moduleId: AdminModuleId): string | undefined {
  const legacyIds = new Set([
    "courses", "learners", "teachers", "groups", "enrolments",
    "assignments", "results", "attempts",
    "monitoring", "certification", "configuration", "audit",
  ]);
  if (!legacyIds.has(moduleId)) return undefined;
  return getAdminModule(moduleId).label;
}

export function ModuleContent({ moduleId }: { moduleId: AdminModuleId }) {
  const { data, session, dataSource, moduleCache, publishCurriculum, saveCurriculumDraft, loadCurrentCurriculumPackage, getCurriculumDraft, registerHub, updateHub, reviewResponse, bootstrapReady } = useAdminPortal();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editingHub, setEditingHub] = useState<HubRecord | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const moduleKey = moduleDataKeyForRoute(moduleId);
  if (!bootstrapReady || !data) return null;
  const openPending = (action: PendingAction) => setPendingAction(action);
  const hubDialogOpen = registerOpen || Boolean(editingHub);
  const routeContext = legacyRouteContext(moduleId);
  const heading = legacyHeading(moduleId);

  const curriculumAuthoring = (
    <CurriculumAuthoringPage
      hubs={data.hubs}
      links={data.hubCourseLinks}
      actor={session.displayName}
      publications={data.curriculumPublications}
      platformAvailable={dataSource.mode === "live" && dataSource.state === "ready"}
      onPublishToPlatform={publishCurriculum}
      onSaveDraft={saveCurriculumDraft}
      onLoadPublishedPackage={async (hubCode, courseKey) => {
        const published = await loadCurrentCurriculumPackage(hubCode, courseKey);
        return {
          packageVersion: published.packageVersion,
          package: published.package as unknown as import("../content/types").ContentPackage,
        };
      }}
      onLoadRemoteDrafts={async () => Promise.all(data.curriculumDrafts.map((summary) => getCurriculumDraft(summary.id)))}
    />
  );

  let content: React.ReactNode;

  switch (moduleId) {
    case "dashboard":
      content = moduleCache.dashboard.data
        ? <DashboardPage data={moduleCache.dashboard.data} />
        : null;
      break;
    case "hubs":
    case "courses":
      content = (
        <>
          {moduleId === "courses" ? (
            <section className="notice-card notice-card--info"><strong>Course catalogue moved</strong><p>Course information is shown in hub context. This legacy route opens the hub registry.</p></section>
          ) : null}
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
        </>
      );
      break;
    case "curriculum":
      content = curriculumAuthoring;
      break;
    case "activities":
      content = <DeferredLearningPage moduleId="activities" />;
      break;
    case "content-library":
      content = <><PageHeader moduleId="content-library" /><ContentLibraryPage /></>;
      break;
    case "composition":
      content = <><PageHeader moduleId="composition" /><CompositionPage /></>;
      break;
    case "people":
    case "learners":
    case "teachers":
    case "groups":
    case "enrolments":
      content = (
        <PeopleArea
          data={data}
          initialTab={routeContext.peopleTab}
          openPending={openPending}
          legacyHeading={heading}
          showEnrolments={moduleId === "enrolments"}
        />
      );
      break;
    case "assessment":
    case "assignments":
    case "results":
    case "attempts":
      content = (
        <AssessmentArea
          data={data}
          initialTab={routeContext.assessmentTab}
          openPending={openPending}
          legacyHeading={heading}
          onReviewResponse={reviewResponse}
          includeAttempts={moduleId === "attempts"}
        />
      );
      break;
    case "analytics":
      content = <AnalyticsPage data={data} />;
      break;
    case "system":
    case "monitoring":
    case "certification":
    case "configuration":
    case "audit":
      content = (
        <SystemArea
          data={data}
          initialTab={routeContext.systemTab}
          openPending={openPending}
          legacyHeading={heading}
        />
      );
      break;
    default:
      content = (
        <DashboardPage
          data={moduleCache.dashboard.data ?? sliceDemoModuleData(data, "dashboard")}
        />
      );
  }

  return (
    <>
      {moduleKey ? (
        <ModuleDataShell moduleKey={moduleKey}>{content}</ModuleDataShell>
      ) : (
        content
      )}
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
