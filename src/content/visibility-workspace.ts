import {
  findAuthoringRecordForContext,
  matchesAuthoringContext,
  resolveActiveDraftForContext,
} from "./authoring-context.ts";
import { compareSemver, isSemver } from "./semver.ts";
import type { AuthoringDraft } from "./types.ts";
import { isVisibilityDraftStale } from "./visibility-publish-base.ts";
import { createWorkingCopyFromPackage } from "./versioning.ts";

export type PublishedWeeksWorkspace = {
  draft: AuthoringDraft;
  packageVersion: string;
};

export function visibilityWorkspaceKey(
  hubCode: string,
  courseKey: string,
  packageVersion: string,
): string {
  return `${hubCode}::${courseKey}::${packageVersion}`;
}

export function createPublishedWeeksWorkspace(
  draft: AuthoringDraft,
  packageVersion: string,
): PublishedWeeksWorkspace {
  return { draft, packageVersion };
}

/** True only for the explicitly-owned Weeks snapshot at the hosted catalogue version (or newer). */
export function isCurrentPublishedWeeksWorkspace(
  workspace: PublishedWeeksWorkspace | null | undefined,
  hubCode: string,
  courseKey: string,
  hostedPackageVersion: string | null | undefined,
): boolean {
  if (!workspace || !hostedPackageVersion) return false;
  if (!isSemver(workspace.packageVersion) || !isSemver(hostedPackageVersion)) return false;
  return matchesAuthoringContext(workspace.draft, hubCode, courseKey)
    && compareSemver(workspace.packageVersion, hostedPackageVersion) >= 0;
}

/** The explicit stale-remote condition from the Weeks workspace ownership policy. */
export function isStaleRemoteDraftForCurrentWeeksWorkspace(input: {
  workspace: PublishedWeeksWorkspace | null | undefined;
  candidate: AuthoringDraft;
  hubCode: string;
  courseKey: string;
  hostedPackageVersion: string | null | undefined;
}): boolean {
  const { workspace, candidate, hubCode, courseKey, hostedPackageVersion } = input;
  if (!isCurrentPublishedWeeksWorkspace(workspace, hubCode, courseKey, hostedPackageVersion)) {
    return false;
  }
  if (!hostedPackageVersion || !workspace) return false;
  return matchesAuthoringContext(candidate, hubCode, courseKey)
    && isVisibilityDraftStale(candidate, hostedPackageVersion, workspace.draft.package);
}

/**
 * Remote records always merge into the draft list. They only become active when
 * doing so will not displace the current-published workspace owned by Weeks.
 */
export function shouldActivateRemoteDraft(input: {
  tab: string;
  workspace: PublishedWeeksWorkspace | null | undefined;
  candidate: AuthoringDraft;
  hubCode: string;
  courseKey: string;
  hostedPackageVersion: string | null | undefined;
}): boolean {
  const { tab, workspace, candidate, hubCode, courseKey, hostedPackageVersion } = input;
  if (tab !== "weeks") return true;
  if (isStaleRemoteDraftForCurrentWeeksWorkspace(input)) return false;
  if (!isCurrentPublishedWeeksWorkspace(workspace, hubCode, courseKey, hostedPackageVersion)) {
    return true;
  }
  // Weeks owns the current published snapshot. Even a newer editable remote
  // draft belongs to Curriculum/Activities until the user leaves Weeks.
  return !matchesAuthoringContext(candidate, hubCode, courseKey);
}

/** Resolve the tab-specific active record without deleting the authoring draft. */
export function resolveWorkspaceForTab(input: {
  tab: string;
  records: readonly AuthoringDraft[];
  workspace: PublishedWeeksWorkspace | null | undefined;
  hubCode: string;
  courseKey: string;
  hubName: string;
  actor: string;
  hostedPackageVersion: string | null | undefined;
}): AuthoringDraft {
  const {
    tab,
    records,
    workspace,
    hubCode,
    courseKey,
    hubName,
    actor,
    hostedPackageVersion,
  } = input;
  if (
    tab === "weeks"
    && workspace
    && isCurrentPublishedWeeksWorkspace(workspace, hubCode, courseKey, hostedPackageVersion)
  ) {
    return workspace.draft;
  }
  const authoringRecords = workspace
    ? records.filter((record) => record.id !== workspace.draft.id)
    : records;
  const authoring = findAuthoringRecordForContext(authoringRecords, hubCode, courseKey);
  if (authoring) return authoring;
  if (workspace && matchesAuthoringContext(workspace.draft, hubCode, courseKey)) {
    return createWorkingCopyFromPackage(workspace.draft.package, actor, workspace.packageVersion);
  }
  return resolveActiveDraftForContext(authoringRecords, hubCode, courseKey, hubName, actor);
}

export function shouldStartVisibilityHydration(
  completedKey: string,
  inFlightKey: string,
  requestedKey: string,
): boolean {
  return completedKey !== requestedKey && inFlightKey !== requestedKey;
}

/** A failed hydration deliberately leaves the successful key unchanged so the request can retry. */
export function visibilityHydrateKeyAfterAttempt(
  completedKey: string,
  attemptedKey: string,
  succeeded: boolean,
): string {
  return succeeded ? attemptedKey : completedKey;
}
