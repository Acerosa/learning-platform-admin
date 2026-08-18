"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CurriculumPublicationRecord, HubCourseLinkRecord, HubRecord } from "../api/admin-api";
import { ActivityComposer } from "../components/authoring/activity-composer";
import { ArchivePanel } from "../components/authoring/archive-panel";
import { ComparePanel } from "../components/authoring/compare-panel";
import { DiagnosticsList } from "../components/authoring/diagnostics-list";
import { HistoryPanel } from "../components/authoring/history-panel";
import { ImportPanel } from "../components/authoring/import-panel";
import { LifecycleBanner, lifecycleTone } from "../components/authoring/lifecycle-banner";
import { PreviewPane } from "../components/authoring/preview-pane";
import { PublicationPanel } from "../components/authoring/publication-panel";
import { ReviewPanel } from "../components/authoring/review-panel";
import { AuthoringAreaLinks } from "../components/authoring-area-links";
import { SessionForm } from "../components/authoring/session-form";
import { VersionsPanel } from "../components/authoring/versions-panel";
import { WeekForm } from "../components/authoring/week-form";
import { StatusBadge } from "../components/status-badge";
import { duplicateIndependentActivity, insertActivityVariant } from "../content/activity-variants";
import { DRAFT_AUTOSAVE_MS, createSequenceGate } from "../content/async-authoring";
import {
  createDraft,
  deleteDraft,
  duplicateDraft,
  loadDrafts,
  persistDrafts,
  saveDraft,
  touchDraft,
} from "../content/draft-store";
import { downloadText, exportActivityPackage, exportDocument, exportPackage } from "../content/export";
import { syncCurriculumLists, upsertAssignment, upsertOutcome } from "../content/factories";
import { isEditableStatus, LIFECYCLE_LABELS } from "../content/lifecycle";
import { publicationGate } from "../content/publication-gate";
import type { AuthoringDraft, ContentActivity, ContentDocument, ContentPackage } from "../content/types";
import { previewActivityHtml, previewWeekHtml, validatePackage } from "../content/validate";
import {
  approveRecord,
  archiveVersion,
  createWorkingCopy,
  createWorkingCopyFromPackage,
  mergeRemoteAuthoringDrafts,
  replaceRecord,
  restoreAsDraft,
  returnToDraft,
  startReview,
  submitForReview,
  suggestNextVersion,
  updateReviewMetadata,
  publishVersion,
  withPlatformPublication,
} from "../content/versioning";

type AuthoringTab =
  | "curriculum"
  | "weeks"
  | "sessions"
  | "activities"
  | "imports"
  | "drafts"
  | "versions"
  | "review"
  | "publication"
  | "history"
  | "compare"
  | "archive";

function applyWeek(pkg: ContentPackage, week: ContentDocument) {
  let next = { ...pkg, weeks: [...pkg.weeks.filter((item) => item.id !== week.id), week] };
  const rel = week.relationships;
  (Array.isArray(rel.learningOutcomes) ? rel.learningOutcomes : []).forEach((id) => {
    next = upsertOutcome(next, String(id));
  });
  if (rel.assignment) next = upsertAssignment(next, String(rel.assignment));
  const sessions = Array.isArray(rel.sessions) ? rel.sessions as string[] : [];
  next = {
    ...next,
    sessions: next.sessions.map((session) => (
      sessions.includes(session.id)
        ? { ...session, relationships: { ...session.relationships, week: week.id } }
        : session
    )),
  };
  return syncCurriculumLists(next);
}

function applySession(pkg: ContentPackage, session: ContentDocument) {
  let next = { ...pkg, sessions: [...pkg.sessions.filter((item) => item.id !== session.id), session] };
  const weekId = String(session.relationships.week || "");
  if (weekId) {
    next = {
      ...next,
      weeks: next.weeks.map((week) => {
        if (week.id !== weekId) return week;
        const sessions = Array.isArray(week.relationships.sessions) ? [...week.relationships.sessions as string[]] : [];
        if (!sessions.includes(session.id)) sessions.push(session.id);
        return { ...week, relationships: { ...week.relationships, sessions } };
      }),
    };
  }
  return syncCurriculumLists(next);
}

