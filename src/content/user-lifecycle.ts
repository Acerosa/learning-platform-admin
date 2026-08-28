import type { AuthoringDraft, LifecycleStatus } from "./types";

/** User-facing lifecycle labels for simplified admin workflow. */
export const USER_LIFECYCLE_LABELS: Record<"draft" | "published" | "archived", string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export function userLifecycleLabel(record: Pick<AuthoringDraft, "status" | "platformPublicationState">): string {
  if (record.status === "archived") return USER_LIFECYCLE_LABELS.archived;
  if (record.status === "published" && record.platformPublicationState === "published") {
    return USER_LIFECYCLE_LABELS.published;
  }
  if (record.status === "published" || record.status === "superseded") {
    return "Published (pending platform sync)";
  }
  return USER_LIFECYCLE_LABELS.draft;
}

export function userLifecycleFromStatus(status: LifecycleStatus): keyof typeof USER_LIFECYCLE_LABELS {
  if (status === "archived") return "archived";
  if (status === "published" || status === "superseded") return "published";
  return "draft";
}
