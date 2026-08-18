export const DRAFT_AUTOSAVE_MS = 800;
export const PREVIEW_REFRESH_MS = 400;
export const VALIDATION_REFRESH_MS = 400;

export type DraftSaveStatus = "idle" | "unsaved" | "saving" | "saved" | "failed" | "offline";
export type LoadStatus = "idle" | "loading" | "loaded" | "empty" | "error";
export type ValidationUiStatus = "not-validated" | "validating" | "valid" | "invalid" | "failed";

export function createSequenceGate() {
  let latest = 0;
  return {
    next() {
      latest += 1;
      return latest;
    },
    isCurrent(id: number) {
      return id === latest;
    },
    current() {
      return latest;
    },
  };
}

export function isStaleResult(requestId: number, latestId: number) {
  return requestId !== latestId;
}

export function beginExclusiveAction(inProgress: boolean) {
  if (inProgress) return { accepted: false as const };
  return { accepted: true as const };
}

export function nextDraftRevision(current: number) {
  return Math.max(0, current) + 1;
}

export function applySuccessfulSave<T extends { revision: number }>(
  local: T,
  remote: { revision: number },
  requestId: number,
  latestId: number,
): T | null {
  if (isStaleResult(requestId, latestId)) return null;
  return { ...local, revision: remote.revision };
}

export function keepLocalOnSaveFailure<T>(local: T, requestId: number, latestId: number): T {
  void requestId;
  void latestId;
  return local;
}

export function confirmationForPublication(state: "publishing" | "published" | "failed" | "idle") {
  return {
    showPublished: state === "published",
    showPublishing: state === "publishing",
    disablePublish: state === "publishing",
  };
}
