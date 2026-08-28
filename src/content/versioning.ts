import { clonePackage, deepFreeze } from "./clone.ts";
import { getContentEngine } from "./engine.ts";
import { emptyPackage } from "./factories.ts";
import { assertMutable, isImmutableStatus, isLifecycleStatus, LifecycleError, transitionRecord } from "./lifecycle.ts";
import { CONTENT_PACKAGE_VERSION, publicationGate } from "./publication-gate.ts";
import { bumpPatch, compareSemver, isSemver } from "./semver.ts";
import { idlePlatformPublication } from "./types.ts";
import type { AuthoringDraft, ContentPackage, LifecycleStatus, PlatformPublicationState } from "./types.ts";

function now() {
  return new Date().toISOString();
}

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultActor(name = "local-author") {
  return name.trim() || "local-author";
}

export function createDraft(
  hubId: string,
  hubName: string,
  courseKey: string,
  actor = "local-author",
): AuthoringDraft {
  const createdAt = now();
  const engine = getContentEngine();
  return {
    id: randomId(),
    title: `${hubName} draft`,
    hubId,
    courseKey,
    status: "draft",
    version: "",
    createdAt,
    updatedAt: createdAt,
    publishedAt: null,
    author: defaultActor(actor),
    reviewer: "",
    reviewDate: null,
    approvalNotes: "",
    publicationNotes: "",
    publishedBy: "",
    sourcePackageVersion: CONTENT_PACKAGE_VERSION,
    schemaVersion: engine.SCHEMA_VERSION,
    basedOnVersionId: null,
    basedOnVersion: null,
    remoteRevision: 0,
    ...idlePlatformPublication(),
    package: emptyPackage(hubId, hubName, courseKey),
  };
}

export function assignedVersions(records: readonly AuthoringDraft[], hubId: string, courseKey: string) {
  return records
    .filter((item) => item.hubId === hubId && item.courseKey === courseKey && item.version && isSemver(item.version))
    .map((item) => item.version);
}

export function latestAssignedVersion(records: readonly AuthoringDraft[], hubId: string, courseKey: string) {
  const versions = assignedVersions(records, hubId, courseKey).sort(compareSemver);
  return versions.at(-1) || null;
}

export type PublicationVersionContext = {
  basedOnVersion?: string | null;
};

function publicationVersionCandidates(
  records: readonly AuthoringDraft[],
  hubId: string,
  courseKey: string,
  context: PublicationVersionContext = {},
): string[] {
  const candidates = assignedVersions(records, hubId, courseKey);
  if (context.basedOnVersion && isSemver(context.basedOnVersion)) {
    candidates.push(context.basedOnVersion);
  }
  for (const item of records) {
    if (item.hubId !== hubId || item.courseKey !== courseKey) continue;
    if (item.basedOnVersion && isSemver(item.basedOnVersion)) {
      candidates.push(item.basedOnVersion);
    }
    if (item.platformPublicationState === "published" && item.version && isSemver(item.version)) {
      candidates.push(item.version);
    }
  }
  return candidates;
}

/** Highest known publication version for a hub/course from local history and context. */
export function authoritativePublicationVersion(
  records: readonly AuthoringDraft[],
  hubId: string,
  courseKey: string,
  context: PublicationVersionContext = {},
): string | null {
  const candidates = publicationVersionCandidates(records, hubId, courseKey, context);
  if (!candidates.length) return null;
  return [...candidates].sort(compareSemver).at(-1) || null;
}

export function suggestNextVersion(
  records: readonly AuthoringDraft[],
  hubId: string,
  courseKey: string,
  context: PublicationVersionContext = {},
): string {
  const latest = authoritativePublicationVersion(records, hubId, courseKey, context);
  return latest ? bumpPatch(latest) : "0.1.0";
}

export function suggestNextVersionForDraft(
  records: readonly AuthoringDraft[],
  draft: Pick<AuthoringDraft, "hubId" | "courseKey" | "basedOnVersion">,
): string {
  return suggestNextVersion(records, draft.hubId, draft.courseKey, { basedOnVersion: draft.basedOnVersion });
}

export function currentPublished(records: readonly AuthoringDraft[], hubId: string, courseKey: string) {
  return records.find((item) => item.hubId === hubId && item.courseKey === courseKey && item.status === "published") || null;
}

