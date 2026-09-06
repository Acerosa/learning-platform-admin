import type { ContentDocument, ContentPackage } from "./types.ts";
import {
  CONTENT_WEEK_STATUSES,
  isContentWeekStatus,
  weekContentStatus,
  type ContentWeekStatus,
} from "./week-availability.ts";

export const CONTENT_SESSION_STATUSES = CONTENT_WEEK_STATUSES;
export type ContentSessionStatus = ContentWeekStatus;

export const POST_WEEK_BEFORE_SESSIONS =
  "Post the week before releasing individual sessions.";

export function postSessionAndPublishConfirm(sessionTitle: string): string {
  return `Post "${sessionTitle}" to the platform?\n\nLearners will be able to access it once the new curriculum version is published.`;
}

export function removeSessionAndPublishConfirm(sessionTitle: string): string {
  return `Remove "${sessionTitle}" from learners?\n\nThe session stays in the package. This publishes a new version.`;
}

export function sessionPostSuccessMessage(sessionTitle: string): string {
  return `${sessionTitle} is available on the platform.`;
}

export function sessionRemoveSuccessMessage(sessionTitle: string): string {
  return `${sessionTitle} is hidden from learners.`;
}

export function sessionKindLabel(kind: string | null | undefined): string {
  const raw = String(kind || "session").trim() || "session";
  return raw.replace(/-/g, " ");
}

/** Which release action to show. Archived uses the same post helper as weeks. */
export function sessionVisibilityAction(session: ContentDocument): "post" | "remove" {
  return canRemoveSession(session) ? "remove" : "post";
}

export function isSessionPostDisabled(
  session: ContentDocument,
  parentWeek: ContentDocument | null | undefined,
  publishReady: boolean,
): boolean {
  return !publishReady || !canPostSession(session, parentWeek);
}

export type SessionVisibilityRow = {
  id: string;
  title: string;
  kind: string;
  status: string;
  action: "post" | "remove";
  disabled: boolean;
  blockedReason: string | null;
};

export function sessionVisibilityRows(
  week: ContentDocument,
  sessions: readonly ContentDocument[],
  publishReady: boolean,
  busy: boolean,
): SessionVisibilityRow[] {
  return sessions.map((session) => {
    const action = sessionVisibilityAction(session);
    const disabled = busy || (action === "remove"
      ? !publishReady || !canRemoveSession(session)
      : isSessionPostDisabled(session, week, publishReady));
    return {
      id: session.id,
      title: String(session.metadata.title || session.id),
      kind: sessionKindLabel(String(session.metadata.kind || "session")),
      status: sessionContentStatus(session),
      action,
      disabled,
      blockedReason: action === "post" ? sessionPostBlockedReason(session, week) : null,
    };
  });
}

export function sessionContentStatus(session: ContentDocument): string {
  return String(session.metadata.status || "planned");
}

export function parentWeekForSession(
  pkg: ContentPackage,
  session: ContentDocument,
): ContentDocument | null {
  const weekId = String(session.relationships.week || "");
  if (weekId) {
    return pkg.weeks.find((week) => week.id === weekId) || null;
  }
  return pkg.weeks.find((week) => {
    const ids = Array.isArray(week.relationships.sessions) ? week.relationships.sessions as string[] : [];
    return ids.includes(session.id);
  }) || null;
}

export function sessionsForWeek(
  pkg: ContentPackage,
  week: ContentDocument | null | undefined,
): ContentDocument[] {
  if (!week) return [];
  const relatedIds = Array.isArray(week.relationships.sessions)
    ? week.relationships.sessions.map((id) => String(id))
    : [];
  const byId = new Map(pkg.sessions.map((session) => [session.id, session]));
  const ordered: ContentDocument[] = [];
  const seen = new Set<string>();

  for (const id of relatedIds) {
    const session = byId.get(id);
    if (!session || seen.has(session.id)) continue;
    seen.add(session.id);
    ordered.push(session);
  }

  const extras = pkg.sessions.filter((session) => {
    if (seen.has(session.id)) return false;
    return String(session.relationships.week || "") === week.id;
  });
  extras.sort((left, right) => Number(left.metadata.sortOrder || 0) - Number(right.metadata.sortOrder || 0));
  return [...ordered, ...extras];
}

export function canPostSession(
  session: ContentDocument,
  parentWeek?: ContentDocument | null,
): boolean {
  if (parentWeek && weekContentStatus(parentWeek) !== "available") return false;
  return sessionContentStatus(session) !== "available";
}

export function canRemoveSession(session: ContentDocument): boolean {
  return sessionContentStatus(session) === "available";
}

export function sessionPostBlockedReason(
  session: ContentDocument,
  parentWeek?: ContentDocument | null,
): string | null {
  if (!parentWeek) return "Select a week first.";
  if (weekContentStatus(parentWeek) !== "available") return POST_WEEK_BEFORE_SESSIONS;
  if (sessionContentStatus(session) === "available") return "This session is already available.";
  return null;
}

export function setSessionStatus(
  pkg: ContentPackage,
  sessionId: string,
  status: ContentSessionStatus,
): ContentPackage {
  if (!isContentWeekStatus(status)) {
    throw new Error(`Unsupported session status: ${status}`);
  }
  let found = false;
  const sessions = pkg.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    found = true;
    return {
      ...session,
      metadata: {
        ...session.metadata,
        status,
      },
    };
  });
  if (!found) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  return { ...pkg, sessions };
}

/** Post session: mark metadata.status available. Does not delete content. */
export function postSession(pkg: ContentPackage, sessionId: string): ContentPackage {
  return setSessionStatus(pkg, sessionId, "available");
}

/**
 * Remove session from learner visibility: mark metadata.status planned.
 * Never deletes the session or its activities.
 */
export function removeSession(pkg: ContentPackage, sessionId: string): ContentPackage {
  return setSessionStatus(pkg, sessionId, "planned");
}
