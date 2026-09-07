import type { AuthoringDraft, ContentPackage } from "./types.ts";
import { compareSemver, isSemver } from "./semver.ts";
import { createWorkingCopyFromPackage, replaceRecord } from "./versioning.ts";

export type HostedCurriculumSnapshot = {
  packageVersion: string;
  package?: ContentPackage | null;
};

export type PackageCoverage = {
  weeks: number;
  sessions: number;
  activities: number;
};

export const STALE_VISIBILITY_OPEN_PUBLISHED_MESSAGE =
  "This draft is older than the current published curriculum. Open the latest published content before changing visibility.";

export function packageCoverage(pkg: ContentPackage | null | undefined): PackageCoverage {
  return {
    weeks: pkg?.weeks?.length ?? 0,
    sessions: pkg?.sessions?.length ?? 0,
    activities: pkg?.activities?.length ?? 0,
  };
}

/** True when the draft covers fewer weeks, sessions, or activities than the hosted package. */
export function isTruncatedRelativeTo(
  draftPackage: ContentPackage | null | undefined,
  hostedPackage: ContentPackage | null | undefined,
): boolean {
  if (!hostedPackage) return false;
  const draft = packageCoverage(draftPackage);
  const hosted = packageCoverage(hostedPackage);
  return draft.weeks < hosted.weeks
    || draft.sessions < hosted.sessions
    || draft.activities < hosted.activities;
}

/**
 * Highest catalogue version this record is known to be based on.
 * Uses basedOnVersion and, when present, an assigned publication version.
 */
export function draftCatalogueBase(
  draft: Pick<AuthoringDraft, "basedOnVersion" | "version">,
): string | null {
  const versions = [draft.basedOnVersion, draft.version].filter((value): value is string => Boolean(value && isSemver(value)));
  if (!versions.length) return null;
  return [...versions].sort(compareSemver).at(-1) || null;
}

/**
 * Visibility publish must not use an editable authoring draft that lags the
 * current catalogue. Authoring may still keep that draft selected.
 */
export function isVisibilityDraftStale(
  draft: Pick<AuthoringDraft, "basedOnVersion" | "version" | "package">,
  hostedPublicationVersion: string | null | undefined,
  hostedPackage?: ContentPackage | null,
): boolean {
  if (!hostedPublicationVersion || !isSemver(hostedPublicationVersion)) return false;
  if (hostedPackage && isTruncatedRelativeTo(draft.package, hostedPackage)) return true;
  const base = draftCatalogueBase(draft);
  if (!base) return true;
  return compareSemver(base, hostedPublicationVersion) < 0;
}

export function visibilityDraftStaleMessage(
  draft: Pick<AuthoringDraft, "basedOnVersion" | "version">,
  hostedPublicationVersion: string,
): string {
  const base = draftCatalogueBase(draft) || "none";
  return `This draft is older than the current published curriculum (${base} vs ${hostedPublicationVersion}). Visibility changes use the latest published content. Keep this draft for content authoring, or open published content.`;
}

/** Prefer the newly published workspace version before the publications list refreshes. */
export function displayedCatalogueVersion(
  hostedPublicationVersion: string | null | undefined,
  workspace: Pick<AuthoringDraft, "status" | "version">,
): string | null {
  const hosted = hostedPublicationVersion && isSemver(hostedPublicationVersion)
    ? hostedPublicationVersion
    : null;
  const workspaceVersion = workspace.status === "published" && isSemver(workspace.version)
    ? workspace.version
    : null;
  if (hosted && workspaceVersion) {
    return compareSemver(workspaceVersion, hosted) >= 0 ? workspaceVersion : hosted;
  }
  return workspaceVersion || hosted;
}

export function shouldAutoHydrateVisibilityWorkspace(input: {
  tab: string;
  stale?: boolean;
  workspaceCurrent?: boolean;
  remoteDraftsSettled?: boolean;
  platformAvailable: boolean;
  hasPublishedLoader: boolean;
}): boolean {
  const needsPublishedWorkspace = typeof input.workspaceCurrent === "boolean"
    ? !input.workspaceCurrent
    : Boolean(input.stale);
  return input.tab === "weeks"
    && needsPublishedWorkspace
    && input.remoteDraftsSettled !== false
    && input.platformAvailable
    && input.hasPublishedLoader;
}

export type VisibilityPublishBase = {
  records: AuthoringDraft[];
  draft: AuthoringDraft;
  hydrated: boolean;
  hostedVersion: string | null;
  blockedMessage: string | null;
};

/**
 * For week/session visibility only: if a current published package exists and
 * the active draft is stale or truncated, replace the working copy with one
 * created from that published package. Does not delete the authoring draft.
 */
export function resolveVisibilityPublishDraft(
  records: AuthoringDraft[],
  draft: AuthoringDraft,
  actor: string,
  hosted: HostedCurriculumSnapshot | null | undefined,
): VisibilityPublishBase {
  const hostedVersion = hosted?.packageVersion && isSemver(hosted.packageVersion)
    ? hosted.packageVersion
    : null;
  if (!hostedVersion) {
    return { records, draft, hydrated: false, hostedVersion: null, blockedMessage: null };
  }
  if (!hosted?.package) {
    return {
      records,
      draft,
      hydrated: false,
      hostedVersion,
      blockedMessage: STALE_VISIBILITY_OPEN_PUBLISHED_MESSAGE,
    };
  }
  if (!isVisibilityDraftStale(draft, hostedVersion, hosted.package)) {
    return { records, draft, hydrated: false, hostedVersion, blockedMessage: null };
  }
  const working = createWorkingCopyFromPackage(hosted.package, actor, hostedVersion);
  return {
    records: replaceRecord(records, working),
    draft: working,
    hydrated: true,
    hostedVersion,
    blockedMessage: null,
  };
}