function freezeSnapshot(pkg: ContentPackage) {
  return deepFreeze(clonePackage(pkg));
}

export function submitForReview(record: AuthoringDraft) {
  const gate = publicationGate(record.package, record.sourcePackageVersion);
  if (!gate.ok) {
    throw new LifecycleError("Ready for Review requires validation success and supported schema and package versions.");
  }
  return transitionRecord(record, "ready-for-review");
}

export function startReview(record: AuthoringDraft, reviewer: string, at = now()) {
  return transitionRecord(record, "in-review", {
    reviewer: defaultActor(reviewer),
    reviewDate: at,
  }, at);
}

export function approveRecord(record: AuthoringDraft, notes: string, reviewer = record.reviewer, at = now()) {
  return transitionRecord(record, "approved", {
    reviewer: defaultActor(reviewer || record.reviewer || "local-reviewer"),
    reviewDate: record.reviewDate || at,
    approvalNotes: notes,
  }, at);
}

export function returnToDraft(record: AuthoringDraft, at = now()) {
  return transitionRecord(record, "draft", {}, at);
}

export function updateReviewMetadata(
  record: AuthoringDraft,
  patch: Partial<Pick<AuthoringDraft, "author" | "reviewer" | "approvalNotes" | "publicationNotes">>,
) {
  if (isImmutableStatus(record.status)) {
    throw new LifecycleError("Published versions are immutable.");
  }
  return { ...record, ...patch, updatedAt: now() };
}

export function publishVersion(
  records: AuthoringDraft[],
  draft: AuthoringDraft,
  input: { version: string; publishedBy: string; notes?: string },
  at = now(),
): AuthoringDraft[] {
  if (draft.status !== "approved") {
    throw new LifecycleError("Only Approved records can be published.");
  }
  const version = input.version.trim();
  if (!isSemver(version)) {
    throw new LifecycleError("Publication requires a semantic version such as 0.1.0.");
  }
  const latest = authoritativePublicationVersion(records, draft.hubId, draft.courseKey, {
    basedOnVersion: draft.basedOnVersion,
  });
  if (latest && compareSemver(version, latest) <= 0) {
    throw new LifecycleError(`Version ${version} must be greater than the latest known publication version ${latest}.`);
  }
  if (records.some((item) => item.hubId === draft.hubId && item.courseKey === draft.courseKey && item.version === version)) {
    throw new LifecycleError(`Version ${version} already exists for this curriculum.`);
  }
  const gate = publicationGate(draft.package, draft.sourcePackageVersion);
  if (!gate.ok) {
    throw new LifecycleError("Publishing requires validation success, a supported schemaVersion and a supported packageVersion.");
  }
  const published: AuthoringDraft = {
    ...transitionRecord(draft, "published", {
      version,
      publishedAt: at,
      publishedBy: defaultActor(input.publishedBy),
      publicationNotes: input.notes ?? draft.publicationNotes,
      schemaVersion: getContentEngine().SCHEMA_VERSION,
      sourcePackageVersion: draft.sourcePackageVersion || CONTENT_PACKAGE_VERSION,
      package: freezeSnapshot(draft.package),
      platformPublicationState: "pending",
      platformPublicationError: null,
      platformPublishedAt: null,
      platformPublicationId: null,
    }, at),
  };
  const superseded = records.map((item) => {
    if (item.id === draft.id) return published;
    if (
      item.hubId === draft.hubId
      && item.courseKey === draft.courseKey
      && item.status === "published"
    ) {
      return transitionRecord(item, "superseded", {}, at);
    }
    return item;
  });
  if (!records.some((item) => item.id === draft.id)) {
    return [published, ...superseded];
  }
  return superseded;
}

export function createWorkingCopy(published: AuthoringDraft, actor = "local-author"): AuthoringDraft {
  if (published.status !== "published" && published.status !== "superseded") {
    throw new LifecycleError("Working copies can only be opened from Published or Superseded versions.");
  }
  const createdAt = now();
  return {
    ...published,
    id: randomId(),
    title: `${published.title} working copy`,
    status: "draft",
    version: "",
    createdAt,
    updatedAt: createdAt,
    publishedAt: null,
    publishedBy: "",
    publicationNotes: "",
    approvalNotes: "",
    reviewer: "",
    reviewDate: null,
    author: defaultActor(actor),
    basedOnVersionId: published.id,
    basedOnVersion: published.version,
    remoteRevision: 0,
    ...idlePlatformPublication(),
    package: clonePackage(published.package),
  };
}