export function CurriculumAuthoringPage({
  hubs,
  links,
  actor = "local-author",
  publications = [],
  platformAvailable = false,
  onPublishToPlatform,
  onSaveDraft,
  onLoadPublishedPackage,
  onLoadRemoteDrafts,
}: {
  hubs: readonly HubRecord[];
  links: readonly HubCourseLinkRecord[];
  actor?: string;
  publications?: readonly CurriculumPublicationRecord[];
  platformAvailable?: boolean;
  onPublishToPlatform?: (record: AuthoringDraft) => Promise<{ id: string; publishedAt: string; idempotent: boolean }>;
  onSaveDraft?: (record: AuthoringDraft) => Promise<{ revision: number }>;
  onLoadPublishedPackage?: (hubCode: string, courseKey: string) => Promise<{ package: ContentPackage; packageVersion: string }>;
  onLoadRemoteDrafts?: () => Promise<AuthoringDraft[]>;
}) {
  const defaultHub = hubs[0];
  const defaultLink = links.find((link) => link.hubCode === defaultHub?.hubCode) || links[0];
  const [tab, setTab] = useState<AuthoringTab>("curriculum");
  const [drafts, setDrafts] = useState<AuthoringDraft[]>([]);
  const [draft, setDraft] = useState<AuthoringDraft>(() => createDraft(
    defaultHub?.hubCode || "authoring-hub",
    defaultHub?.hubName || "Authoring hub",
    defaultLink?.courseKey || "course",
    actor,
  ));
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [previewWeekId, setPreviewWeekId] = useState("");
  const [previewMode, setPreviewMode] = useState<"week" | "activity">("week");
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [publishVersionValue, setPublishVersionValue] = useState("0.1.0");
  const [publishNotes, setPublishNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved" | "failed" | "offline">("idle");
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "loaded" | "empty" | "error">("idle");
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [remoteDraftStatus, setRemoteDraftStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const saveGate = useRef(createSequenceGate());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  const remoteLoaded = useRef(false);

  useEffect(() => {
    const stored = loadDrafts();
    /* eslint-disable react-hooks/set-state-in-effect -- restore local drafts after SSR hydration */
    setDrafts(stored);
    if (stored[0]) {
      setDraft(stored[0]);
      setSelectedActivityId(stored[0].package.activities[0]?.id || "");
      setPreviewId(stored[0].id);
      setCompareLeft(stored[0].id);
      setCompareRight(stored[1]?.id || stored[0].id);
      setPublishVersionValue(suggestNextVersion(stored, stored[0].hubId, stored[0].courseKey));
      setPublishNotes(stored[0].publicationNotes);
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated || remoteLoaded.current || !platformAvailable || !onLoadRemoteDrafts) return;
    remoteLoaded.current = true;
    setRemoteDraftStatus("loading");
    void onLoadRemoteDrafts()
      .then((remotes) => {
        const stored = loadDrafts();
        const merged = mergeRemoteAuthoringDrafts(stored, remotes);
        persistDrafts(merged);
        setDrafts(merged);
        const preferred = remotes.find((item) => item.hubId === (defaultHub?.hubCode || stored[0]?.hubId))
          || remotes[0]
          || merged[0];
        if (preferred) {
          setDraft(preferred);
          setSelectedActivityId(preferred.package.activities[0]?.id || "");
          setPreviewId(preferred.id);
          setCompareLeft(preferred.id);
          setCompareRight(merged.find((item) => item.id !== preferred.id)?.id || preferred.id);
          setPublishVersionValue(suggestNextVersion(merged, preferred.hubId, preferred.courseKey));
          setPublishNotes(preferred.publicationNotes);
        }
        setRemoteDraftStatus("loaded");
      })
      .catch((error) => {
        setRemoteDraftStatus("error");
        setMessage(error instanceof Error ? error.message : "Remote curriculum drafts could not be loaded.");
      });
  }, [defaultHub?.hubCode, hydrated, onLoadRemoteDrafts, platformAvailable]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (saveStatus === "unsaved" || saveStatus === "saving" || saveStatus === "failed") {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveStatus]);

  const pkg = draft.package;
  const editable = isEditableStatus(draft.status);
  const validation = useMemo(() => validatePackage(pkg), [pkg]);
  const gate = useMemo(() => publicationGate(pkg, draft.sourcePackageVersion), [pkg, draft.sourcePackageVersion]);
  const previewRecord = drafts.find((item) => item.id === previewId) || draft;
  const selectedActivity = previewRecord.package.activities.find((item) => item.id === selectedActivityId)
    || previewRecord.package.activities[0]
    || null;
  const weekForPreview = previewRecord.package.weeks.find((week) => week.id === previewWeekId)
    || previewRecord.package.weeks.find((week) => Array.isArray(week.relationships.sessions) && week.relationships.sessions.length)
    || previewRecord.package.weeks[0]
    || null;
  const previewHtml = previewMode === "activity" && selectedActivity
    ? previewActivityHtml(selectedActivity)
    : weekForPreview
      ? previewWeekHtml(previewRecord.package, weekForPreview.id)
      : selectedActivity
        ? previewActivityHtml(selectedActivity)
        : "<p>Create a week or activity to preview the learner renderer.</p>";

  function showError(error: unknown) {
    setMessage(error instanceof Error ? error.message : "The requested publication action could not be completed.");
  }

  async function openPublished() {
    if (!onLoadPublishedPackage) {
      setLoadStatus("error");
      setMessage("Opening published content requires a live administrator session.");
      return;
    }
    setLoadStatus("loading");
    try {
      const published = await onLoadPublishedPackage(pkg.hub.id, String(pkg.curriculum.metadata.course || draft.courseKey));
      const working = createWorkingCopyFromPackage(published.package, actor, published.packageVersion);
      commit(working, saveDraft(drafts, working), false);
      setSaveStatus("saved");
      setLoadStatus("loaded");
      setSelectedActivityId(working.package.activities[0]?.id || "");
      setTab("activities");
    } catch (error) {
      setLoadStatus("error");
      showError(error);
    }
  }

  function commit(nextDraft: AuthoringDraft, nextRecords = saveDraft(drafts, nextDraft), markUnsaved = true) {
    setDraft(nextDraft);
    setDrafts(nextRecords);
    setPreviewId(nextDraft.id);
    setMessage("");
    if (markUnsaved && hydrated && isEditableStatus(nextDraft.status)) {
      setSaveStatus("unsaved");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persistRemote(nextDraft);
      }, DRAFT_AUTOSAVE_MS);
    }
    return nextRecords;
  }

  async function persistRemote(nextDraft: AuthoringDraft, explicit = false) {
    if (!onSaveDraft || !platformAvailable || !isEditableStatus(nextDraft.status)) {
      setSaveStatus("saved");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setSaveStatus("offline");
      return;
    }
    const requestId = saveGate.current.next();
    setSaveStatus("saving");
    try {
      const result = await onSaveDraft(nextDraft);
      if (!saveGate.current.isCurrent(requestId)) return;
      const latest = draftRef.current.id === nextDraft.id
        ? { ...draftRef.current, remoteRevision: result.revision }
        : { ...nextDraft, remoteRevision: result.revision };
      setDraft(latest);
      setDrafts(saveDraft(drafts, latest));
      setSaveStatus("saved");
    } catch (error) {
      if (!saveGate.current.isCurrent(requestId) && !explicit) return;
      setSaveStatus("failed");
      const conflict = error instanceof Error && /saved elsewhere|DRAFT_REVISION_CONFLICT/i.test(error.message);
      if (explicit || conflict) showError(error);
    }
  }

  function updatePackage(nextPkg: ContentPackage) {
    try {
      const next = touchDraft(draft, syncCurriculumLists(nextPkg));
      if (hydrated) commit(next);
      else setDraft(next);
    } catch (error) {
      showError(error);
    }
  }

  function applyRecord(next: AuthoringDraft) {
    try {
      if (hydrated) commit(next);
      else setDraft(next);
    } catch (error) {
      showError(error);
    }
  }

  function setHubContext(hubCode: string) {
    const hub = hubs.find((item) => item.hubCode === hubCode);
    const link = links.find((item) => item.hubCode === hubCode);
    const courseKey = link?.courseKey || draft.courseKey;
    const curriculumId = `${hubCode}-curriculum`;
    updatePackage({
      ...pkg,
      hub: {
        ...pkg.hub,
        id: hubCode,
        metadata: { ...pkg.hub.metadata, name: hub?.hubName || hubCode },
        relationships: { ...pkg.hub.relationships, curriculum: curriculumId },
      },
      curriculum: {
        ...pkg.curriculum,
        id: curriculumId,
        metadata: { ...pkg.curriculum.metadata, course: courseKey, title: `${hub?.hubName || hubCode} curriculum` },
        relationships: { ...pkg.curriculum.relationships },
      },
    });
  }

  const tabs: { id: AuthoringTab; label: string }[] = [
    { id: "curriculum", label: "Curriculum" },
    { id: "weeks", label: "Weeks" },
    { id: "sessions", label: "Sessions" },
    { id: "activities", label: "Activities" },
    { id: "imports", label: "Imports" },
    { id: "drafts", label: "Drafts" },
    { id: "versions", label: "Versions" },
    { id: "review", label: "Review" },
    { id: "publication", label: "Publication" },
    { id: "history", label: "History" },
    { id: "compare", label: "Compare" },
    { id: "archive", label: "Archive" },
  ];

  const compareRecords = drafts.length ? drafts : [draft];

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Edit and publish a hub curriculum</p>
          <h1>Curriculum authoring</h1>
          <p>Choose a hub and course, open published content as a draft, then validate, review, approve and publish to the platform. Reusable masters live in Content Library. Assembling those masters into a draft happens in Composition.</p>
        </div>
        <StatusBadge label={LIFECYCLE_LABELS[draft.status]} tone={lifecycleTone(draft.status)} />
      </header>

      <AuthoringAreaLinks current="curriculum" />
      <LifecycleBanner record={draft} />
      <p role="status">Draft save: {saveStatus === "idle" ? "Saved" : saveStatus === "unsaved" ? "Unsaved changes" : saveStatus === "saving" ? "Saving..." : saveStatus === "failed" ? "Save failed" : saveStatus === "offline" ? "Offline — changes not yet saved" : "Saved"}</p>
      {remoteDraftStatus === "loading" ? <p role="status">Loading remote curriculum draft...</p> : null}
      {loadStatus === "loading" ? <p role="status">Loading published curriculum...</p> : null}
      {loadStatus === "error" ? <p className="authoring-alert" role="alert">Published curriculum could not be loaded. <button type="button" className="button button--small button--secondary" onClick={() => void openPublished()}>Retry</button></p> : null}
      {remoteDraftStatus === "error" ? <p className="authoring-alert" role="alert">Remote drafts could not be reopened. LocalStorage remains available as a fallback, but the hosted draft is authoritative.</p> : null}
      {message ? <p className="authoring-alert" role="alert">{message}</p> : null}

      <section className="panel">
        <div className="toolbar">
          <div>
            <label htmlFor="authoring-hub">Hub context</label>
            <select id="authoring-hub" value={pkg.hub.id} disabled={!editable} onChange={(event) => setHubContext(event.target.value)}>
              {(hubs.length ? hubs : [{ hubCode: pkg.hub.id, hubName: String(pkg.hub.metadata.name || pkg.hub.id) } as HubRecord]).map((hub) => (
                <option key={hub.hubCode} value={hub.hubCode}>{hub.hubName}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="authoring-course">Course</label>
            <select
              id="authoring-course"
              value={String(pkg.curriculum.metadata.course || "")}
              disabled={!editable}
              onChange={(event) => updatePackage({
                ...pkg,
                curriculum: { ...pkg.curriculum, metadata: { ...pkg.curriculum.metadata, course: event.target.value } },
              })}
            >
              {links.filter((link) => link.hubCode === pkg.hub.id).map((link) => (
                <option key={link.courseKey} value={link.courseKey}>{link.courseTitle}</option>
              ))}
              {!links.some((link) => link.hubCode === pkg.hub.id) ? <option value={String(pkg.curriculum.metadata.course || "course")}>{String(pkg.curriculum.metadata.course || "course")}</option> : null}
            </select>
          </div>
          <span className="toolbar__count" role="status">{pkg.weeks.length} weeks · {pkg.sessions.length} sessions · {pkg.activities.length} activities</span>
        </div>
      </section>

      <div className="authoring-tabs" role="tablist" aria-label="Authoring views">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            id={`authoring-tab-${item.id}`}
            aria-controls={`authoring-panel-${item.id}`}
            className={tab === item.id ? "is-active" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div id={`authoring-panel-${tab}`} role="tabpanel" aria-labelledby={`authoring-tab-${tab}`}>
        {tab === "curriculum" ? (
          <section className="panel">
            <h2>Draft workspace</h2>
            <p>This workspace edits and publishes a specific hub/course curriculum. Learners consume published content only. Lifecycle: Draft, Ready for Review, In Review, Approved, Published, Superseded, Archived. Validation is a gate, not a status. Local Publish stays in this browser; Publish to Platform sends an approved snapshot to the backend catalogue.</p>
            <div className="toolbar">
              <button className="button button--primary" type="button" onClick={() => {
                const result = validatePackage(pkg);
                setMessage(result.valid ? "Validation succeeded." : "Validation failed. Publication remains blocked.");
              }}>Validate</button>
              <button className="button button--secondary" type="button" disabled={!editable} onClick={() => {
                try {
                  applyRecord(submitForReview(draft));
                } catch (error) {
                  showError(error);
                }
              }}>Mark ready for review</button>
              <button className="button button--secondary" type="button" onClick={() => downloadText(`${pkg.hub.id}-package.json`, exportPackage(pkg))}>Export package</button>
              <button className="button button--secondary" type="button" disabled={!editable} onClick={() => void persistRemote(draft, true)}>Save draft</button>
              <button className="button button--secondary" type="button" disabled={!platformAvailable} onClick={() => void openPublished()}>Open published content</button>
              <button className="button button--secondary" type="button" disabled={!pkg.activities.length} onClick={() => downloadText(`${selectedActivity?.id || "activity"}.json`, exportActivityPackage(pkg, selectedActivity?.id))}>Export activity package</button>
            </div>
            <DiagnosticsList issues={validation.issues} />
          </section>
        ) : null}

        {tab === "weeks" ? (
          <fieldset className="authoring-fieldset" disabled={!editable}>
            <legend className="sr-only">Week editors</legend>
            <WeekForm
              key={editingWeekId || "create-week"}
              existingIds={pkg.weeks.map((item) => item.id)}
              existing={pkg.weeks.find((item) => item.id === editingWeekId) || null}
              onCreate={(week) => {
                updatePackage(applyWeek(pkg, week));
                setEditingWeekId(null);
              }}
            />
            {editingWeekId ? (
              <p>
                <button className="button button--small button--secondary" type="button" onClick={() => setEditingWeekId(null)}>Cancel week edit</button>
              </p>
            ) : null}
            <section className="panel">
              <h2>Weeks</h2>
              {pkg.weeks.length ? (
                <ul className="authoring-list">
                  {pkg.weeks.map((week) => (
                    <li key={week.id}>
                      <strong>{String(week.metadata.title)}</strong>
                      <code>{week.id}</code>
                      <span>Week {String(week.metadata.teachingWeek)}</span>
                      <button className="button button--small button--secondary" type="button" onClick={() => setEditingWeekId(week.id)}>Edit</button>
                      <button className="button button--small button--secondary" type="button" onClick={() => downloadText(`${week.id}.json`, exportDocument(week))}>Export</button>
                    </li>
                  ))}
                </ul>
              ) : <p>No weeks in this draft.</p>}
            </section>
          </fieldset>
        ) : null}

        {tab === "sessions" ? (
          <fieldset className="authoring-fieldset" disabled={!editable}>
            <legend className="sr-only">Session editors</legend>
            <SessionForm
              key={editingSessionId || "create-session"}
              weeks={pkg.weeks}
              existingIds={pkg.sessions.map((item) => item.id)}
              existing={pkg.sessions.find((item) => item.id === editingSessionId) || null}
              onCreate={(session) => {
                updatePackage(applySession(pkg, session));
                setEditingSessionId(null);
              }}
            />
            {editingSessionId ? (
              <p>
                <button className="button button--small button--secondary" type="button" onClick={() => setEditingSessionId(null)}>Cancel session edit</button>
              </p>
            ) : null}
            <section className="panel">
              <h2>Sessions</h2>
              {pkg.sessions.length ? (
                <ul className="authoring-list">
                  {pkg.sessions.map((session) => (
                    <li key={session.id}>
                      <strong>{String(session.metadata.title)}</strong>
                      <code>{session.id}</code>
                      <span>{String(session.metadata.kind)}</span>
                      <button className="button button--small button--secondary" type="button" onClick={() => setEditingSessionId(session.id)}>Edit</button>
                      <button className="button button--small button--secondary" type="button" onClick={() => downloadText(`${session.id}.json`, exportDocument(session))}>Export</button>
                    </li>
                  ))}
                </ul>
              ) : <p>No sessions in this draft.</p>}
            </section>
          </fieldset>
        ) : null}

        {tab === "activities" ? (
          <fieldset className="authoring-fieldset" disabled={!editable}>
            <legend className="sr-only">Activity editors</legend>
            {pkg.activities.length ? (
              <div className="toolbar">
                <div>
                  <label htmlFor="selected-activity">Editing activity</label>
                  <select id="selected-activity" value={selectedActivity?.id || ""} onChange={(event) => setSelectedActivityId(event.target.value)}>
                    {pkg.activities.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
                  </select>
                </div>
              </div>
            ) : null}
            <ActivityComposer
              existingIds={pkg.activities.map((item) => item.id)}
              activity={pkg.activities.find((item) => item.id === selectedActivityId) || pkg.activities[0] || null}
              onCreate={(activity) => {
                updatePackage({ ...pkg, activities: [...pkg.activities, activity] });
                setSelectedActivityId(activity.id);
              }}
              onChange={(activity: ContentActivity) => {
                updatePackage({
                  ...pkg,
                  activities: pkg.activities.map((item) => item.id === activity.id ? activity : item),
                });
              }}
              onDuplicate={() => {
                try {
                  const sourceId = selectedActivity?.id || pkg.activities[0]?.id;
                  if (!sourceId) return;
                  const next = duplicateIndependentActivity(pkg, sourceId);
                  updatePackage(next);
                  setSelectedActivityId(next.activities.at(-1)?.id || sourceId);
                } catch (error) {
                  showError(error);
                }
              }}
              onCreateVariant={(difficulty) => {
                try {
                  const sourceId = selectedActivity?.id || pkg.activities[0]?.id;
                  if (!sourceId) return;
                  const next = insertActivityVariant(pkg, sourceId, difficulty);
                  updatePackage(next);
                  setSelectedActivityId(next.activities.at(-1)?.id || sourceId);
                } catch (error) {
                  showError(error);
                }
              }}
            />
          </fieldset>
        ) : null}

        {tab === "imports" ? (
          <fieldset className="authoring-fieldset" disabled={!editable}>
            <legend className="sr-only">Import tools</legend>
            <ImportPanel pkg={pkg} onImported={(next) => updatePackage(next)} />
          </fieldset>
        ) : null}

        {tab === "drafts" ? (
          <section className="panel">
            <h2>Local and platform drafts</h2>
            <p>Browser copies remain available offline. Live mode also autosaves drafts to Supabase. Learners never see drafts.</p>
            <div className="toolbar">
              <button className="button button--primary" type="button" onClick={() => {
                const next = createDraft(pkg.hub.id, String(pkg.hub.metadata.name || pkg.hub.id), String(pkg.curriculum.metadata.course || "course"), actor);
                commit(next);
              }}>New draft</button>
              <button className="button button--primary" type="button" onClick={() => commit(draft)}>Save draft locally</button>
            </div>
            {drafts.length ? (
              <ul className="authoring-list">
                {drafts.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <StatusBadge label={LIFECYCLE_LABELS[item.status]} tone={lifecycleTone(item.status)} />
                    <button className="button button--small button--secondary" type="button" onClick={() => {
                      setDraft(item);
                      setPreviewId(item.id);
                      setPublishVersionValue(suggestNextVersion(drafts, item.hubId, item.courseKey));
                      setPublishNotes(item.publicationNotes);
                    }}>Resume</button>
                    <button className="button button--small button--secondary" type="button" onClick={() => {
                      const copy = duplicateDraft(item);
                      commit(copy);
                    }}>Duplicate</button>
                    <button className="button button--small button--secondary" type="button" onClick={() => downloadText(`${item.id}.json`, exportPackage(item.package))}>Export</button>
                    <button className="button button--small button--secondary" type="button" onClick={() => {
                      const remaining = deleteDraft(drafts, item.id);
                      setDrafts(remaining);
                      if (item.id === draft.id && remaining[0]) setDraft(remaining[0]);
                    }}>Delete</button>
                  </li>
                ))}
              </ul>
            ) : <p>No saved drafts yet.</p>}
          </section>
        ) : null}

        {tab === "versions" ? (
          <VersionsPanel
            records={compareRecords}
            current={draft}
            onSelect={(item) => {
              setDraft(item);
              setPreviewId(item.id);
              setTab("curriculum");
            }}
            onWorkingCopy={(published) => {
              try {
                const copy = createWorkingCopy(published, actor);
                commit(copy);
                setTab("curriculum");
              } catch (error) {
                showError(error);
              }
            }}
          />
        ) : null}

        {tab === "review" ? (
          <ReviewPanel
            record={draft}
            actor={actor}
            onAuthorChange={(value) => applyRecord(updateReviewMetadata(draft, { author: value }))}
            onReviewerChange={(value) => applyRecord(updateReviewMetadata(draft, { reviewer: value }))}
            onApprovalNotes={(value) => applyRecord(updateReviewMetadata(draft, { approvalNotes: value }))}
            onStartReview={() => {
              try {
                applyRecord(startReview(draft, draft.reviewer || actor));
              } catch (error) {
                showError(error);
              }
            }}
            onApprove={() => {
              try {
                applyRecord(approveRecord(draft, draft.approvalNotes, draft.reviewer || actor));
              } catch (error) {
                showError(error);
              }
            }}
            onReturnToDraft={() => {
              try {
                applyRecord(returnToDraft(draft));
              } catch (error) {
                showError(error);
              }
            }}
          />
        ) : null}

        {tab === "publication" ? (
          <PublicationPanel
            record={draft}
            version={publishVersionValue}
            notes={publishNotes}
            gateOk={gate.ok}
            issues={gate.issues}
            suggestedVersion={suggestNextVersion(compareRecords, draft.hubId, draft.courseKey)}
            onVersionChange={setPublishVersionValue}
            onNotesChange={setPublishNotes}
            onPublish={() => {
              try {
                const nextRecords = publishVersion(compareRecords, draft, {
                  version: publishVersionValue || suggestNextVersion(compareRecords, draft.hubId, draft.courseKey),
                  publishedBy: actor,
                  notes: publishNotes,
                });
                persistDrafts(nextRecords);
                const published = nextRecords.find((item) => item.id === draft.id);
                setDrafts(nextRecords);
                if (published) {
                  setDraft(published);
                  setPreviewId(published.id);
                }
                setMessage("Published locally. Use Publish to Platform to send this snapshot to the backend.");
              } catch (error) {
                showError(error);
              }
            }}
            publications={publications}
            platformAvailable={platformAvailable}
            onPublishToPlatform={() => {
              void (async () => {
                if (!onPublishToPlatform) {
                  setMessage("Platform publication requires a live administrator session.");
                  return;
                }
                const publishing = withPlatformPublication(draft, { platformPublicationState: "publishing" });
                commit(publishing);
                try {
                  const result = await onPublishToPlatform(publishing);
                  commit(withPlatformPublication(publishing, {
                    platformPublicationState: "published",
                    platformPublicationError: null,
                    platformPublishedAt: result.publishedAt,
                    platformPublicationId: result.id,
                  }));
                  setMessage(
                    result.idempotent
                      ? "This snapshot is already the active platform publication."
                      : "Published to the platform. Learner hubs load this version from Supabase without a GitHub deployment.",
                  );
                } catch (error) {
                  commit(withPlatformPublication(publishing, {
                    platformPublicationState: "failed",
                    platformPublicationError: error instanceof Error
                      ? error.message
                      : "Curriculum could not be published to the platform.",
                  }));
                  showError(error);
                }
              })();
            }}
          />
        ) : null}

        {tab === "history" ? (
          <HistoryPanel
            records={compareRecords}
            current={draft}
            onView={(item) => {
              setDraft(item);
              setPreviewId(item.id);
            }}
            onCompare={(item) => {
              setCompareLeft(draft.id);
              setCompareRight(item.id);
              setTab("compare");
            }}
            onRestore={(item) => {
              const restored = restoreAsDraft(item, actor);
              commit(restored);
              setTab("curriculum");
            }}
          />
        ) : null}

        {tab === "compare" ? (
          <ComparePanel
            records={compareRecords}
            leftId={compareLeft || compareRecords[0]?.id || ""}
            rightId={compareRight || compareRecords[1]?.id || compareRecords[0]?.id || ""}
            onLeftChange={setCompareLeft}
            onRightChange={setCompareRight}
          />
        ) : null}

        {tab === "archive" ? (
          <ArchivePanel
            records={compareRecords}
            current={draft}
            onArchive={(item) => {
              try {
                const archived = archiveVersion(item);
                const next = replaceRecord(compareRecords, archived);
                persistDrafts(next);
                setDrafts(next);
                if (item.id === draft.id) setDraft(archived);
              } catch (error) {
                showError(error);
              }
            }}
          />
        ) : null}
      </div>

      <div className="toolbar">
        <div>
          <label htmlFor="preview-version">Preview version</label>
          <select id="preview-version" value={previewRecord.id} onChange={(event) => setPreviewId(event.target.value)}>
            {(compareRecords).map((item) => (
              <option key={item.id} value={item.id}>
                {item.version || "working copy"} · {LIFECYCLE_LABELS[item.status]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="preview-mode">Preview</label>
          <select id="preview-mode" value={previewMode} onChange={(event) => setPreviewMode(event.target.value as "week" | "activity")}>
            <option value="week">Week</option>
            <option value="activity">Activity</option>
          </select>
        </div>
        {previewMode === "week" ? (
          <div>
            <label htmlFor="preview-week">Week</label>
            <select
              id="preview-week"
              value={weekForPreview?.id || ""}
              onChange={(event) => setPreviewWeekId(event.target.value)}
            >
              {previewRecord.package.weeks.map((week) => (
                <option key={week.id} value={week.id}>{String(week.metadata.title || week.id)}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="preview-activity">Activity</label>
            <select
              id="preview-activity"
              value={selectedActivity?.id || ""}
              onChange={(event) => setSelectedActivityId(event.target.value)}
            >
              {previewRecord.package.activities.map((activity) => (
                <option key={activity.id} value={activity.id}>{activity.id}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <PreviewPane title="Preview" html={previewHtml} />
    </>
  );
}
