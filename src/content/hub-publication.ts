import type {
  AdminDataSnapshot,
  CurriculumPublicationRecord,
  HubRecord,
} from "../api/admin-api.ts";
import { LIFECYCLE_LABELS } from "./lifecycle.ts";
import type { AuthoringDraft, LifecycleStatus } from "./types.ts";

export const HUB_CURRICULUM_STATUSES = [
  "draft",
  "ready-for-review",
  "in-review",
  "approved",
  "published",
  "superseded",
  "archived",
  "none",
] as const;

export type HubCurriculumStatus = (typeof HUB_CURRICULUM_STATUSES)[number];

export interface HubPublicationStatus {
  displayStatus: HubCurriculumStatus;
  displayLabel: string;
  localStatus: LifecycleStatus | "none";
  localLabel: string;
  localVersion: string | null;
  catalogueStatus: "published" | "superseded" | "none";
  catalogueLabel: string;
  packageVersion: string | null;
  schemaVersion: string | null;
  courseKey: string | null;
}

function latestLocalDraft(hubCode: string, drafts: readonly AuthoringDraft[]): AuthoringDraft | null {
  const matches = drafts
    .filter((draft) => draft.hubId === hubCode)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return matches.length ? matches[0] : null;
}

function latestCatalogueRow(
  hubCode: string,
  publications: readonly CurriculumPublicationRecord[],
): CurriculumPublicationRecord | null {
  const rows = publications.filter((row) => row.hubCode === hubCode);
  if (!rows.length) return null;
  return rows.find((row) => row.status === "published")
    ?? rows.slice().sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))[0];
}

export function hubPublicationStatus(
  hub: HubRecord,
  data: Pick<AdminDataSnapshot, "curriculumPublications" | "hubCourseLinks">,
  localDrafts: readonly AuthoringDraft[] = [],
): HubPublicationStatus {
  const local = latestLocalDraft(hub.hubCode, localDrafts);
  const catalogue = latestCatalogueRow(hub.hubCode, data.curriculumPublications);
  const courseKey = data.hubCourseLinks.find((link) => link.hubCode === hub.hubCode && link.active)?.courseKey
    ?? catalogue?.courseKey
    ?? local?.courseKey
    ?? null;

  const localStatus = local?.status ?? "none";
  const catalogueStatus = catalogue?.status ?? "none";
  const displayStatus: HubCurriculumStatus = catalogueStatus !== "none"
    ? catalogueStatus
    : localStatus;
  const displayLabel = displayStatus === "none"
    ? "No curriculum"
    : displayStatus === "published" || displayStatus === "superseded"
      ? displayStatus === "published" ? "Published" : "Superseded"
      : LIFECYCLE_LABELS[displayStatus];

  return {
    displayStatus,
    displayLabel,
    localStatus,
    localLabel: localStatus === "none" ? "No local draft" : LIFECYCLE_LABELS[localStatus],
    localVersion: local?.version ?? null,
    catalogueStatus,
    catalogueLabel: catalogueStatus === "none"
      ? "No platform catalogue row"
      : catalogueStatus === "published" ? "Published" : "Superseded",
    packageVersion: catalogue?.packageVersion ?? local?.version ?? null,
    schemaVersion: catalogue?.schemaVersion ?? local?.schemaVersion ?? null,
    courseKey,
  };
}
