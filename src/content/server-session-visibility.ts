import { createPublishedWeeksWorkspace, type PublishedWeeksWorkspace } from "./visibility-workspace.ts";
import { createWorkingCopyFromPackage } from "./versioning.ts";
import { compareSemver, isSemver } from "./semver.ts";
import type { AuthoringDraft, ContentPackage } from "./types.ts";

export type SessionVisibilityStatus = "available" | "planned";

export type SessionVisibilityRequest = {
  hubCode: string;
  courseKey: string;
  sessionId: string;
  status: SessionVisibilityStatus;
};

export type SessionVisibilityResult = {
  publicationId: string;
  previousPackageVersion: string;
  packageVersion: string;
  sessionId: string;
  previousStatus: string;
  status: string;
  idempotent: boolean;
};

export type ServerSessionVisibilitySuccess = {
  authoringDraft: AuthoringDraft;
  authoringRecords: readonly AuthoringDraft[];
  weeksWorkspace: PublishedWeeksWorkspace;
  activeDraft: AuthoringDraft;
  previewId: string;
  weekId: string;
  message: string;
  catalogueVersion: string;
};

/** Live Admin with the generic RPC and published-package loader. Not a product allowlist. */
export function usesServerSessionVisibility(input: {
  platformAvailable: boolean;
  hasSessionVisibilityRpc: boolean;
  hasPublishedPackageLoader: boolean;
}): boolean {
  return input.platformAvailable
    && input.hasSessionVisibilityRpc
    && input.hasPublishedPackageLoader;
}

export function sessionVisibilityStatusForAction(action: "post" | "remove"): SessionVisibilityStatus {
  return action === "post" ? "available" : "planned";
}

/** Browser payload for session release. Never includes package JSON. */
export function sessionVisibilityRequest(input: {
  hubCode: string;
  courseKey: string;
  sessionId: string;
  action: "post" | "remove";
}): SessionVisibilityRequest {
  return {
    hubCode: input.hubCode,
    courseKey: input.courseKey,
    sessionId: input.sessionId,
    status: sessionVisibilityStatusForAction(input.action),
  };
}

export function sessionVisibilitySuccessMessage(
  action: "post" | "remove",
  result: Pick<SessionVisibilityResult, "idempotent" | "status" | "packageVersion" | "sessionId">,
): string {
  if (result.idempotent) {
    return `Session already ${result.status}. Catalogue remains ${result.packageVersion}.`;
  }
  return `Session visibility: ${action} ${result.sessionId} → catalogue ${result.packageVersion}.`;
}

/** Prefer the newly published Weeks workspace version before the publications list refreshes. */
export function operationalCatalogueVersion(
  hostedPublicationVersion: string | null | undefined,
  weeksWorkspaceVersion: string | null | undefined,
): string | null {
  const hosted = hostedPublicationVersion && isSemver(hostedPublicationVersion)
    ? hostedPublicationVersion
    : null;
  const workspace = weeksWorkspaceVersion && isSemver(weeksWorkspaceVersion)
    ? weeksWorkspaceVersion
    : null;
  if (hosted && workspace) {
    return compareSemver(workspace, hosted) >= 0 ? workspace : hosted;
  }
  return workspace || hosted;
}

export function weekIdForSession(pkg: ContentPackage, sessionId: string): string {
  const session = pkg.sessions.find((item) => item.id === sessionId);
  const related = session ? String(session.relationships.week || "") : "";
  if (related && pkg.weeks.some((week) => week.id === related)) return related;
  const fromWeek = pkg.weeks.find((week) => {
    const sessions = Array.isArray(week.relationships.sessions) ? week.relationships.sessions : [];
    return sessions.map(String).includes(sessionId);
  });
  return fromWeek?.id || pkg.weeks[0]?.id || "";
}

/**
 * Refresh Weeks from the current published catalogue without mutating the
 * separate Curriculum/Activities authoring draft.
 */
export function applyServerSessionVisibilitySuccess(input: {
  authoringDraft: AuthoringDraft;
  authoringRecords: readonly AuthoringDraft[];
  publishedPackage: ContentPackage;
  result: SessionVisibilityResult;
  actor: string;
  action: "post" | "remove";
  tab: string;
  previewId: string;
}): ServerSessionVisibilitySuccess {
  const working = createWorkingCopyFromPackage(
    input.publishedPackage,
    input.actor,
    input.result.packageVersion,
  );
  const weeksWorkspace = createPublishedWeeksWorkspace(working, input.result.packageVersion);
  const onWeeks = input.tab === "weeks";
  const previewStillAuthoring = input.authoringRecords.some((record) => record.id === input.previewId)
    || input.authoringDraft.id === input.previewId;
  return {
    authoringDraft: input.authoringDraft,
    authoringRecords: input.authoringRecords,
    weeksWorkspace,
    activeDraft: onWeeks ? weeksWorkspace.draft : input.authoringDraft,
    previewId: previewStillAuthoring ? input.previewId : input.authoringDraft.id,
    weekId: weekIdForSession(input.publishedPackage, input.result.sessionId),
    message: sessionVisibilitySuccessMessage(input.action, input.result),
    catalogueVersion: input.result.packageVersion,
  };
}

export function sessionVisibilityStateAfterAttempt<T extends {
  authoringDraft: AuthoringDraft;
  authoringRecords: readonly AuthoringDraft[];
  weeksWorkspace: PublishedWeeksWorkspace | null;
  previewId: string;
}>(
  prior: T,
  outcome:
    | { ok: false }
    | {
      ok: true;
      publishedPackage: ContentPackage;
      result: SessionVisibilityResult;
      actor: string;
      action: "post" | "remove";
      tab: string;
    },
): T | (T & ServerSessionVisibilitySuccess) {
  if (!outcome.ok) return prior;
  return {
    ...prior,
    ...applyServerSessionVisibilitySuccess({
      authoringDraft: prior.authoringDraft,
      authoringRecords: prior.authoringRecords,
      publishedPackage: outcome.publishedPackage,
      result: outcome.result,
      actor: outcome.actor,
      action: outcome.action,
      tab: outcome.tab,
      previewId: prior.previewId,
    }),
  };
}
