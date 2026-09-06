import { canTransition, isImmutableStatus, LifecycleError } from "./lifecycle.ts";
import { publicationGate } from "./publication-gate.ts";
import type { AuthoringDraft, ContentDocument, ContentPackage, ValidationIssue } from "./types.ts";
import {
  approveRecord,
  createWorkingCopy,
  publishVersion,
  replaceRecord,
  restoreAsDraft,
  returnToDraft,
  startReview,
  submitForReview,
  suggestNextVersion,
  touchDraft,
} from "./versioning.ts";
import { compareSemver, isSemver } from "./semver.ts";
import {
  canPostWeek,
  canRemoveWeek,
  postWeek,
  removeWeek,
  weekContentStatus,
} from "./week-availability.ts";
import {
  canPostSession,
  canRemoveSession,
  parentWeekForSession,
  POST_WEEK_BEFORE_SESSIONS,
  postSession,
  removeSession,
  sessionContentStatus,
  sessionPostSuccessMessage,
  sessionRemoveSuccessMessage,
} from "./session-availability.ts";

export type VisibilityEntityType = "week" | "session";
export type WeekVisibilityAction = "post" | "remove";
export type VisibilityAction = WeekVisibilityAction;

export class WeekVisibilityPublishError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string, issues: readonly ValidationIssue[] = []) {
    super(message);
    this.name = "WeekVisibilityPublishError";
    this.issues = issues;
  }
}

export type WeekVisibilityPublishResult = {
  records: AuthoringDraft[];
  published: AuthoringDraft;
  weekId: string;
  action: WeekVisibilityAction;
  teachingWeek: string;
  weekTitle: string;
  status: "available" | "planned";
  hubCode: string;
  courseKey: string;
  entityType?: VisibilityEntityType;
  sessionId?: string;
  sessionTitle?: string;
};

export type VisibilityPublishRequest = {
  entityType: VisibilityEntityType;
  entityId: string;
  action: VisibilityAction;
};

/** Soft, non-blocking hint when T Level week ids may not overlay hub weeks week-1…week-22. */
export function weekVisibilityHubIdHint(hubCode: string, weekId: string, teachingWeek: string): string | null {
  if (hubCode !== "tlevel-software-development") return null;
  const expected = /^week-\d+$/;
  if (expected.test(weekId)) return null;
  const n = teachingWeek && teachingWeek !== "?" ? teachingWeek : "N";
  return `Learner hub overlays match week-1…week-22 (e.g. week-${n}); this id is “${weekId}”.`;
}

function visibilityNotes(entityType: VisibilityEntityType, action: VisibilityAction, entityId: string): string {
  return entityType === "session"
    ? `Session visibility: ${action} ${entityId}`
    : `Week visibility: ${action} ${entityId}`;
}

/** Fast-forward Draft → Approved for the visibility shortcut (skips Review UI). */
export function approveForWeekVisibilityPublish(
  record: AuthoringDraft,
  action: WeekVisibilityAction,
  weekId: string,
  actor: string,
): AuthoringDraft {
  return approveForVisibilityPublish(record, "week", action, weekId, actor);
}

export function approveForVisibilityPublish(
  record: AuthoringDraft,
  entityType: VisibilityEntityType,
  action: VisibilityAction,
  entityId: string,
  actor: string,
): AuthoringDraft {
  const notes = visibilityNotes(entityType, action, entityId);
  let next = record;
  if (next.status === "draft") {
    next = submitForReview(next);
    next = startReview(next, actor);
    next = approveRecord(next, notes, actor);
    return next;
  }
  if (next.status === "ready-for-review") {
    next = startReview(next, actor);
    next = approveRecord(next, notes, actor);
    return next;
  }
  if (next.status === "in-review") {
    return approveRecord(next, notes, actor);
  }
  if (next.status === "approved") {
    return { ...next, approvalNotes: notes || next.approvalNotes };
  }
  throw new LifecycleError("Visibility publish requires a Draft (or review) record.");
}