export function createWorkingCopyFromPackage(
  pkg: ContentPackage,
  actor = "local-author",
  basedOnVersion: string | null = null,
): AuthoringDraft {
  const created = createDraft(
    String(pkg.hub.id),
    String(pkg.hub.metadata.name || pkg.hub.id),
    String(pkg.curriculum.metadata.course || "course"),
    actor,
  );
  return {
    ...created,
    title: `${String(pkg.curriculum.metadata.title || pkg.hub.id)} working copy`,
    basedOnVersion,
    package: clonePackage(pkg),
  };
}

export function authoringDraftFromRemote(
  input: {
    id: string;
    title: string;
    hubCode: string;
    courseKey: string;
    lifecycleStatus: string;
    revision: number;
    package: ContentPackage;
    basedOnPackageVersion: string | null;
    updatedAt: string;
  },
  actor = "local-author",
): AuthoringDraft {
  const created = createWorkingCopyFromPackage(input.package, actor, input.basedOnPackageVersion);
  return {
    ...created,
    id: input.id,
    title: input.title,
    hubId: input.hubCode,
    courseKey: input.courseKey,
    status: isLifecycleStatus(input.lifecycleStatus) ? input.lifecycleStatus : "draft",
    remoteRevision: input.revision,
    updatedAt: input.updatedAt,
    basedOnVersion: input.basedOnPackageVersion,
  };
}

export function mergeRemoteAuthoringDrafts(local: AuthoringDraft[], remote: AuthoringDraft[]): AuthoringDraft[] {
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const merged = local.map((item) => remoteById.get(item.id) ?? item);
  const seen = new Set(merged.map((item) => item.id));
  for (const item of remote) {
    if (!seen.has(item.id)) merged.push(item);
  }
  return merged;
}

export function restoreAsDraft(source: AuthoringDraft, actor = "local-author"): AuthoringDraft {
  const createdAt = now();
  return {
    ...source,
    id: randomId(),
    title: `${source.title} restored draft`,
    status: "draft",
    version: "",
    createdAt,
    updatedAt: createdAt,
    publishedAt: null,
    publishedBy: "",
    publicationNotes: "",
    approvalNotes: "",
    reviewer: "",
    reviewDate: null,
    author: defaultActor(actor),
    basedOnVersionId: source.id,
    basedOnVersion: source.version || null,
    ...idlePlatformPublication(),
    package: clonePackage(source.package),
  };
}

export function archiveVersion(record: AuthoringDraft, at = now()): AuthoringDraft {
  return transitionRecord(record, "archived", {}, at);
}

export function withPlatformPublication(
  record: AuthoringDraft,
  patch: {
    platformPublicationState: PlatformPublicationState;
    platformPublicationError?: string | null;
    platformPublishedAt?: string | null;
    platformPublicationId?: string | null;
  },
): AuthoringDraft {
  return {
    ...record,
    platformPublicationState: patch.platformPublicationState,
    platformPublicationError: patch.platformPublicationError ?? null,
    platformPublishedAt: patch.platformPublishedAt ?? record.platformPublishedAt,
    platformPublicationId: patch.platformPublicationId ?? record.platformPublicationId,
  };
}

export function replaceRecord(records: AuthoringDraft[], record: AuthoringDraft) {
  if (!records.some((item) => item.id === record.id)) {
    return [record, ...records];
  }
  return records.map((item) => (item.id === record.id ? record : item));
}

export function touchDraft(draft: AuthoringDraft, pkg: ContentPackage, status?: LifecycleStatus): AuthoringDraft {
  assertMutable(draft);
  if (status && status !== "draft") {
    throw new LifecycleError("Content edits cannot change lifecycle status. Use the review and publication actions.");
  }
  return {
    ...draft,
    package: pkg,
    status: "draft",
    updatedAt: now(),
    hubId: String(pkg.hub.id),
    courseKey: String(pkg.curriculum.metadata.course || draft.courseKey),
    title: String(pkg.curriculum.metadata.title || draft.title),
  };
}
