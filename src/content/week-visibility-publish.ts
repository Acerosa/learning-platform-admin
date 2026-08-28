import { canTransition, isImmutableStatus, LifecycleError } from "./lifecycle.ts";
import { publicationGate } from "./publication-gate.ts";
import type { AuthoringDraft, ValidationIssue } from "./types.ts";
import {
  approveRecord,
  createWorkingCopy,
  publishVersion,
  replaceRecord,
  returnToDraft,
  startReview,
  submitForReview,
  suggestNextVersion,
  touchDraft,
} from "./versioning.ts";
import {
  canPostWeek,
  canRemoveWeek,
  postWeek,
  removeWeek,
  weekContentStatus,
} from "./week-availability.ts";

export type WeekVisibilityAction = "post" | "remove";

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
};

/** Soft, non-blocking hint when T Level week ids may not overlay hub weeks week-1…week-22. */
export function weekVisibilityHubIdHint(hubCode: string, weekId: string, teachingWeek: string): string | null {
  if (hubCode !== "tlevel-software-development") return null;
  const expected = /^week-\d+$/;
  if (expected.test(weekId)) return null;
  const n = teachingWeek && teachingWeek !== "?" ? teachingWeek : "N";
  return `Learner hub overlays match week-1…week-22 (e.g. week-${n}); this id is “${weekId}”.`;
}

/** Fast-forward Draft → Approved for the week-visibility shortcut (skips Review UI). */
export function approveForWeekVisibilityPublish(
  record: AuthoringDraft,
  action: WeekVisibilityAction,
  weekId: string,
  actor: string,
): AuthoringDraft {
  const notes = `Week visibility: ${action} ${weekId}`;
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
  throw new LifecycleError("Week visibility publish requires a Draft (or review) record.");
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
  throw new LifecycleError("This record cannot be prepared for week visibility publish.");
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
): WeekVisibilityPublishResult {
  if (draft.platformPublicationState === "publishing") {
    throw new WeekVisibilityPublishError("Platform publication is already in progress.");
  }

  const ensured = ensureEditableDraft(records, draft, actor);
  let workingRecords = ensured.records;
  let working = ensured.draft;

  const week = working.package.weeks.find((item) => item.id === weekId);
  if (!week) {
    throw new WeekVisibilityPublishError(`Week not found: ${weekId}`);
  }
  if (action === "post" && !canPostWeek(week)) {
    throw new WeekVisibilityPublishError("This week is already available.");
  }
  if (action === "remove" && !canRemoveWeek(week)) {
    throw new WeekVisibilityPublishError("This week is not available to remove.");
  }

  const nextPackage = action === "post"
    ? postWeek(working.package, weekId)
    : removeWeek(working.package, weekId);
  working = touchDraft(working, nextPackage);
  workingRecords = replaceRecord(workingRecords, working);

  const gate = publicationGate(working.package, working.sourcePackageVersion);
  if (!gate.ok) {
    throw new WeekVisibilityPublishError(
      "Week visibility publish requires validation success and supported schema and package versions.",
      gate.issues,
    );
  }

  const approved = approveForWeekVisibilityPublish(working, action, weekId, actor);
  workingRecords = replaceRecord(workingRecords, approved);

  const version = suggestNextVersion(workingRecords, approved.hubId, approved.courseKey);
  const notes = `Week visibility: ${action} ${weekId}`;
  const nextRecords = publishVersion(workingRecords, approved, {
    version,
    publishedBy: actor,
    notes,
  });
  const published = nextRecords.find((item) => item.id === approved.id);
  if (!published || published.status !== "published") {
    throw new WeekVisibilityPublishError("Local immutable publish did not produce a published snapshot.");
  }

  const publishedWeek = published.package.weeks.find((item) => item.id === weekId);
  if (!publishedWeek) {
    throw new WeekVisibilityPublishError(`Week missing after publish: ${weekId}`);
  }
  const expected = action === "post" ? "available" : "planned";
  if (weekContentStatus(publishedWeek) !== expected) {
    throw new WeekVisibilityPublishError(`Week status after publish is ${weekContentStatus(publishedWeek)}, expected ${expected}.`);
  }

  return {
    records: nextRecords,
    published,
    weekId,
    action,
    teachingWeek: String(publishedWeek.metadata.teachingWeek ?? "?"),
    weekTitle: String(publishedWeek.metadata.title || weekId),
    status: expected,
    hubCode: published.hubId,
    courseKey: published.courseKey,
  };
}

export function weekVisibilityPublishSuccessMessage(result: WeekVisibilityPublishResult): string {
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