function ensureEditableDraft(
  records: AuthoringDraft[],
  draft: AuthoringDraft,
  actor: string,
): { records: AuthoringDraft[]; draft: AuthoringDraft } {
  if (draft.status === "draft") {
    return { records, draft };
  }
  if (draft.status === "published" || draft.status === "superseded") {
    const copy = createWorkingCopy(draft, actor);
    return { records: replaceRecord(records, copy), draft: copy };
  }
  if (draft.status === "archived") {
    throw new LifecycleError("Archived versions cannot be edited. Restore as Draft first.");
  }
  if (canTransition(draft.status, "draft")) {
    const returned = returnToDraft(draft);
    return { records: replaceRecord(records, returned), draft: returned };
  }
  throw new LifecycleError("This record cannot be prepared for visibility publish.");
}

export type WeekVisibilityPublishOptions = {
  hostedPublicationVersion?: string | null;
};

function applyWeekVisibility(
  pkg: ContentPackage,
  week: ContentDocument,
  action: VisibilityAction,
  alreadyAtTarget: boolean,
): ContentPackage {
  if (alreadyAtTarget) return pkg;
  if (action === "post" && !canPostWeek(week)) {
    throw new WeekVisibilityPublishError("This week is already available.");
  }
  if (action === "remove" && !canRemoveWeek(week)) {
    throw new WeekVisibilityPublishError("This week is not available to remove.");
  }
  return action === "post" ? postWeek(pkg, week.id) : removeWeek(pkg, week.id);
}

function applySessionVisibility(
  pkg: ContentPackage,
  session: ContentDocument,
  action: VisibilityAction,
  alreadyAtTarget: boolean,
): ContentPackage {
  const parentWeek = parentWeekForSession(pkg, session);
  if (action === "post" && (!parentWeek || weekContentStatus(parentWeek) !== "available")) {
    throw new WeekVisibilityPublishError(POST_WEEK_BEFORE_SESSIONS);
  }
  if (alreadyAtTarget) return pkg;
  if (action === "post" && !canPostSession(session, parentWeek)) {
    throw new WeekVisibilityPublishError(POST_WEEK_BEFORE_SESSIONS);
  }
  if (action === "remove" && !canRemoveSession(session)) {
    throw new WeekVisibilityPublishError("This session is not available to remove.");
  }
  return action === "post" ? postSession(pkg, session.id) : removeSession(pkg, session.id);
}

/**
 * Atomic local prepare for week or session visibility: working copy (if needed)
 * → Post/Remove → validate → auto-approve → immutable publish. Does not call
 * the platform RPC. Review UI is not required.
 */
