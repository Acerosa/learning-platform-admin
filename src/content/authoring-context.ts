import { isEditableStatus, isImmutableStatus } from "./lifecycle.ts";
import type { AuthoringDraft } from "./types.ts";
import { createDraft } from "./versioning.ts";

export function matchesAuthoringContext(
  record: Pick<AuthoringDraft, "hubId" | "courseKey">,
  hubId: string,
  courseKey: string,
) {
  return record.hubId === hubId && record.courseKey === courseKey;
}

export function recordsForContext(
  records: readonly AuthoringDraft[],
  hubId: string,
  courseKey: string,
) {
  return records.filter((record) => matchesAuthoringContext(record, hubId, courseKey));
}

export function findAuthoringRecordForContext(
  records: readonly AuthoringDraft[],
  hubId: string,
  courseKey: string,
) {
  const matching = recordsForContext(records, hubId, courseKey);
  const editable = matching
    .filter((record) => isEditableStatus(record.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  if (editable[0]) return editable[0];

  const recoverable = matching
    .filter((record) => !isImmutableStatus(record.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  if (recoverable[0]) return recoverable[0];

  return matching.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
}

export function resolveActiveDraftForContext(
  records: readonly AuthoringDraft[],
  hubId: string,
  courseKey: string,
  hubName: string,
  actor: string,
): AuthoringDraft {
  return findAuthoringRecordForContext(records, hubId, courseKey)
    || createDraft(hubId, hubName, courseKey, actor);
}

export function isCacheableLocalRecord(record: AuthoringDraft) {
  return !isImmutableStatus(record.status);
}

/** Keep one recent non-immutable working copy per hub/course in browser storage. */
export function pruneRecordsForLocalStorage(records: readonly AuthoringDraft[]): AuthoringDraft[] {
  const byContext = new Map<string, AuthoringDraft>();
  for (const record of [...records]
    .filter(isCacheableLocalRecord)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))) {
    const key = `${record.hubId}::${record.courseKey}`;
    if (!byContext.has(key)) byContext.set(key, record);
  }
  return [...byContext.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function applyDraftSelection(
  draft: AuthoringDraft,
  records: readonly AuthoringDraft[],
) {
  const contextRecords = recordsForContext(records, draft.hubId, draft.courseKey);
  const comparePeer = contextRecords.find((item) => item.id !== draft.id)?.id || draft.id;
  return {
    selectedActivityId: draft.package.activities[0]?.id || "",
    previewId: draft.id,
    compareLeft: draft.id,
    compareRight: comparePeer,
    visibilityWeekId: draft.package.weeks[0]?.id || "",
  };
}
