"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminModule } from "../router/modules";
import { useAdminPortal } from "../stores/admin-portal";
import { StatusBadge, type BadgeTone } from "../components/status-badge";

const STUDENT_APP_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_GROUP_GENERATOR_URL) ||
  "https://acerosa.github.io/classroom-group-generator/";

const POLL_MS = 2500;
const SESSION_STORAGE_KEY = "lp-admin-grouping-session-id";

interface GroupingMember {
  id: string;
  displayName: string;
  needsAssignment?: boolean;
}

interface GroupingTeam {
  id: string;
  teamKey: string;
  displayName: string;
  sortOrder: number;
  members: GroupingMember[];
}

interface GroupingParticipant {
  id: string;
  displayName: string;
  joinedAt: string;
  joinedAfterPublication: boolean;
  needsAssignment: boolean;
  teamId: string | null;
}

interface GroupingSession {
  id: string;
  sessionName: string | null;
  joinCode: string;
  preferredGroupSize: number;
  status: "joining" | "proposed" | "published" | "closed";
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  participantCount: number;
  participants: GroupingParticipant[];
  teams: GroupingTeam[];
  visibleToStudents: boolean;
}

function toneForGroupingStatus(status: string): BadgeTone {
  if (status === "published") return "positive";
  if (status === "proposed") return "warning";
  if (status === "closed") return "neutral";
  return "info";
}

function studentJoinUrl(joinCode: string): string {
  const base = STUDENT_APP_BASE.endsWith("/") ? STUDENT_APP_BASE : `${STUDENT_APP_BASE}/`;
  return `${base}?s=${encodeURIComponent(joinCode)}`;
}