export function prepareVisibilityPublish(
  records: AuthoringDraft[],
  draft: AuthoringDraft,
  request: VisibilityPublishRequest,
  actor: string,
  options?: WeekVisibilityPublishOptions,
): WeekVisibilityPublishResult {
  const { entityType, entityId, action } = request;
  if (draft.platformPublicationState === "publishing") {
    throw new WeekVisibilityPublishError("Platform publication is already in progress.");
  }

  const ensured = ensureEditableDraft(records, draft, actor);
  let workingRecords = ensured.records;
  let working = ensured.draft;

  const versionContext = {
    basedOnVersion: working.basedOnVersion,
    hostedPublicationVersion: options?.hostedPublicationVersion ?? null,
  };
  if (versionContext.hostedPublicationVersion && isSemver(versionContext.hostedPublicationVersion)) {
    const hosted = versionContext.hostedPublicationVersion;
    if (!working.basedOnVersion || compareSemver(working.basedOnVersion, hosted) < 0) {
      working = { ...working, basedOnVersion: hosted };
      workingRecords = replaceRecord(workingRecords, working);
    }
  }

  const expected = action === "post" ? "available" : "planned";
  let week: ContentDocument | undefined;
  let session: ContentDocument | undefined;
  let nextPackage: ContentPackage;

  if (entityType === "week") {
    week = working.package.weeks.find((item) => item.id === entityId);
    if (!week) {
      throw new WeekVisibilityPublishError(`Week not found: ${entityId}`);
    }
    const alreadyAtTarget = weekContentStatus(week) === expected;
    nextPackage = applyWeekVisibility(working.package, week, action, alreadyAtTarget);
  } else {
    session = working.package.sessions.find((item) => item.id === entityId);
    if (!session) {
      throw new WeekVisibilityPublishError(`Session not found: ${entityId}`);
    }
    const alreadyAtTarget = sessionContentStatus(session) === expected;
    nextPackage = applySessionVisibility(working.package, session, action, alreadyAtTarget);
    week = parentWeekForSession(nextPackage, session) || undefined;
  }

  working = touchDraft(working, nextPackage);
  workingRecords = replaceRecord(workingRecords, working);

  const gate = publicationGate(working.package, working.sourcePackageVersion);
  if (!gate.ok) {
    throw new WeekVisibilityPublishError(
      "Visibility publish requires validation success and supported schema and package versions.",
      gate.issues,
    );
  }

  const approved = approveForVisibilityPublish(working, entityType, action, entityId, actor);
  workingRecords = replaceRecord(workingRecords, approved);

  const version = suggestNextVersion(workingRecords, approved.hubId, approved.courseKey, versionContext);
  const notes = visibilityNotes(entityType, action, entityId);
  const nextRecords = publishVersion(workingRecords, approved, {
    version,
    publishedBy: actor,
    notes,
  });
  const published = nextRecords.find((item) => item.id === approved.id);
  if (!published || published.status !== "published") {
    throw new WeekVisibilityPublishError("Local immutable publish did not produce a published snapshot.");
  }

  if (entityType === "week") {
    const publishedWeek = published.package.weeks.find((item) => item.id === entityId);
    if (!publishedWeek) {
      throw new WeekVisibilityPublishError(`Week missing after publish: ${entityId}`);
    }
    if (weekContentStatus(publishedWeek) !== expected) {
      throw new WeekVisibilityPublishError(`Week status after publish is ${weekContentStatus(publishedWeek)}, expected ${expected}.`);
    }
    return {
      records: nextRecords,
      published,
      weekId: entityId,
      action,
      teachingWeek: String(publishedWeek.metadata.teachingWeek ?? "?"),
      weekTitle: String(publishedWeek.metadata.title || entityId),
      status: expected,
      hubCode: published.hubId,
      courseKey: published.courseKey,
      entityType: "week",
    };
  }

  const publishedSession = published.package.sessions.find((item) => item.id === entityId);
  if (!publishedSession) {
    throw new WeekVisibilityPublishError(`Session missing after publish: ${entityId}`);
  }
  if (sessionContentStatus(publishedSession) !== expected) {
    throw new WeekVisibilityPublishError(`Session status after publish is ${sessionContentStatus(publishedSession)}, expected ${expected}.`);
  }
  const publishedWeek = parentWeekForSession(published.package, publishedSession);
  return {
    records: nextRecords,
    published,
    weekId: publishedWeek?.id || String(publishedSession.relationships.week || ""),
    action,
    teachingWeek: String(publishedWeek?.metadata.teachingWeek ?? "?"),
    weekTitle: String(publishedWeek?.metadata.title || publishedWeek?.id || ""),
    status: expected,
    hubCode: published.hubId,
    courseKey: published.courseKey,
    entityType: "session",
    sessionId: entityId,
    sessionTitle: String(publishedSession.metadata.title || entityId),
  };
}

/**
 * Atomic local prepare: working copy (if needed) → Post/Remove → validate →
 * auto-approve → immutable publish. Does not call the platform RPC.
 * Persists nothing; caller should replace local records then Publish to Platform.
 * Review UI is not required — approveForWeekVisibilityPublish fast-forwards lifecycle.
 */
