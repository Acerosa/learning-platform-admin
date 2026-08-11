"use client";

import { useEffect, useRef } from "react";
import { ADMIN_MUTATION_STATUS } from "../api/admin-api";

export interface PendingAction {
  title: string;
  subject?: string;
}

export function PendingActionDialog({
  action,
  onClose,
}: {
  action: PendingAction | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (action && dialog && !dialog.open) dialog.showModal();
    if (!action && dialog?.open) dialog.close();
  }, [action]);

  if (!action) return null;

  return (
    <dialog
      className="admin-dialog"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      aria-labelledby="pending-action-title"
    >
      <div className="admin-dialog__header">
        <div>
          <p className="eyebrow">Prepared workflow</p>
          <h2 id="pending-action-title">{action.title}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">×</button>
      </div>
      <div className="admin-dialog__body">
        {action.subject ? <p className="admin-dialog__subject">{action.subject}</p> : null}
        <div className="notice-card notice-card--warning">
          <strong>Backend contract required</strong>
          <p>{ADMIN_MUTATION_STATUS.reason}</p>
        </div>
        <p>This control is intentionally safe: it prepares the administration journey without inventing an endpoint or changing platform data.</p>
        <h3>Enable after the backend provides</h3>
        <ul className="check-list">
          {ADMIN_MUTATION_STATUS.requiredBeforeEnablement.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="admin-dialog__footer">
        <button className="button button--primary" type="button" onClick={onClose}>Understood</button>
      </div>
    </dialog>
  );
}
