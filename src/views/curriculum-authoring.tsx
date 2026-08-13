"use client";

import { useEffect, useMemo, useState } from "react";
import type { HubCourseLinkRecord, HubRecord } from "../api/admin-api";
import { ActivityComposer } from "../components/authoring/activity-composer";
import { DiagnosticsList } from "../components/authoring/diagnostics-list";
import { ImportPanel } from "../components/authoring/import-panel";
import { PreviewPane } from "../components/authoring/preview-pane";
import { SessionForm } from "../components/authoring/session-form";
import { WeekForm } from "../components/authoring/week-form";
import { StatusBadge } from "../components/status-badge";
import {
  createDraft,
  deleteDraft,
  duplicateDraft,
  loadDrafts,
  saveDraft,
  touchDraft,
} from "../content/draft-store";
import { downloadText, exportActivityPackage, exportDocument, exportPackage } from "../content/export";
import { syncCurriculumLists, upsertAssignment, upsertOutcome } from "../content/factories";
import type { AuthoringDraft, ContentActivity, ContentDocument, ContentPackage, DraftStatus } from "../content/types";
import { previewActivityHtml, previewWeekHtml, validatePackage } from "../content/validate";

type AuthoringTab = "curriculum" | "weeks" | "sessions" | "activities" | "imports" | "drafts";

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
}: {
  hubs: readonly HubRecord[];
  links: readonly HubCourseLinkRecord[];
}) {
  const defaultHub = hubs[0];
  const defaultLink = links.find((link) => link.hubCode === defaultHub?.hubCode) || links[0];
  const [tab, setTab] = useState<AuthoringTab>("curriculum");
  const [drafts, setDrafts] = useState<AuthoringDraft[]>([]);
  const [draft, setDraft] = useState<AuthoringDraft>(() => createDraft(
    defaultHub?.hubCode || "authoring-hub",
    defaultHub?.hubName || "Authoring hub",
    defaultLink?.courseKey || "course",
  ));
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadDrafts();
    /* eslint-disable react-hooks/set-state-in-effect -- restore local drafts after SSR hydration */
    setDrafts(stored);
    if (stored[0]) {
      setDraft(stored[0]);
      setSelectedActivityId(stored[0].package.activities[0]?.id || "");
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const pkg = draft.package;
  const validation = useMemo(() => validatePackage(pkg), [pkg]);
  const selectedActivity = pkg.activities.find((item) => item.id === selectedActivityId) || pkg.activities[0] || null;
  const previewHtml = selectedActivity
    ? previewActivityHtml(selectedActivity)
    : pkg.weeks[0]
      ? previewWeekHtml(pkg, pkg.weeks[0].id)
      : "<p>Create a week or activity to preview the learner renderer.</p>";

  function updatePackage(nextPkg: ContentPackage, status?: DraftStatus) {
    const next = touchDraft(draft, syncCurriculumLists(nextPkg), status);
    setDraft(next);
    if (hydrated) setDrafts(saveDraft(drafts, next));
  }

  function setHubContext(hubCode: string) {
    const hub = hubs.find((item) => item.hubCode === hubCode);
    const link = links.find((item) => item.hubCode === hubCode);
    const courseKey = link?.courseKey || draft.courseKey;
    updatePackage({
      ...pkg,
      hub: {
        ...pkg.hub,
        id: hubCode,
        metadata: { ...pkg.hub.metadata, name: hub?.hubName || hubCode },
      },
      curriculum: {
        ...pkg.curriculum,
        id: `${hubCode}-curriculum`,
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
  ];

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Curriculum administration</p>
          <h1>Curriculum authoring</h1>
          <p>Author the same canonical <code>lp.content.*</code> objects the learner hub renders. Drafts stay local. Publication is not available in this MVP.</p>
        </div>
        <StatusBadge label={draft.status.replaceAll("-", " ")} tone={draft.status === "invalid" ? "danger" : draft.status === "ready-for-review" ? "positive" : "warning"} />
      </header>

      <section className="panel">
        <div className="toolbar">
          <div>
            <label htmlFor="authoring-hub">Hub context</label>
            <select id="authoring-hub" value={pkg.hub.id} onChange={(event) => setHubContext(event.target.value)}>
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
            <p>Statuses are Draft, Valid, Invalid and Ready for Review. There is no Published state because this portal does not write curriculum to the backend.</p>
            <div className="toolbar">
              <button className="button button--primary" type="button" onClick={() => {
                const result = validatePackage(pkg);
                updatePackage(pkg, result.valid ? "valid" : "invalid");
              }}>Validate</button>
              <button className="button button--secondary" type="button" disabled={!validation.valid} onClick={() => updatePackage(pkg, "ready-for-review")}>Mark ready for review</button>
              <button className="button button--secondary" type="button" onClick={() => downloadText(`${pkg.hub.id}-package.json`, exportPackage(pkg))}>Export package</button>
              <button className="button button--secondary" type="button" disabled={!pkg.activities.length} onClick={() => downloadText(`${selectedActivity?.id || "activity"}.json`, exportActivityPackage(pkg, selectedActivity?.id))}>Export activity package</button>
            </div>
            <DiagnosticsList issues={validation.issues} />
          </section>
        ) : null}

        {tab === "weeks" ? (
          <>
            <WeekForm existingIds={pkg.weeks.map((item) => item.id)} onCreate={(week) => updatePackage(applyWeek(pkg, week))} />
            <section className="panel">
              <h2>Weeks</h2>
              {pkg.weeks.length ? (
                <ul className="authoring-list">
                  {pkg.weeks.map((week) => (
                    <li key={week.id}>
                      <strong>{String(week.metadata.title)}</strong>
                      <code>{week.id}</code>
                      <span>Week {String(week.metadata.teachingWeek)}</span>
                      <button className="button button--small button--secondary" type="button" onClick={() => downloadText(`${week.id}.json`, exportDocument(week))}>Export</button>
                    </li>
                  ))}
                </ul>
              ) : <p>No weeks in this draft.</p>}
            </section>
          </>
        ) : null}

        {tab === "sessions" ? (
          <>
            <SessionForm weeks={pkg.weeks} existingIds={pkg.sessions.map((item) => item.id)} onCreate={(session) => updatePackage(applySession(pkg, session))} />
            <section className="panel">
              <h2>Sessions</h2>
              {pkg.sessions.length ? (
                <ul className="authoring-list">
                  {pkg.sessions.map((session) => (
                    <li key={session.id}>
                      <strong>{String(session.metadata.title)}</strong>
                      <code>{session.id}</code>
                      <span>{String(session.metadata.kind)}</span>
                      <button className="button button--small button--secondary" type="button" onClick={() => downloadText(`${session.id}.json`, exportDocument(session))}>Export</button>
                    </li>
                  ))}
                </ul>
              ) : <p>No sessions in this draft.</p>}
            </section>
          </>
        ) : null}

        {tab === "activities" ? (
          <>
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
              activity={selectedActivity}
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
            />
          </>
        ) : null}

        {tab === "imports" ? <ImportPanel pkg={pkg} onImported={(next) => updatePackage(next)} /> : null}

        {tab === "drafts" ? (
          <section className="panel">
            <h2>Local drafts</h2>
            <p>These records are browser storage only. They are not backend curriculum.</p>
            <div className="toolbar">
              <button className="button button--primary" type="button" onClick={() => {
                const next = createDraft(pkg.hub.id, String(pkg.hub.metadata.name || pkg.hub.id), String(pkg.curriculum.metadata.course || "course"));
                setDraft(next);
                setDrafts(saveDraft(drafts, next));
              }}>New draft</button>
              <button className="button button--secondary" type="button" onClick={() => setDrafts(saveDraft(drafts, draft))}>Save draft</button>
            </div>
            {drafts.length ? (
              <ul className="authoring-list">
                {drafts.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <StatusBadge label={item.status.replaceAll("-", " ")} tone={item.status === "invalid" ? "danger" : "warning"} />
                    <button className="button button--small button--secondary" type="button" onClick={() => setDraft(item)}>Resume</button>
                    <button className="button button--small button--secondary" type="button" onClick={() => {
                      const copy = duplicateDraft(item);
                      setDraft(copy);
                      setDrafts(saveDraft(drafts, copy));
                    }}>Duplicate</button>
                    <button className="button button--small button--secondary" type="button" onClick={() => downloadText(`${item.id}.json`, exportPackage(item.package))}>Export</button>
                    <button className="button button--small button--secondary" type="button" onClick={() => setDrafts(deleteDraft(drafts, item.id))}>Delete</button>
                  </li>
                ))}
              </ul>
            ) : <p>No saved drafts yet.</p>}
          </section>
        ) : null}
      </div>

      <PreviewPane title="Preview" html={previewHtml} />
    </>
  );
}
