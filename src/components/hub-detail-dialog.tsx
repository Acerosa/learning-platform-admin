"use client";

import { useEffect, useRef } from "react";
import type { HubCourseLinkRecord, HubRecord } from "../api/admin-api";
import { StatusBadge } from "./status-badge";

export function HubDetailDialog({
  hub,
  courseLinks,
  onClose,
  onEdit,
  onDeactivate,
}: {
  hub: HubRecord | null;
  courseLinks: readonly HubCourseLinkRecord[];
  onClose: () => void;
  onEdit: (hub: HubRecord) => void;
  onDeactivate: (hub: HubRecord) => void;
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
        </div>
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
      </div>
      <div className="admin-dialog__footer">
        <button className="button button--danger" type="button" onClick={() => onDeactivate(hub)}>Deactivate</button>
        <button className="button button--secondary" type="button" onClick={() => onEdit(hub)}>Edit hub</button>
        <button className="button button--secondary" type="button" onClick={onClose}>Close</button>
      </div>
    </dialog>
  );
}