export function prepareWeekVisibilityPublish(
  records: AuthoringDraft[],
  draft: AuthoringDraft,
  weekId: string,
  action: WeekVisibilityAction,
  actor: string,
  options?: WeekVisibilityPublishOptions,
): WeekVisibilityPublishResult {
  return prepareVisibilityPublish(
    records,
    draft,
    { entityType: "week", entityId: weekId, action },
    actor,
    options,
  );
}

export function prepareSessionVisibilityPublish(
  records: AuthoringDraft[],
  draft: AuthoringDraft,
  sessionId: string,
  action: VisibilityAction,
  actor: string,
  options?: WeekVisibilityPublishOptions,
): WeekVisibilityPublishResult {
  return prepareVisibilityPublish(
    records,
    draft,
    { entityType: "session", entityId: sessionId, action },
    actor,
    options,
  );
}

export function weekVisibilityPublishSuccessMessage(result: WeekVisibilityPublishResult): string {
  if (result.entityType === "session") {
    const title = result.sessionTitle || result.sessionId || "Session";
    return result.status === "available"
      ? sessionPostSuccessMessage(title)
      : sessionRemoveSuccessMessage(title);
  }
  const base = [
    `${result.hubCode} / ${result.courseKey}`,
    `week ${result.teachingWeek} (${result.weekId})`,
    `status ${result.status}`,
    "Reload the learner hub.",
  ].join(" · ");
  const hint = weekVisibilityHubIdHint(result.hubCode, result.weekId, result.teachingWeek);
  return hint ? `${base} ${hint}` : base;
}

export function canRunWeekVisibilityPublish(
  draft: AuthoringDraft,
  platformAvailable: boolean,
  busy: boolean,
): boolean {
  if (busy) return false;
  if (!platformAvailable) return false;
  if (draft.platformPublicationState === "publishing") return false;
  if (draft.status === "archived") return false;
  if (isImmutableStatus(draft.status) && draft.status !== "published" && draft.status !== "superseded") {
    return false;
  }
  return true;
}

/**
 * After a failed platform publish, restore the prior platform snapshot (if any),
 * discard the failed immutable attempt, and keep the intended week change in an editable draft.
 */
export function recoverFromFailedWeekVisibilityPublish(
  records: AuthoringDraft[],
  failed: AuthoringDraft,
  actor: string,
): { records: AuthoringDraft[]; draft: AuthoringDraft } {
  if (failed.platformPublicationState !== "failed") {
    throw new WeekVisibilityPublishError("Recovery requires a failed platform publication.");
  }

  let nextRecords = records.map((item) => {
    if (item.id === failed.id) return item;
    if (
      item.hubId === failed.hubId
      && item.courseKey === failed.courseKey
      && item.status === "superseded"
      && item.platformPublicationState === "published"
    ) {
      return { ...item, status: "published" as const };
    }
    return item;
  });

  const retryDraft = restoreAsDraft(failed, actor);
  retryDraft.basedOnVersion = failed.basedOnVersion ?? retryDraft.basedOnVersion;
  nextRecords = nextRecords.filter((item) => item.id !== failed.id);
  nextRecords = replaceRecord(nextRecords, retryDraft);

  return { records: nextRecords, draft: retryDraft };
}

export function weekVisibilityPlatformPublishFailureMessage(action: WeekVisibilityAction, entityType: VisibilityEntityType = "week"): string {
  if (entityType === "session") {
    const verb = action === "post" ? "Post session & publish" : "Remove session & publish";
    return `Platform publication failed. Your session change is kept in this draft. Use ${verb} again to retry.`;
  }
  const verb = action === "post" ? "Make available" : "Hide from learners";
  return `Platform publication failed. Your week change is kept in this draft — use ${verb} again to retry.`;
}