function qrImageUrl(url: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(url)}`;
}

function asSession(value: unknown): GroupingSession | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    sessionName: row.sessionName == null ? null : String(row.sessionName),
    joinCode: String(row.joinCode ?? ""),
    preferredGroupSize: Number(row.preferredGroupSize ?? 5),
    status: String(row.status ?? "joining") as GroupingSession["status"],
    createdAt: String(row.createdAt ?? ""),
    publishedAt: row.publishedAt == null ? null : String(row.publishedAt),
    closedAt: row.closedAt == null ? null : String(row.closedAt),
    participantCount: Number(row.participantCount ?? 0),
    participants: Array.isArray(row.participants)
      ? (row.participants as Record<string, unknown>[]).map((participant) => ({
          id: String(participant.id ?? ""),
          displayName: String(participant.displayName ?? ""),
          joinedAt: String(participant.joinedAt ?? ""),
          joinedAfterPublication: Boolean(participant.joinedAfterPublication),
          needsAssignment: Boolean(participant.needsAssignment),
          teamId: participant.teamId == null ? null : String(participant.teamId),
        }))
      : [],
    teams: Array.isArray(row.teams)
      ? (row.teams as Record<string, unknown>[]).map((team) => ({
          id: String(team.id ?? ""),
          teamKey: String(team.teamKey ?? ""),
          displayName: String(team.displayName ?? ""),
          sortOrder: Number(team.sortOrder ?? 0),
          members: Array.isArray(team.members)
            ? (team.members as Record<string, unknown>[]).map((member) => ({
                id: String(member.id ?? ""),
                displayName: String(member.displayName ?? ""),
                needsAssignment: Boolean(member.needsAssignment),
              }))
            : [],
        }))
      : [],
    visibleToStudents: Boolean(row.visibleToStudents),
  };
}

function rpcErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export function GroupGeneratorPage() {
  const moduleDef = getAdminModule("group-generator");
  const { callRpc, dataSource } = useAdminPortal();
  const live = dataSource.mode === "live" && dataSource.state === "ready";

  const [sessionName, setSessionName] = useState("");
  const [preferredSize, setPreferredSize] = useState(5);
  const [session, setSession] = useState<GroupingSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  const joinUrl = useMemo(
    () => (session ? studentJoinUrl(session.joinCode) : ""),
    [session],
  );

  const lateParticipants = useMemo(
    () =>
      session?.participants.filter(
        (participant) => participant.needsAssignment || (participant.joinedAfterPublication && !participant.teamId),
      ) ?? [],
    [session],
  );

  const refreshSession = useCallback(
    async (sessionId: string) => {
      const rows = await callRpc("get_grouping_session", { p_session_id: sessionId });
      const next = asSession(rows[0]);
      if (next) setSession(next);
    },
    [callRpc],
  );

  useEffect(() => {
    if (!live) return;
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return;
    void refreshSession(stored).catch(() => {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    });
  }, [live, refreshSession]);

  useEffect(() => {
    if (!live || !session || session.status === "closed") return;
    const timer = window.setInterval(() => {
      void refreshSession(session.id).catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [live, session, refreshSession]);

  const run = useCallback(
    async (action: () => Promise<void>, successNotice?: string) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await action();
        if (successNotice) setNotice(successNotice);
      } catch (caught) {
        setError(rpcErrorMessage(caught));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const createSession = () =>
    run(async () => {
      const rows = await callRpc("create_grouping_session", {
        p_session_name: sessionName.trim() || null,
        p_preferred_group_size: preferredSize,
      });
      const created = asSession(rows[0]);
      if (!created) throw new Error("Session was created but could not be loaded.");
      setSession(created);
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, created.id);
    }, "Session created.");

  const clearSession = () => {
    setSession(null);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setNotice(null);
    setError(null);
  };

  if (!live) {
    return (
      <>
        <header className="page-header">
          <div>
            <p className="eyebrow">{moduleDef.eyebrow}</p>
            <h1>{moduleDef.label}</h1>
            <p>{moduleDef.description}</p>
          </div>
        </header>
        <section className="panel">
          <div className="empty-state">
            <h2>Live platform required</h2>
            <p>
              Group Generator uses authenticated <code>admin_api</code> RPCs.
              Connect Admin to a live Supabase project to create classroom sessions.
            </p>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{moduleDef.eyebrow}</p>
          <h1>{moduleDef.label}</h1>
          <p>{moduleDef.description}</p>
        </div>
        {session ? (
          <button className="button button--secondary" type="button" onClick={clearSession} disabled={busy}>
            New session
          </button>
        ) : null}
      </header>

      {error ? (
        <p className="notice-card" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice-card" role="status">
          {notice}
        </p>
      ) : null}

      {!session ? (
        <section className="panel" aria-labelledby="create-grouping-session">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Create</p>
              <h2 id="create-grouping-session">Create a session</h2>
            </div>
          </div>
          <div className="toolbar" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "end" }}>
            <label style={{ display: "grid", gap: "0.35rem", minWidth: "16rem" }}>
              <span>Session name (optional)</span>
              <input
                type="text"
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                placeholder="Client Brief Activity"
                maxLength={80}
                disabled={busy}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Preferred group size</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  className="button button--secondary button--small"
                  type="button"
                  aria-label="Decrease preferred group size"
                  disabled={busy || preferredSize <= 2}
                  onClick={() => setPreferredSize((value) => Math.max(2, value - 1))}
                >
                  −
                </button>
                <span aria-live="polite" style={{ minWidth: "2rem", textAlign: "center", fontWeight: 600 }}>
                  {preferredSize}
                </span>
                <button
                  className="button button--secondary button--small"
                  type="button"
                  aria-label="Increase preferred group size"
                  disabled={busy || preferredSize >= 12}
                  onClick={() => setPreferredSize((value) => Math.min(12, value + 1))}
                >
                  +
                </button>
              </div>
            </label>
            <button className="button button--primary" type="button" onClick={createSession} disabled={busy}>
              Create session
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="panel" aria-labelledby="grouping-session-overview">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Session</p>
                <h2 id="grouping-session-overview">{session.sessionName || "Classroom groups"}</h2>
              </div>
              <StatusBadge label={session.status} tone={toneForGroupingStatus(session.status)} />
            </div>

            <div
              style={{
                display: "grid",
                gap: "1.25rem",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                alignItems: "start",
              }}
            >
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <p>
                  <strong>Join code:</strong>{" "}
                  <code style={{ fontSize: "1.35rem", letterSpacing: "0.08em" }}>{session.joinCode}</code>
                </p>
                <p>
                  <strong>Student link:</strong>{" "}
                  <a href={joinUrl} target="_blank" rel="noreferrer">
                    {joinUrl}
                  </a>
                </p>
                <p>
                  <strong>Students joined:</strong> {session.participantCount}
                </p>
                {!session.visibleToStudents && session.status === "proposed" ? (
                  <p role="status">
                    <StatusBadge label="Not visible to students yet" tone="warning" />
                  </p>
                ) : null}
              </div>
              <figure style={{ margin: 0, textAlign: "center" }}>
                <img
                  src={qrImageUrl(joinUrl)}
                  alt={`QR code for join code ${session.joinCode}`}
                  width={180}
                  height={180}
                />
                <figcaption style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                  Scan to join
                </figcaption>
              </figure>
            </div>
          </section>

          <section className="panel" aria-labelledby="grouping-participants">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Joining</p>
                <h2 id="grouping-participants">
                  {session.participantCount} student{session.participantCount === 1 ? "" : "s"} joined
                </h2>
              </div>
            </div>
            {session.participants.length === 0 ? (
              <p>Waiting for students to join…</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
                {session.participants.map((participant) => (
                  <li
                    key={participant.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      alignItems: "center",
                      padding: "0.5rem 0",
                      borderBottom: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
                    }}
                  >
                    <span>
                      {participant.displayName}
                      {participant.needsAssignment ? (
                        <>
                          {" "}
                          <StatusBadge label="Needs assignment" tone="warning" />
                        </>
                      ) : null}
                    </span>
                    {session.status !== "closed" ? (
                      <button
                        className="button button--small button--secondary"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const rows = await callRpc("remove_grouping_participant", {
                              p_participant_id: participant.id,
                            });
                            const next = asSession(rows[0]);
                            if (next) setSession(next);
                          }, "Participant removed.")
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(session.status === "joining" || session.status === "proposed") && (
            <section className="panel" aria-labelledby="grouping-generate">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Generate</p>
                  <h2 id="grouping-generate">Generate groups</h2>
                </div>
              </div>
              <div className="toolbar" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "end" }}>
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span>Preferred group size</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <button
                      className="button button--secondary button--small"
                      type="button"
                      aria-label="Decrease preferred group size"
                      disabled={busy || preferredSize <= 2}
                      onClick={() => setPreferredSize((value) => Math.max(2, value - 1))}
                    >
                      −
                    </button>
                    <span aria-live="polite" style={{ minWidth: "2rem", textAlign: "center", fontWeight: 600 }}>
                      {preferredSize}
                    </span>
                    <button
                      className="button button--secondary button--small"
                      type="button"
                      aria-label="Increase preferred group size"
                      disabled={busy || preferredSize >= 12}
                      onClick={() => setPreferredSize((value) => Math.min(12, value + 1))}
                    >
                      +
                    </button>
                  </div>
                </label>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={busy || session.participantCount < 1}
                  onClick={() =>
                    run(async () => {
                      const rows = await callRpc("generate_grouping_teams", {
                        p_session_id: session.id,
                        p_preferred_group_size: preferredSize,
                      });
                      const next = asSession(rows[0]);
                      if (next) setSession(next);
                    }, "Groups generated. Not visible to students yet.")
                  }
                >
                  {session.status === "proposed" ? "Regenerate" : "Generate groups"}
                </button>
              </div>
            </section>
          )}

          {session.teams.length > 0 ? (
            <section className="panel" aria-labelledby="grouping-preview">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Groups</p>
                  <h2 id="grouping-preview">
                    {session.status === "published" ? "Published groups" : "Group preview"}
                  </h2>
                </div>
                {session.status === "proposed" ? (
                  <StatusBadge label="Not visible to students yet" tone="warning" />
                ) : null}
              </div>

              <div style={{ display: "grid", gap: "1.25rem" }}>
                {session.teams.map((team) => (
                  <article key={team.id} aria-labelledby={`team-${team.id}`}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                        alignItems: "center",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <h3 id={`team-${team.id}`} style={{ margin: 0 }}>
                        {team.displayName}
                      </h3>
                      {session.status !== "closed" ? (
                        <form
                          style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                          onSubmit={(event) => {
                            event.preventDefault();
                            const nextName = (renameDrafts[team.id] ?? team.displayName).trim();
                            if (!nextName || nextName === team.displayName) return;
                            void run(async () => {
                              const rows = await callRpc("rename_grouping_team", {
                                p_team_id: team.id,
                                p_display_name: nextName,
                              });
                              const next = asSession(rows[0]);
                              if (next) setSession(next);
                            }, "Group renamed.");
                          }}
                        >
                          <label className="sr-only" htmlFor={`rename-${team.id}`}>
                            Rename {team.displayName}
                          </label>
                          <input
                            id={`rename-${team.id}`}
                            type="text"
                            value={renameDrafts[team.id] ?? team.displayName}
                            onChange={(event) =>
                              setRenameDrafts((current) => ({
                                ...current,
                                [team.id]: event.target.value,
                              }))
                            }
                            disabled={busy}
                            maxLength={80}
                          />
                          <button className="button button--small button--secondary" type="submit" disabled={busy}>
                            Rename
                          </button>
                        </form>
                      ) : null}
                    </div>
                    <ul>
                      {team.members.map((member) => (
                        <li key={member.id} style={{ marginBottom: "0.35rem" }}>
                          {member.displayName}{" "}
                          {session.status !== "closed" && session.teams.length > 1 ? (
                            <label style={{ marginLeft: "0.5rem" }}>
                              <span className="sr-only">Move {member.displayName}</span>
                              <select
                                aria-label={`Move ${member.displayName}`}
                                disabled={busy}
                                value={team.id}
                                onChange={(event) => {
                                  const targetTeamId = event.target.value;
                                  if (targetTeamId === team.id) return;
                                  void run(async () => {
                                    const rows = await callRpc("move_grouping_participant", {
                                      p_participant_id: member.id,
                                      p_team_id: targetTeamId,
                                    });
                                    const next = asSession(rows[0]);
                                    if (next) setSession(next);
                                  }, "Student moved.");
                                }}
                              >
                                {session.teams.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.displayName}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              {session.status === "proposed" ? (
                <div className="toolbar" style={{ marginTop: "1.25rem", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const rows = await callRpc("generate_grouping_teams", {
                          p_session_id: session.id,
                          p_preferred_group_size: preferredSize,
                        });
                        const next = asSession(rows[0]);
                        if (next) setSession(next);
                      }, "Groups regenerated. Still not visible to students.")
                    }
                  >
                    Regenerate
                  </button>
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const rows = await callRpc("publish_grouping_session", {
                          p_session_id: session.id,
                        });
                        const next = asSession(rows[0]);
                        if (next) setSession(next);
                      }, "Groups published. Students can now see their teams.")
                    }
                  >
                    Publish groups
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {session.status === "published" ? (
            <section className="panel" aria-labelledby="grouping-late">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Late arrivals</p>
                  <h2 id="grouping-late">After publication</h2>
                </div>
              </div>
              {lateParticipants.length === 0 ? (
                <p>No students waiting for assignment.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", display: "grid", gap: "0.75rem" }}>
                  {lateParticipants.map((participant) => (
                    <li key={participant.id} style={{ display: "grid", gap: "0.5rem" }}>
                      <strong>{participant.displayName}</strong>
                      <div className="toolbar" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          className="button button--small button--secondary"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              const rows = await callRpc("assign_late_grouping_participant", {
                                p_participant_id: participant.id,
                                p_team_id: null,
                                p_to_smallest: true,
                              });
                              const next = asSession(rows[0]);
                              if (next) setSession(next);
                            }, "Added to the smallest group.")
                          }
                        >
                          Add to smallest group
                        </button>
                        <label>
                          <span className="sr-only">Choose group for {participant.displayName}</span>
                          <select
                            disabled={busy || session.teams.length === 0}
                            defaultValue=""
                            onChange={(event) => {
                              const teamId = event.target.value;
                              if (!teamId) return;
                              void run(async () => {
                                const rows = await callRpc("assign_late_grouping_participant", {
                                  p_participant_id: participant.id,
                                  p_team_id: teamId,
                                  p_to_smallest: false,
                                });
                                const next = asSession(rows[0]);
                                if (next) setSession(next);
                              }, "Student assigned.");
                              event.target.value = "";
                            }}
                          >
                            <option value="">Choose group…</option>
                            {session.teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.displayName}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="button button--secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  const confirmed = window.confirm(
                    "Rebalance all groups? This may move students who already have a published group.",
                  );
                  if (!confirmed) return;
                  void run(async () => {
                    const rows = await callRpc("rebalance_grouping_session", {
                      p_session_id: session.id,
                      p_preferred_group_size: preferredSize,
                    });
                    const next = asSession(rows[0]);
                    if (next) setSession(next);
                  }, "All groups rebalanced.");
                }}
              >
                Rebalance all groups
              </button>
            </section>
          ) : null}

          {session.status !== "closed" ? (
            <section className="panel">
              <button
                className="button button--secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  const confirmed = window.confirm("Close this session? Students will no longer be able to join.");
                  if (!confirmed) return;
                  void run(async () => {
                    const rows = await callRpc("close_grouping_session", {
                      p_session_id: session.id,
                    });
                    const next = asSession(rows[0]);
                    if (next) setSession(next);
                  }, "Session closed.");
                }}
              >
                Close session
              </button>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
