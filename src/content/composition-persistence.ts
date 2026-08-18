import type { AuthoringDraft, ContentPackage } from "./types.ts";
import type { CompositionDraft, CompositionReference } from "./composition-engine.ts";
import { rehydrateCompositionDraft } from "./composition-engine.ts";

const STORAGE_PREFIX = "lp.admin.composition.state.v1";

export interface CompositionDraftPersistence {
  draftId: string;
  references: CompositionReference[];
}

export function serialiseCompositionReferences(references: CompositionReference[]) {
  return references.map((reference) => ({
    instance_id: reference.instanceId,
    library_type: reference.libraryType,
    library_item_id: reference.libraryItemId,
    library_version: reference.libraryVersion,
    state: reference.state,
    overrides: reference.overrides,
  }));
}

export function parseCompositionReferences(rows: Record<string, unknown>[]): CompositionReference[] {
  return rows.map((row) => ({
    instanceId: String(row.instance_id ?? ""),
    libraryType: String(row.library_type ?? "activity") as CompositionReference["libraryType"],
    libraryItemId: String(row.library_item_id ?? ""),
    libraryVersion: String(row.library_version ?? "1.0.0"),
    state: String(row.state ?? "inherited") as CompositionReference["state"],
    overrides: row.overrides && typeof row.overrides === "object"
      ? row.overrides as Record<string, unknown>
      : {},
  }));
}

export function hydrateCompositionFromDraft(
  draft: AuthoringDraft,
  references: CompositionReference[],
): CompositionDraft {
  return rehydrateCompositionDraft(draft.package, references);
}

export function persistLocalCompositionState(draftId: string, references: CompositionReference[]) {
  if (typeof window === "undefined") return;
  const payload: CompositionDraftPersistence = { draftId, references };
  window.localStorage.setItem(`${STORAGE_PREFIX}:${draftId}`, JSON.stringify(payload));
}

export function loadLocalCompositionState(draftId: string): CompositionReference[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${draftId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<CompositionDraftPersistence>;
    return Array.isArray(parsed.references) ? parsed.references as CompositionReference[] : [];
  } catch {
    return [];
  }
}

export function buildCompositionDraftFromPackage(
  pkg: ContentPackage,
  references: CompositionReference[],
): CompositionDraft {
  return rehydrateCompositionDraft(pkg, references);
}
