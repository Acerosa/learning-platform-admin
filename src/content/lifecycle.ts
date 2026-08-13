import type { AuthoringDraft, LifecycleStatus } from "./types";

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  draft: "Draft",
  "ready-for-review": "Ready for Review",
  "in-review": "In Review",
  approved: "Approved",
  published: "Published",
  superseded: "Superseded",
  archived: "Archived",
};

export const ALLOWED_TRANSITIONS: Record<LifecycleStatus, readonly LifecycleStatus[]> = {
  draft: ["ready-for-review"],
  "ready-for-review": ["in-review", "draft"],
  "in-review": ["approved", "draft"],
  approved: ["published", "draft"],
  published: ["superseded", "archived"],
  superseded: ["archived"],
  archived: [],
};

export class LifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifecycleError";
  }
}

export function isLifecycleStatus(value: string): value is LifecycleStatus {
  return value in ALLOWED_TRANSITIONS;
}

export function isImmutableStatus(status: LifecycleStatus) {
  return status === "published" || status === "superseded" || status === "archived";
}

export function isEditableStatus(status: LifecycleStatus) {
  return status === "draft";
}

export function canTransition(from: LifecycleStatus, to: LifecycleStatus) {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: LifecycleStatus, to: LifecycleStatus) {
  if (!canTransition(from, to)) {
    throw new LifecycleError(`Cannot transition from ${LIFECYCLE_LABELS[from]} to ${LIFECYCLE_LABELS[to]}.`);
  }
}

export function assertMutable(record: Pick<AuthoringDraft, "status">) {
  if (isImmutableStatus(record.status)) {
    throw new LifecycleError("Published versions are immutable. Restore or create a working copy to edit.");
  }
  if (!isEditableStatus(record.status)) {
    throw new LifecycleError("Only Draft records can be edited. Return this record to Draft first.");
  }
}

export function transitionRecord(
  record: AuthoringDraft,
  to: LifecycleStatus,
  patch: Partial<AuthoringDraft> = {},
  at = new Date().toISOString(),
): AuthoringDraft {
  assertTransition(record.status, to);
  if (isImmutableStatus(record.status) && to !== "superseded" && to !== "archived") {
    throw new LifecycleError("Published versions are immutable.");
  }
  return {
    ...record,
    ...patch,
    status: to,
    updatedAt: at,
  };
}

export function reviewMetadata(record: AuthoringDraft) {
  return {
    status: record.status,
    created: record.createdAt,
    updated: record.updatedAt,
    author: record.author,
    reviewer: record.reviewer,
    reviewDate: record.reviewDate,
    approvalNotes: record.approvalNotes,
    publicationNotes: record.publicationNotes,
  };
}

export function publicationRecord(record: AuthoringDraft) {
  return {
    version: record.version,
    status: record.status,
    created: record.createdAt,
    published: record.publishedAt,
    publishedBy: record.publishedBy,
    sourcePackageVersion: record.sourcePackageVersion,
    schemaVersion: record.schemaVersion,
  };
}
