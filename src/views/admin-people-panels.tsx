"use client";

import { useState } from "react";
import type { AdminDataSnapshot } from "../api/admin-api";
import type { PendingAction } from "../components/pending-action-dialog";
import { StatusBadge } from "../components/status-badge";
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

function toneForStatus(status: string) {
  if (["active", "completed", "succeeded", "published", "pass", "open"].includes(status)) return "positive" as const;
  if (["partial", "draft", "ready-for-review", "in-review", "approved", "warn"].includes(status)) return "warning" as const;
  if (["unavailable", "failed", "inactive", "denied", "fail"].includes(status)) return "danger" as const;
  return "neutral" as const;
}

export function LearnersPanel({
  data,
  openPending,
  showEnrolments = false,
}: {
  data: AdminDataSnapshot;
  openPending: (action: PendingAction) => void;
  showEnrolments?: boolean;
}) {
  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <div><p className="eyebrow">Minimised directory</p><h2>Learners</h2></div>
          <button className="button button--primary" type="button" onClick={() => openPending({ title: "Add a learner" })}>
            <span aria-hidden="true">＋</span> Add learner
          </button>
        </div>
        {data.learners.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Learner</th><th scope="col">Student number</th><th scope="col">Active groups</th><th scope="col">Active enrolments</th><th scope="col">Status</th></tr></thead>
              <tbody>{data.learners.map((learner) => (
                <tr key={learner.studentNumber}>
                  <th scope="row">{learner.displayName}</th>
                  <td><code>{learner.studentNumber}</code></td>
                  <td>{learner.groupCodes.join(", ") || "None"}</td>
                  <td>{learner.activeEnrolmentCount}</td>
                  <td><StatusBadge label={learner.active ? "active" : "inactive"} tone={learner.active ? "positive" : "neutral"} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No learners" body="No learner records are visible to this authorised session." />}
      </section>
      {showEnrolments && data.enrolments.length ? (
        <section className="panel">
          <div className="panel__header">
            <div><p className="eyebrow">Current and historical relationships</p><h2>Enrolments</h2></div>
            <span className="count-chip">{data.enrolments.length} records</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Learner</th><th scope="col">Group</th><th scope="col">Joined</th><th scope="col">Left</th><th scope="col">Status</th></tr></thead>
              <tbody>{data.enrolments.map((enrolment, index) => (
                <tr key={`${enrolment.learnerNumber}-${enrolment.groupCode}-${index}`}>
                  <th scope="row"><code>{enrolment.learnerNumber}</code></th>
                  <td>{enrolment.groupCode}</td>
                  <td>{formatDate(enrolment.joinedOn)}</td>
                  <td>{formatDate(enrolment.leftOn)}</td>
                  <td><StatusBadge label={enrolment.status} tone={toneForStatus(enrolment.status)} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}
      <section className="notice-card notice-card--info"><strong>Privacy by design</strong><p>The list omits contact details, internal UUIDs and response payloads. Enrolment history appears here and on group screens.</p></section>
    </>
  );
}

export function GroupsPanel({
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
          <div><p className="eyebrow">Cohorts</p><h2>Academic groups</h2></div>
          <button className="button button--primary" type="button" onClick={() => openPending({ title: "Create a group" })}>
            <span aria-hidden="true">＋</span> Create group
          </button>
        </div>
        {data.groups.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Group</th><th scope="col">Academic year</th><th scope="col">Year</th><th scope="col">Course</th><th scope="col">Learners</th><th scope="col">Registration</th><th scope="col">Status</th></tr></thead>
              <tbody>{data.groups.map((group) => (
                <tr key={group.groupCode}>
                  <th scope="row"><span className="table-primary">{group.groupName}</span><code>{group.groupCode}</code></th>
                  <td>{group.academicYear}</td>
                  <td>{group.yearGroup}</td>
                  <td><span className="table-primary">{group.courseTitle}</span><code>{group.courseKey}</code></td>
                  <td>{group.activeLearnerCount}</td>
                  <td><StatusBadge label={group.registrationOpen ? "open" : "closed"} tone={group.registrationOpen ? "positive" : "neutral"} /></td>
                  <td><StatusBadge label={group.active ? "active" : "inactive"} tone={group.active ? "positive" : "neutral"} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No groups" body="No group records are visible." />}
      </section>
      <section className="notice-card notice-card--info"><strong>Registration keys stay protected</strong><p>The administration list shows registration state and never returns registration-key values.</p></section>
    </>
  );
}

export function StaffPanel({
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
          <div><p className="eyebrow">Platform authority</p><h2>Staff</h2></div>
          <button className="button button--primary" type="button" onClick={() => openPending({ title: "Invite a teacher" })}>
            <span aria-hidden="true">＋</span> Invite staff
          </button>
        </div>
        {data.teachers.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Staff</th><th scope="col">Reference</th><th scope="col">Backend role</th><th scope="col">Role state</th></tr></thead>
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
        ) : <EmptyState title="No platform roles" body="No staff-role records are visible." />}
      </section>
      <section className="notice-card notice-card--warning"><strong>Backend-authoritative roles</strong><p>A staff profile alone does not grant portal authority. Active roles are read from the backend and every data request remains protected by RLS.</p></section>
    </>
  );
}

export function EnrolmentsPanel({ data }: { data: AdminDataSnapshot }) {
  const [query, setQuery] = useState("");
  const visible = data.enrolments.filter((enrolment) =>
    `${enrolment.learnerNumber} ${enrolment.groupCode}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="panel__header"><div><p className="eyebrow">Relationships</p><h2>Enrolments</h2></div><span className="count-chip">{visible.length} records</span></div>
      <div className="toolbar"><div className="toolbar__search"><label htmlFor="enrolment-query">Search</label><input id="enrolment-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Learner or group" /></div></div>
      {visible.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Learner</th><th scope="col">Group</th><th scope="col">Joined</th><th scope="col">Left</th><th scope="col">Status</th></tr></thead>
            <tbody>{visible.map((enrolment, index) => (
              <tr key={`${enrolment.learnerNumber}-${enrolment.groupCode}-${index}`}>
                <th scope="row"><code>{enrolment.learnerNumber}</code></th>
                <td>{enrolment.groupCode}</td>
                <td>{formatDate(enrolment.joinedOn)}</td>
                <td>{formatDate(enrolment.leftOn)}</td>
                <td><StatusBadge label={enrolment.status} tone={toneForStatus(enrolment.status)} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <EmptyState title="No enrolments" body="No current or historical enrolments are visible." />}
    </section>
  );
}
