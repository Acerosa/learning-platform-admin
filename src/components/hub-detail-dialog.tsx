"use client";

import { useEffect, useRef } from "react";
import type { AuditEventRecord, HubCourseLinkRecord, HubRecord } from "../api/admin-api";
import type { HubHealthReport } from "../content/hub-health";
import type { HubPublicationStatus } from "../content/hub-publication";
import { formatDate } from "../utils/format";
import { AdminLink } from "./admin-link";
import { StatusBadge, type BadgeTone } from "./status-badge";

function toneForHealth(status: HubHealthReport["status"]): BadgeTone {
  if (status === "pass") return "positive";
  if (status === "warn") return "warning";
  if (status === "fail") return "danger";
  return "info";
}

function toneForCheck(status: HubHealthReport["status"]): BadgeTone {
  return toneForHealth(status);
}

export function HubDetailDialog({
  hub,
  courseLinks,
  publication,
  health,
  history,
  actionError,
  onClose,
  onEdit,
  onToggleActive,
}: {
  hub: HubRecord | null;
  courseLinks: readonly HubCourseLinkRecord[];
  publication: HubPublicationStatus | null;
  health: HubHealthReport | null;
  history: readonly AuditEventRecord[];
  actionError: string | null;
  onClose: () => void;
  onEdit: (hub: HubRecord) => void;
  onToggleActive: (hub: HubRecord) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (hub && dialog && !dialog.open) dialog.showModal();
    if (!hub && dialog?.open) dialog.close();
  }, [hub]);

  if (!hub) return null;

  return (
    <dialog
      className="admin-dialog admin-dialog--wide"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      aria-labelledby="hub-detail-title"
    >
      <div className="admin-dialog__header">
        <div>
          <p className="eyebrow">Hub registry record</p>
          <h2 id="hub-detail-title">{hub.hubName}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close hub details">×</button>
      </div>
      <div className="admin-dialog__body">
        <div className="detail-heading">
          <StatusBadge label={hub.status} tone="info" />
          <StatusBadge label={hub.certificationState ?? "certification not recorded"} tone={hub.certificationState === "certified" ? "positive" : "neutral"} />
          <StatusBadge label={hub.active ? "active" : "inactive"} tone={hub.active ? "positive" : "neutral"} />
          {health ? <StatusBadge label={health.summary} tone={toneForHealth(health.status)} /> : null}
        </div>
        {actionError ? <div className="notice-card notice-card--warning" role="alert"><strong>Hub update failed</strong><p>{actionError}</p></div> : null}
        <dl className="detail-grid">
          <div><dt>Hub code</dt><dd><code>{hub.hubCode}</code></dd></div>
          <div><dt>Subject</dt><dd>{hub.subject ?? "Not registered"}</dd></div>
          <div><dt>Hub version</dt><dd>{hub.hubVersion}</dd></div>
          <div><dt>Manifest contract</dt><dd>{hub.manifestVersion}</dd></div>
          <div><dt>Core requirement</dt><dd>{hub.coreVersion}</dd></div>
          <div><dt>Learner API</dt><dd>{hub.learnerApiVersion}</dd></div>
          <div><dt>Submission contract</dt><dd>{hub.submissionContractVersion}</dd></div>
          <div><dt>Legacy platform version</dt><dd>{hub.platformVersion}</dd></div>
          <div className="detail-grid__wide"><dt>Description</dt><dd>{hub.description}</dd></div>
          <div className="detail-grid__wide"><dt>Curriculum model</dt><dd>{hub.curriculumModel?.replaceAll("/", " → ") ?? "Not registered"}</dd></div>
          <div><dt>Repository</dt><dd><a href={hub.repositoryUrl} target="_blank" rel="noreferrer">Open repository</a></dd></div>
          <div><dt>Deployment</dt><dd>{hub.deploymentUrl ? <a href={hub.deploymentUrl} target="_blank" rel="noreferrer">Open hub</a> : "Not registered"}</dd></div>
        </dl>
        <section className="dialog-section" aria-labelledby="hub-courses-title">
          <h3 id="hub-courses-title">Linked courses</h3>
          {courseLinks.length ? <div className="tag-list">{courseLinks.map((link) => <span className="tag" key={link.courseKey}>{link.courseTitle} · {link.active ? "active" : "inactive"}</span>)}</div> : <p>No course links are registered.</p>}
        </section>
        {publication ? (
          <section className="dialog-section" aria-labelledby="hub-publication-title">
            <h3 id="hub-publication-title">Linked curriculum</h3>
            <p>Publication status comes from local authoring and the existing platform catalogue. This view does not publish.</p>
            <dl className="detail-grid">
              <div><dt>Current status</dt><dd><StatusBadge label={publication.displayLabel} tone={publication.displayStatus === "published" ? "positive" : publication.displayStatus === "none" ? "neutral" : "info"} /></dd></div>
              <div><dt>Local authoring</dt><dd>{publication.localLabel}{publication.localVersion ? ` · ${publication.localVersion}` : ""}</dd></div>
              <div><dt>Platform catalogue</dt><dd>{publication.catalogueLabel}</dd></div>
              <div><dt>Package version</dt><dd>{publication.packageVersion ?? "None"}</dd></div>
              <div><dt>Schema version</dt><dd>{publication.schemaVersion ?? "None"}</dd></div>
              <div><dt>Linked course</dt><dd>{publication.courseKey ?? "None"}</dd></div>
            </dl>
          </section>
        ) : null}
        {health ? (
          <section className="dialog-section" aria-labelledby="hub-health-title">
            <h3 id="hub-health-title">Hub health</h3>
            <p>Informational compatibility against the current registry, catalogue and platform contracts.</p>
            <ul className="contract-list">
              {health.checks.map((check) => (
                <li key={check.id}>
                  <span>
                    <strong>{check.label}</strong>
                    <small>{check.detail}</small>
                  </span>
                  <StatusBadge label={check.status} tone={toneForCheck(check.status)} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="dialog-section" aria-labelledby="hub-capabilities-title">
          <h3 id="hub-capabilities-title">Activity and evidence capabilities</h3>
          <div className="tag-list">
            {hub.activityTypes.map((type) => <span className="tag" key={type}>{type}</span>)}
            {hub.evidenceCapabilities.map((type) => <span className="tag" key={`evidence-${type}`}>Evidence: {type}</span>)}
          </div>
        </section>
        <section className="dialog-section" aria-labelledby="hub-compatibility-title">
          <h3 id="hub-compatibility-title">Compatibility metadata</h3>
          <pre className="safe-json" id="hub-compatibility-title-value">{JSON.stringify(hub.compatibility, null, 2)}</pre>
        </section>
        <section className="dialog-section" aria-labelledby="hub-history-title">
          <h3 id="hub-history-title">Registration history</h3>
          {history.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">Outcome</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((event, index) => (
                    <tr key={`${event.eventKey}-${event.occurredAt}-${index}`}>
                      <th scope="row">{event.eventKey}</th>
                      <td><StatusBadge label={event.outcome} tone={event.outcome === "succeeded" ? "positive" : "warning"} /></td>
                      <td>{formatDate(event.occurredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No registration or update events are visible for this hub.</p>
          )}
        </section>
      </div>
      <div className="admin-dialog__footer">
        <button className="button button--danger" type="button" onClick={() => onToggleActive(hub)}>
          {hub.active ? "Disable hub" : "Enable hub"}
        </button>
        <button className="button button--secondary" type="button" onClick={() => onEdit(hub)}>Edit hub</button>
        <button className="button button--secondary" type="button" onClick={onClose}>Close</button>
        <AdminLink className="button button--primary" href="/curriculum">Edit curriculum</AdminLink>
      </div>
    </dialog>
  );
}
