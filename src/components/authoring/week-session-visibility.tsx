import { StatusBadge, type BadgeTone } from "../status-badge";
import type { ContentDocument } from "../../content/types";
import { weekContentStatus } from "../../content/week-availability";
import {
  POST_WEEK_BEFORE_SESSIONS,
  sessionVisibilityRows,
} from "../../content/session-availability";

function statusTone(status: string): BadgeTone {
  if (status === "available") return "positive";
  if (status === "archived") return "neutral";
  return "warning";
}

export function WeekSessionVisibilityPanel({
  week,
  sessions,
  publishReady,
  busy,
  onPost,
  onRemove,
}: {
  week: ContentDocument | null;
  sessions: readonly ContentDocument[];
  publishReady: boolean;
  busy: boolean;
  onPost: (sessionId: string) => void;
  onRemove: (sessionId: string) => void;
}) {
  if (!week) {
    return (
      <section className="session-visibility" aria-labelledby="session-visibility-heading">
        <h3 id="session-visibility-heading">Sessions in this week</h3>
        <p>Select a week first.</p>
      </section>
    );
  }

  const weekStatus = weekContentStatus(week);
  const weekTitle = String(week.metadata.title || week.id);
  const rows = sessionVisibilityRows(week, sessions, publishReady, busy);

  return (
    <section className="session-visibility" aria-labelledby="session-visibility-heading">
      <h3 id="session-visibility-heading">Sessions in this week</h3>
      <p className="session-visibility__week">
        <strong>{weekTitle}</strong>
        <span>Status: {weekStatus}</span>
        <StatusBadge label={weekStatus} tone={statusTone(weekStatus)} />
      </p>
      {weekStatus !== "available" ? (
        <p className="field-hint" role="status">{POST_WEEK_BEFORE_SESSIONS}</p>
      ) : null}
      {rows.length ? (
        <ul className="session-visibility__list">
          {rows.map((row) => (
            <li key={row.id} data-session-id={row.id} data-session-status={row.status}>
              <div className="session-visibility__copy">
                <strong>{row.title}</strong>
                <span>{row.kind}</span>
                <span>Status: {row.status}</span>
                <StatusBadge label={row.status} tone={statusTone(row.status)} />
              </div>
              {row.action === "remove" ? (
                <button
                  className="button button--small button--secondary"
                  type="button"
                  disabled={row.disabled}
                  onClick={() => onRemove(row.id)}
                >
                  {busy ? "Publishing…" : "Remove session & publish"}
                </button>
              ) : (
                <button
                  className="button button--small button--primary"
                  type="button"
                  disabled={row.disabled}
                  title={row.blockedReason || undefined}
                  onClick={() => onPost(row.id)}
                >
                  {busy ? "Publishing…" : "Post session & publish"}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No sessions in this week.</p>
      )}
    </section>
  );
}
