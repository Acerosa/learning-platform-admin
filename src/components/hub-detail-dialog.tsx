"use client";

import { useEffect, useRef } from "react";
import type { HubRecord } from "../api/admin-api";
import { StatusBadge } from "./status-badge";

export function HubDetailDialog({
  hub,
  onClose,
  onEdit,
  onDeactivate,
}: {
  hub: HubRecord | null;
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
          <StatusBadge label={hub.certified ? "certified" : "not certified"} tone={hub.certified ? "positive" : "warning"} />
          <StatusBadge label={hub.active ? "active" : "inactive"} tone={hub.active ? "positive" : "neutral"} />
        </div>
        <dl className="detail-grid">
          <div><dt>Hub code</dt><dd><code>{hub.hubCode}</code></dd></div>
          <div><dt>Subject</dt><dd>{hub.subject}</dd></div>
          <div><dt>Hub version</dt><dd>{hub.hubVersion}</dd></div>
          <div><dt>Platform compatibility</dt><dd>{hub.platformVersion}</dd></div>
          <div className="detail-grid__wide"><dt>Curriculum model</dt><dd>{hub.curriculumModel.replaceAll("/", " → ")}</dd></div>
          <div><dt>Repository</dt><dd><a href={hub.repositoryUrl} target="_blank" rel="noreferrer">Open repository</a></dd></div>
          <div><dt>Deployment</dt><dd>{hub.deploymentUrl ? <a href={hub.deploymentUrl} target="_blank" rel="noreferrer">Open hub</a> : "Not registered"}</dd></div>
        </dl>
        <section className="dialog-section" aria-labelledby="hub-capabilities-title">
          <h3 id="hub-capabilities-title">Capabilities</h3>
          <div className="tag-list">
            {hub.activityTypes.map((type) => <span className="tag" key={type}>{type}</span>)}
          </div>
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
