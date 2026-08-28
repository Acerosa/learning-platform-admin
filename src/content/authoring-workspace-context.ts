import type { AuthoringDraft } from "./types.ts";

/** Regression invariant for Admin curriculum authoring UX. */
export const AUTHORING_WORKSPACE_INVARIANT =
  "Content mutations preserve the current Admin workspace. Navigation only occurs following an explicit navigation action.";

export const AUTHORING_WORKSPACE_STORAGE_KEY = "lp.admin.authoring.workspace.v1";

export type AuthoringWorkspaceTab =
  | "curriculum"
  | "weeks"
  | "sessions"
  | "activities"
  | "imports"
  | "drafts"
  | "versions"
  | "review"
  | "publication"
  | "history"
  | "compare"
  | "archive";

export interface AuthoringWorkspaceContext {
  hubCode: string;
  courseKey: string;
  tab: AuthoringWorkspaceTab;
  weekId?: string;
  sessionId?: string;
  activityId?: string;
  previewId?: string;
  previewWeekId?: string;
}

export interface DraftSelectionState {
  selectedActivityId: string;
  previewId: string;
  compareLeft: string;
  compareRight: string;
  visibilityWeekId: string;
}

export function loadAuthoringWorkspaceContext(): AuthoringWorkspaceContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(AUTHORING_WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthoringWorkspaceContext>;
    if (!parsed.hubCode || !parsed.courseKey || !parsed.tab) return null;
    return parsed as AuthoringWorkspaceContext;
  } catch {
    return null;
  }
}

export function saveAuthoringWorkspaceContext(context: AuthoringWorkspaceContext): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AUTHORING_WORKSPACE_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Workspace persistence is best-effort; in-session React state remains authoritative.
  }
}

export function resolveWorkspaceHubCode(
  stored: AuthoringWorkspaceContext | null,
  hubs: readonly { hubCode: string }[],
  fallback: string,
): string {
  if (stored?.hubCode && hubs.some((hub) => hub.hubCode === stored.hubCode)) {
    return stored.hubCode;
  }
  return fallback;
}

export function resolveWorkspaceCourseKey(
  stored: AuthoringWorkspaceContext | null,
  links: readonly { hubCode: string; courseKey: string }[],
  hubCode: string,
  fallback: string,
): string {
  if (
    stored?.courseKey
    && links.some((link) => link.hubCode === hubCode && link.courseKey === stored.courseKey)
  ) {
    return stored.courseKey;
  }
  return links.find((link) => link.hubCode === hubCode)?.courseKey || fallback;
}

export function resolveWorkspaceTab(
  stored: AuthoringWorkspaceContext | null,
  fallback: AuthoringWorkspaceTab = "curriculum",
): AuthoringWorkspaceTab {
  return stored?.tab || fallback;
}

export function mergeSelectionWithWorkspace(
  base: DraftSelectionState,
  stored: AuthoringWorkspaceContext | null,
  draft: Pick<AuthoringDraft, "id" | "package">,
): DraftSelectionState {
  const weeks = draft.package.weeks;
  const activities = draft.package.activities;
  return {
    ...base,
    visibilityWeekId: stored?.weekId && weeks.some((week) => week.id === stored.weekId)
      ? stored.weekId
      : base.visibilityWeekId,
    selectedActivityId: stored?.activityId && activities.some((activity) => activity.id === stored.activityId)
      ? stored.activityId
      : base.selectedActivityId,
    previewId: stored?.previewId ? stored.previewId : base.previewId,
  };
}

/** Reconcile workspace context after a module refresh without falling back to hubs[0]. */
export function restoreWorkspaceAfterRefresh(
  current: AuthoringWorkspaceContext,
  hubs: readonly { hubCode: string }[],
  links: readonly { hubCode: string; courseKey: string }[],
): AuthoringWorkspaceContext {
  const hubCode = resolveWorkspaceHubCode(current, hubs, current.hubCode);
  const courseKey = resolveWorkspaceCourseKey(current, links, hubCode, current.courseKey);
  return { ...current, hubCode, courseKey };
}
