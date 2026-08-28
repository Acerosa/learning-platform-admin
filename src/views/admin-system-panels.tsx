"use client";

import { useState } from "react";
import type { AdminDataSnapshot } from "../api/admin-api";
import type { PendingAction } from "../components/pending-action-dialog";
import { StatusBadge, type BadgeTone } from "../components/status-badge";
import { formatDate } from "../utils/format";

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state__mark" aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function toneForStatus(status: string): BadgeTone {
  if (["active", "healthy", "certified", "open", "production", "completed", "succeeded", "published", "pass"].includes(status)) return "positive";
  if (["testing", "partial", "draft", "degraded", "maintenance", "ready-for-review", "in-review", "approved", "warn"].includes(status)) return "warning";
  if (["unavailable", "failed", "inactive", "denied", "fail"].includes(status)) return "danger";
  return "neutral";
}

export function SystemStatusPanel({ data }: { data: AdminDataSnapshot }) {
  const certified = data.hubs.filter((hub) => hub.certificationState === "certified").length;
  return (
    <>
      <section className="certification-summary">
        <div><p className="eyebrow">Platform assurance</p><strong>{certified}</strong><span>certified hubs</span></div>
        <p>Operational health, compatibility and LHDS assurance metadata from the backend.</p>
      </section>
      {data.health.length ? (
        <div className="card-grid card-grid--4">
          {data.health.map((health) => (
            <article className="health-card" key={health.serviceKey}>
              <div>
                <span className={`health-dot health-dot--${health.status}`} aria-hidden="true" />
                <StatusBadge label={health.status} tone={toneForStatus(health.status)} />
              </div>
              <h2>{health.label}</h2>
              <p>{health.message}</p>
              <small>{health.checkedAt ? `Checked ${formatDate(health.checkedAt)} · ${health.source}` : `No check available · ${health.source}`}</small>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel"><EmptyState title="No health signals" body="No safe health rows are available." /></section>
      )}
      <div className="card-grid card-grid--2">
        {data.hubs.map((hub) => (
          <article className="certification-card" key={hub.hubCode}>
            <div className="certification-card__header">
              <div><p className="eyebrow">{hub.hubCode}</p><h2>{hub.hubName}</h2></div>
              <StatusBadge label={hub.certificationState ?? "not recorded"} tone={hub.certificationState === "certified" ? "positive" : "neutral"} />
            </div>
            <p>Status: {hub.status} · {hub.active ? "active" : "inactive"}</p>
          </article>
        ))}
      </div>
      <section className="notice-card notice-card--info"><strong>Safe operational surface</strong><p>Only public status messages and validity timestamps are selected. Diagnostics and stack traces are excluded.</p></section>
    </>
  );
}

export function SystemAuditPanel({ data }: { data: AdminDataSnapshot }) {
  const [query, setQuery] = useState("");
  const visibleEvents = data.auditEvents.filter((event) =>
    `${event.eventKey} ${event.entityType} ${event.entityKey ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <section className="panel">
        <h2 className="sr-only">Audit events</h2>
        <div className="toolbar">
          <div className="toolbar__search"><label htmlFor="audit-query">Search safe audit fields</label><input id="audit-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Action or target key" /></div>
          <span className="toolbar__count" role="status">{visibleEvents.length} events</span>
        </div>
        {visibleEvents.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Event</th><th scope="col">Actor</th><th scope="col">Entity</th><th scope="col">Target</th><th scope="col">Outcome</th><th scope="col">Occurred</th></tr></thead>
              <tbody>{visibleEvents.map((event, index) => (
                <tr key={`${event.eventKey}-${event.occurredAt}-${index}`}>
                  <th scope="row"><code>{event.eventKey}</code></th>
                  <td>{event.actorType}</td>
                  <td>{event.entityType}</td>
                  <td>{event.entityKey ?? "—"}</td>
                  <td><StatusBadge label={event.outcome} tone={toneForStatus(event.outcome)} /></td>
                  <td>{formatDate(event.occurredAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title={query ? "No matching audit events" : "No audit events"} body="No safe event summaries are available for this query." />}
      </section>
      <section className="notice-card notice-card--info"><strong>Sensitive context stays protected</strong><p>The portal does not select audit context, tokens, credentials or arbitrary learner PII.</p></section>
    </>
  );
}

export function SystemAccessPanel({ data }: { data: AdminDataSnapshot }) {
  return (
    <>
      <section className="panel">
        <div className="panel__header"><div><p className="eyebrow">Backend staff context</p><h2>Platform access</h2></div></div>
        {data.teachers.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Staff</th><th scope="col">Reference</th><th scope="col">Role</th><th scope="col">State</th></tr></thead>
              <tbody>{data.teachers.map((teacher) => (
                <tr key={`${teacher.staffReference}-${teacher.roleLabel}`}>
                  <th scope="row">{teacher.displayName}</th>
                  <td><code>{teacher.staffReference}</code></td>
                  <td>{teacher.roleLabel}</td>
                  <td><StatusBadge label={teacher.active ? "active" : "revoked"} tone={teacher.active ? "positive" : "neutral"} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No access records" body="No staff-role records are visible." />}
      </section>
      <section className="notice-card notice-card--warning"><strong>No frontend role rules</strong><p>The portal uses backend staff context and does not infer permissions from email addresses or routes.</p></section>
    </>
  );
}

export function SystemAdvancedPanel({
  data,
  openPending,
}: {
  data: AdminDataSnapshot;
  openPending: (action: PendingAction) => void;
}) {
  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <div><p className="eyebrow">Version governance</p><h2>Platform contracts</h2></div>
          <button className="button button--secondary" type="button" onClick={() => openPending({ title: "Propose a platform configuration change" })}>Propose change</button>
        </div>
        {data.contracts.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Contract</th><th scope="col">Version</th><th scope="col">Status</th><th scope="col">Boundary</th></tr></thead>
              <tbody>{data.contracts.map((contract) => (
                <tr key={`${contract.contractKey}-${contract.version}`}>
                  <th scope="row"><code>{contract.contractKey}</code></th>
                  <td>{contract.version}</td>
                  <td><StatusBadge label={contract.status} tone={toneForStatus(contract.status)} /></td>
                  <td>{contract.boundary}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No contracts" body="No platform contract versions are visible." />}
      </section>
      <section className="notice-card notice-card--info"><strong>Advanced configuration</strong><p>Contract versions, schema versions and supported features are shown here. Secrets are never surfaced.</p></section>
    </>
  );
}
