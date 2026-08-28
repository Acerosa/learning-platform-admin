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
} from "./versioning.ts";

export class CurriculumPublishError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string, issues: readonly ValidationIssue[] = []) {
    super(message);
    this.name = "CurriculumPublishError";
    this.issues = issues;
  }
}

export type CurriculumPublishResult = {
  records: AuthoringDraft[];
  published: AuthoringDraft;
  version: string;
};

/** Fast-forward Draft → Approved for the simplified publish path (skips Review UI). */
export function approveForCurriculumPublish(
  record: AuthoringDraft,
  actor: string,
  notes = "Curriculum publish",
): AuthoringDraft {
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
  if (next.status === "published" && next.platformPublicationState !== "published") {
    return { ...next, approvalNotes: notes || next.approvalNotes };
  }
  throw new LifecycleError("Curriculum publish requires a Draft (or review) record.");
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
    throw new LifecycleError("Archived versions cannot be published. Restore as Draft first.");
  }
  if (canTransition(draft.status, "draft")) {
    const returned = returnToDraft(draft);
    return { records: replaceRecord(records, returned), draft: returned };
  }
  throw new LifecycleError("This record cannot be prepared for curriculum publish.");
}

/**
 * Atomic local prepare: working copy (if needed) → validate → auto-approve →
 * immutable publish with automatic next version. Does not call the platform RPC.
 */
export function prepareCurriculumPublish(
  records: AuthoringDraft[],
  draft: AuthoringDraft,
  actor: string,
  notes = "Curriculum publish",
): CurriculumPublishResult {
  if (draft.platformPublicationState === "publishing") {
    throw new CurriculumPublishError("Platform publication is already in progress.");
  }

  const ensured = ensureEditableDraft(records, draft, actor);
  let workingRecords = ensured.records;
  const working = ensured.draft;

  const gate = publicationGate(working.package, working.sourcePackageVersion);
  if (!gate.ok) {
    throw new CurriculumPublishError(
      "Publish requires validation success and supported schema and package versions.",
      gate.issues,
    );
  }

  const approved = approveForCurriculumPublish(working, actor, notes);
  workingRecords = replaceRecord(workingRecords, approved);

  const version = suggestNextVersion(workingRecords, approved.hubId, approved.courseKey, {
    basedOnVersion: working.basedOnVersion,
  });
  const nextRecords = publishVersion(workingRecords, approved, {
    version,
    publishedBy: actor,
    notes,
  });
  const published = nextRecords.find((item) => item.id === approved.id);
  if (!published || published.status !== "published") {
    throw new CurriculumPublishError("Local immutable publish did not produce a published snapshot.");
  }

  return {
    records: nextRecords,
    published,
    version,
  };
}

export function canRunCurriculumPublish(
  draft: AuthoringDraft,
  platformAvailable: boolean,
  busy: boolean,
  gateOk: boolean,
): boolean {
  if (busy) return false;
  if (!platformAvailable) return false;
  if (!gateOk) return false;
  if (draft.platformPublicationState === "publishing") return false;
  if (draft.status === "archived") return false;
  if (isImmutableStatus(draft.status) && draft.status !== "published" && draft.status !== "superseded") {
    return false;
  }
  return true;
}

export function curriculumPublishSuccessMessage(version: string, idempotent: boolean): string {
  const base = idempotent
    ? "This snapshot is already the active platform publication."
    : `Published ${version} to the platform.`;
  return `${base} Learners consume published content only. Reload learner hubs after week visibility changes.`;
}
