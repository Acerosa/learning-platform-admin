"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthoringAreaLinks } from "../components/authoring-area-links";
import { StatusBadge, type BadgeTone } from "../components/status-badge";
import {
  BUILT_IN_RECIPES,
  BUILT_IN_TEMPLATES,
  analyseCoverage,
  analyseDifficultyBalance,
  applyCompositionTemplate,
  applyCustomCompositionTemplate,
  applyCustomRecipe,
  applyOverride,
  applyRecipe,
  attachResourceFromLibrary,
  clearOverride,
  computeSessionStats,
  detachFromLibrary,
  durationOverrideState,
  emptyCompositionDraft,
  insertActivityFromLibrary,
  insertQuestionFromLibrary,
  parseCustomRecipeRecord,
  parseCustomTemplateRecord,
  reorderActivities,
  reorderQuestions,
  reorderSessions,
  reorderWeeks,
  resolveActivityEstimatedDuration,
  type CompositionDraft,
  type CompositionReference,
  type CompositionTemplateSessionSpec,
  type CompositionTemplateSpec,
  type CustomRecipeRecord,
  type CustomTemplateRecord,
  type LibraryActivityInsert,
  type RecipeSpec,
} from "../content/composition-engine.ts";
import {
  buildCompositionDraftFromPackage,
  hydrateCompositionFromDraft,
  loadLocalCompositionState,
  parseCompositionReferences,
  persistLocalCompositionState,
  serialiseCompositionReferences,
} from "../content/composition-persistence.ts";
import {
  comparePackages,
  compositionToDraft,
  materialise,
  previewPackageJson,
  updateDraftFromComposition,
} from "../content/materialise.ts";
import { emptyPackage } from "../content/factories.ts";
import { publicationGate } from "../content/publication-gate.ts";
import type { AuthoringDraft, ContentActivity, ContentBlock, ContentDocument } from "../content/types.ts";
import type { LibraryQuestion, LibraryResource } from "../content/library-reuse.ts";
import type { HubCourseLinkRecord, HubRecord } from "../api/admin-api.ts";
import { useAdminPortal } from "../stores/admin-portal";

const LOCAL_DRAFT_KEY = "lp.admin.composition.last-draft.v1";

function toneForStatus(status: string): BadgeTone {
  if (["inherited", "published", "active", "saved"].includes(status)) return "positive";
  if (["overridden", "draft", "update-available", "saving"].includes(status)) return "warning";
  if (["detached", "superseded", "archived"].includes(status)) return "neutral";
  return "info";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

function makeStableKey(value: string, fallback: string) {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function moveItem<T>(items: readonly T[], index: number, delta: number) {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  return arrayMove([...items], index, nextIndex);
}

function readPersistedDraft(): AuthoringDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_DRAFT_KEY);
    return raw ? JSON.parse(raw) as AuthoringDraft : null;
  } catch {
    return null;
  }
}

function persistDraftSnapshot(draft: AuthoringDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
}

function SortableShell({
  id,
  children,
}: {
  id: string;
  children: (props: {
    setNodeRef: (element: HTMLElement | null) => void;
    style: React.CSSProperties;
    listeners: ReturnType<typeof useSortable>["listeners"];
    attributes: ReturnType<typeof useSortable>["attributes"];
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return <>{children({ setNodeRef, style, listeners, attributes })}</>;
}

function DurationValue({ minutes }: { minutes: number | null }) {
  if (minutes == null) return <span className="text-muted">Not set</span>;
  return <span>{minutes} min</span>;
}

function PackageDiffPanel({
  current,
  previous,
}: {
  current: ReturnType<typeof materialise>;
  previous: ReturnType<typeof materialise>;
}) {
  const diff = useMemo(() => comparePackages(current, previous), [current, previous]);
  return (
    <div className="package-diff">
      <p>Added activities: {diff.addedActivities.length}</p>
      <p>Removed activities: {diff.removedActivities.length}</p>
      <p>Changed activities: {diff.changedActivities.length}</p>
      <p>Added sessions: {diff.addedSessions.length}</p>
      <p>Removed sessions: {diff.removedSessions.length}</p>
      <p>Added questions: {diff.addedQuestions.length}</p>
      <p>Removed questions: {diff.removedQuestions.length}</p>
      {diff.metadataChanges.length > 0 && (
        <div>
          <h4>Metadata changes</h4>
          <ul>
            {diff.metadataChanges.map((change) => (
              <li key={change.field}>
                <code>{change.field}</code>: {JSON.stringify(change.oldValue)} → {JSON.stringify(change.newValue)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InlineLibrarySearch({
  type,
  callRpc,
  onInsert,
}: {
  type: "activity" | "question" | "resource";
  callRpc: (name: string, params: Record<string, unknown>) => Promise<unknown[]>;
  onInsert: (item: Record<string, unknown>) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const runSearch = useCallback(async (nextOffset = 0, append = false) => {
    if (!query.trim()) {
      setResults([]);
      setOffset(0);
      setHasMore(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await callRpc("search_library", {
        p_query: query,
        p_library_types: [type],
        p_status: "published",
        p_limit: 20,
        p_offset: nextOffset,
      });
      const mapped = rows as Record<string, unknown>[];
      setResults((current) => (append ? [...current, ...mapped] : mapped));
      setOffset(nextOffset);
      setHasMore(mapped.length === 20);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed");
      if (!append) setResults([]);
    } finally {
      setLoading(false);
    }
  }, [callRpc, query, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => void runSearch(0, false), 300);
    return () => window.clearTimeout(timer);
  }, [runSearch]);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Library</p>
          <h3>Insert {type}</h3>
        </div>
      </div>
      <label>
        Search
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${type}s`}
        />
      </label>
      {loading && <p className="text-muted">Searching…</p>}
      {error && (
        <div className="notice-card notice-card--danger">
          <p>{error}</p>
          <button className="button button--small button--secondary" type="button" onClick={() => void runSearch(offset, offset > 0)}>
            Retry
          </button>
        </div>
      )}
      {!loading && query.trim() && !error && results.length === 0 && (
        <p className="text-muted">
          {type === "activity"
            ? "No published activities found. Publish an item from Content Library first."
            : `No published ${type} results found.`}
        </p>
      )}
      {results.length > 0 && (
        <ul className="inline-search__results">
          {results.map((item) => (
            <li key={String(item.id)}>
              <div>
                <strong>{String(item.title ?? "")}</strong>
                <div className="text-muted">
                  <code>{String(item.stable_key ?? "")}</code> · v{String(item.version ?? "1.0.0")}
                </div>
              </div>
              <button className="button button--small button--primary" type="button" onClick={() => onInsert(item)}>
                Insert
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasMore && !loading && (
        <button className="button button--small button--secondary" type="button" onClick={() => void runSearch(offset + 20, true)}>
          Load more
        </button>
      )}
    </section>
  );
}

function SessionTimeline({
  activities,
  references,
}: {
  activities: ContentActivity[];
  references: CompositionReference[];
}) {
  const refMap = useMemo(() => new Map(references.map((reference) => [reference.instanceId, reference])), [references]);
  if (activities.length === 0) return <p className="text-muted">No activities in this session.</p>;
  return (
    <div className="session-timeline">
      {activities.map((activity, index) => {
        const duration = resolveActivityEstimatedDuration(activity, refMap.get(activity.id));
        return (
          <div key={activity.id} className="timeline-item">
            <div className="timeline-item__marker">
              <span className="timeline-dot" />
              {index < activities.length - 1 && <span className="timeline-line" />}
            </div>
            <div className="timeline-item__content">
              <strong>{String(activity.metadata.title || activity.id)}</strong>
              <span className="timeline-item__duration">
                <DurationValue minutes={duration} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TemplateEditor({
  record,
  onSave,
  onDuplicate,
  onArchive,
  onRestore,
  onUse,
}: {
  record: CustomTemplateRecord;
  onSave: (record: CustomTemplateRecord) => Promise<void>;
  onDuplicate: (record: CustomTemplateRecord) => Promise<void>;
  onArchive: (record: CustomTemplateRecord) => Promise<void>;
  onRestore: (record: CustomTemplateRecord) => Promise<void>;
  onUse: (record: CustomTemplateRecord) => void;
}) {
  const [title, setTitle] = useState(record.title);
  const [description, setDescription] = useState(record.description ?? "");
  const [status, setStatus] = useState(record.status);
  const [weekTitle, setWeekTitle] = useState(record.specification.weekTitle);
  const [tags, setTags] = useState(record.tags.join(", "));
  const [learningIntent, setLearningIntent] = useState(record.specification.learningIntent ?? "");
  const [sessions, setSessions] = useState<CompositionTemplateSessionSpec[]>(record.specification.sessions);

  const updateSession = useCallback((index: number, patch: Partial<CompositionTemplateSessionSpec>) => {
    setSessions((current) => current.map((session, sessionIndex) => (
      sessionIndex === index ? { ...session, ...patch } : session
    )));
  }, []);

  const updateSlot = useCallback((sessionIndex: number, slotIndex: number, patch: Partial<CompositionTemplateSessionSpec["activitySlots"][number]>) => {
    setSessions((current) => current.map((session, sIndex) => {
      if (sIndex !== sessionIndex) return session;
      return {
        ...session,
        activitySlots: session.activitySlots.map((slot, index) => (
          index === slotIndex ? { ...slot, ...patch } : slot
        )),
      };
    }));
  }, []);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Custom Template</p>
          <h3>{record.title}</h3>
        </div>
        <StatusBadge label={record.status} tone={toneForStatus(record.status)} />
      </div>
      <label>Template name<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label>Week title<input value={weekTitle} onChange={(event) => setWeekTitle(event.target.value)} /></label>
      <label>Learning intent<input value={learningIntent} onChange={(event) => setLearningIntent(event.target.value)} /></label>
      <label>Status
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="draft">Draft</option>
          <option value="published">Active</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="comma, separated" /></label>
      {sessions.map((session, sessionIndex) => (
        <div key={`${record.id}-session-${sessionIndex}`} className="subpanel">
          <h4>Session {sessionIndex + 1}</h4>
          <label>Title<input value={session.title} onChange={(event) => updateSession(sessionIndex, { title: event.target.value })} /></label>
          <label>Kind<input value={session.kind} onChange={(event) => updateSession(sessionIndex, { kind: event.target.value })} /></label>
          {session.activitySlots.map((slot, slotIndex) => (
            <div key={`${record.id}-slot-${sessionIndex}-${slotIndex}`} className="subpanel subpanel--muted">
              <label>Slot label<input value={slot.label} onChange={(event) => updateSlot(sessionIndex, slotIndex, { label: event.target.value })} /></label>
              <label>Activity type<input value={slot.type} onChange={(event) => updateSlot(sessionIndex, slotIndex, { type: event.target.value })} /></label>
              <label>Duration minutes<input type="number" min={1} max={480} value={slot.estimatedDurationMinutes ?? ""} onChange={(event) => updateSlot(sessionIndex, slotIndex, { estimatedDurationMinutes: event.target.value ? Number(event.target.value) : null })} /></label>
            </div>
          ))}
        </div>
      ))}
      <div className="button-row">
        <button
          className="button button--primary"
          type="button"
          onClick={() => void onSave({
            ...record,
            title,
            description,
            status,
            tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
            specification: {
              ...record.specification,
              weekTitle,
              learningIntent: learningIntent || null,
              sessions,
            },
          })}
        >
          Save
        </button>
        <button className="button button--secondary" type="button" onClick={() => void onDuplicate(record)}>Duplicate</button>
        <button className="button button--secondary" type="button" onClick={() => onUse(record)}>Use</button>
        {record.status === "archived"
          ? <button className="button button--secondary" type="button" onClick={() => void onRestore(record)}>Restore</button>
          : <button className="button button--secondary" type="button" onClick={() => void onArchive(record)}>Archive</button>}
      </div>
    </section>
  );
}

function RecipeEditor({
  record,
  onSave,
  onDuplicate,
  onArchive,
  onRestore,
  onUse,
}: {
  record: CustomRecipeRecord;
  onSave: (record: CustomRecipeRecord) => Promise<void>;
  onDuplicate: (record: CustomRecipeRecord) => Promise<void>;
  onArchive: (record: CustomRecipeRecord) => Promise<void>;
  onRestore: (record: CustomRecipeRecord) => Promise<void>;
  onUse: (record: CustomRecipeRecord) => void;
}) {
  const [title, setTitle] = useState(record.title);
  const [description, setDescription] = useState(record.description ?? "");
  const [status, setStatus] = useState(record.status);
  const [kind, setKind] = useState(record.specification.kind);
  const [tags, setTags] = useState(record.tags.join(", "));
  const [slots, setSlots] = useState(record.specification.slots);

  const updateSlot = useCallback((slotIndex: number, patch: Partial<RecipeSpec["slots"][number]>) => {
    setSlots((current) => current.map((slot, index) => (index === slotIndex ? { ...slot, ...patch } : slot)));
  }, []);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Custom Recipe</p>
          <h3>{record.title}</h3>
        </div>
        <StatusBadge label={record.status} tone={toneForStatus(record.status)} />
      </div>
      <label>Recipe name<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label>Session kind<input value={kind} onChange={(event) => setKind(event.target.value)} /></label>
      <label>Status
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="draft">Draft</option>
          <option value="published">Active</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="comma, separated" /></label>
      {slots.map((slot, slotIndex) => (
        <div key={`${record.id}-slot-${slotIndex}`} className="subpanel">
          <h4>Slot {slotIndex + 1}</h4>
          <label>Slot label<input value={slot.label} onChange={(event) => updateSlot(slotIndex, { label: event.target.value })} /></label>
          <label>Activity type<input value={slot.type} onChange={(event) => updateSlot(slotIndex, { type: event.target.value })} /></label>
          <label>Duration minutes<input type="number" min={1} max={480} value={slot.estimatedDurationMinutes ?? ""} onChange={(event) => updateSlot(slotIndex, { estimatedDurationMinutes: event.target.value ? Number(event.target.value) : null })} /></label>
        </div>
      ))}
      <div className="button-row">
        <button
          className="button button--primary"
          type="button"
          onClick={() => void onSave({
            ...record,
            title,
            description,
            status,
            tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
            specification: {
              ...record.specification,
              title,
              kind,
              slots,
            },
          })}
        >
          Save
        </button>
        <button className="button button--secondary" type="button" onClick={() => void onDuplicate(record)}>Duplicate</button>
        <button className="button button--secondary" type="button" onClick={() => onUse(record)}>Use</button>
        {record.status === "archived"
          ? <button className="button button--secondary" type="button" onClick={() => void onRestore(record)}>Restore</button>
          : <button className="button button--secondary" type="button" onClick={() => void onArchive(record)}>Archive</button>}
      </div>
    </section>
  );
}

export function CompositionPage() {
  const { data, dataSource, callRpc, saveCurriculumDraft } = useAdminPortal();
  const isLive = dataSource.mode === "live" && dataSource.state === "ready";
  const hubs = data?.hubs ?? [];
  const links = data?.hubCourseLinks ?? [];
  const productionHubs = useMemo(
    () => hubs.filter((hub) => hub.hubCode !== "composition-preview"),
    [hubs],
  );
  const defaultHub = productionHubs[0] ?? hubs[0] ?? null;
  const defaultLink = links.find((link) => link.hubCode === defaultHub?.hubCode) ?? links[0] ?? null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [draft, setDraft] = useState<CompositionDraft>(() =>
    defaultHub
      ? emptyCompositionDraft(emptyPackage(defaultHub.hubCode, defaultHub.hubName, defaultLink?.courseKey || "course"))
      : emptyCompositionDraft(emptyPackage("composition-preview", "Composition Preview", "preview")),
  );
  const [savedDraft, setSavedDraft] = useState<AuthoringDraft | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplateRecord[]>([]);
  const [customRecipes, setCustomRecipes] = useState<CustomRecipeRecord[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedBuiltInTemplate, setSelectedBuiltInTemplate] = useState("weekly-lesson");
  const [selectedBuiltInRecipe, setSelectedBuiltInRecipe] = useState("revision-session");
  const [selectedCustomTemplateId, setSelectedCustomTemplateId] = useState("");
  const [selectedCustomRecipeId, setSelectedCustomRecipeId] = useState("");
  const [showActivitySearch, setShowActivitySearch] = useState(false);
  const [showQuestionSearch, setShowQuestionSearch] = useState(false);
  const [showResourceSearch, setShowResourceSearch] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pkg = draft.package;

  useEffect(() => {
    if (!defaultHub || pkg.hub.id !== "composition-preview") return;
    setDraft((current) => ({
      ...current,
      package: emptyPackage(defaultHub.hubCode, defaultHub.hubName, defaultLink?.courseKey || "course"),
    }));
  }, [defaultHub, defaultLink?.courseKey, pkg.hub.id]);

  const setHubContext = useCallback((hubCode: string) => {
    const hub = hubs.find((item) => item.hubCode === hubCode);
    const link = links.find((item) => item.hubCode === hubCode);
    const courseKey = link?.courseKey || String(pkg.curriculum.metadata.course || "course");
    const curriculumId = `${hubCode}-curriculum`;
    setDraft((current) => ({
      ...current,
      package: {
        ...current.package,
        hub: {
          ...current.package.hub,
          id: hubCode,
          metadata: { ...current.package.hub.metadata, name: hub?.hubName || hubCode },
          relationships: { ...current.package.hub.relationships, curriculum: curriculumId },
        },
        curriculum: {
          ...current.package.curriculum,
          id: curriculumId,
          metadata: {
            ...current.package.curriculum.metadata,
            course: courseKey,
            title: `${hub?.hubName || hubCode} curriculum`,
          },
          relationships: { ...current.package.curriculum.relationships },
        },
      },
    }));
    setSavedDraft(null);
    setSaveMessage(null);
  }, [hubs, links, pkg.curriculum.metadata.course]);

  useEffect(() => {
    const persistedDraft = readPersistedDraft();
    if (!persistedDraft) return;
    const persistedRefs = loadLocalCompositionState(persistedDraft.id);
    setSavedDraft(persistedDraft);
    setDraft(hydrateCompositionFromDraft(persistedDraft, persistedRefs));
  }, []);

  const fetchCatalog = useCallback(async () => {
    if (!isLive) return;
    setLoadingCatalog(true);
    setCatalogMessage(null);
    try {
      const [templateRows, recipeRows] = await Promise.all([
        callRpc("list_composition_templates", { p_include_archived: includeArchived }),
        callRpc("list_curriculum_recipes", { p_include_archived: includeArchived }),
      ]);
      setCustomTemplates((templateRows as Record<string, unknown>[]).map(parseCustomTemplateRecord));
      setCustomRecipes((recipeRows as Record<string, unknown>[]).map(parseCustomRecipeRecord));
    } catch (caught) {
      setCatalogMessage(caught instanceof Error ? caught.message : "Unable to load composition catalog");
    } finally {
      setLoadingCatalog(false);
    }
  }, [callRpc, includeArchived, isLive]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const selectedWeekRecord = useMemo(
    () => pkg.weeks.find((week) => week.id === selectedWeek) ?? null,
    [pkg.weeks, selectedWeek],
  );
  const selectedSessionRecord = useMemo(
    () => pkg.sessions.find((session) => session.id === selectedSession) ?? null,
    [pkg.sessions, selectedSession],
  );
  const selectedActivityRecord = useMemo(
    () => pkg.activities.find((activity) => activity.id === selectedActivity) ?? null,
    [pkg.activities, selectedActivity],
  );
  const selectedActivityReference = useMemo(
    () => draft.references.find((reference) => reference.instanceId === selectedActivity) ?? null,
    [draft.references, selectedActivity],
  );

  const selectedWeekSessions = useMemo(() => {
    if (!selectedWeekRecord) return [];
    const sessionIds = Array.isArray(selectedWeekRecord.relationships.sessions)
      ? selectedWeekRecord.relationships.sessions as string[]
      : [];
    return sessionIds
      .map((id) => pkg.sessions.find((session) => session.id === id))
      .filter((session): session is ContentDocument => session != null);
  }, [pkg.sessions, selectedWeekRecord]);

  const selectedSessionActivities = useMemo(() => {
    if (!selectedSessionRecord) return [];
    const activityIds = Array.isArray(selectedSessionRecord.relationships.activities)
      ? selectedSessionRecord.relationships.activities as string[]
      : [];
    return activityIds
      .map((id) => pkg.activities.find((activity) => activity.id === id))
      .filter((activity): activity is ContentActivity => activity != null);
  }, [pkg.activities, selectedSessionRecord]);

  const selectedActivityQuestionBlocks = useMemo(() => {
    if (!selectedActivityRecord) return [];
    return selectedActivityRecord.blocks.filter((block) => block.content.questionId);
  }, [selectedActivityRecord]);

  const coverage = useMemo(() => {
    const declared = pkg.learningOutcomes.map((outcome) => outcome.id);
    return analyseCoverage(pkg, declared);
  }, [pkg]);
  const difficulty = useMemo(() => analyseDifficultyBalance(pkg), [pkg]);
  const sessionStats = useMemo(
    () => (selectedSession ? computeSessionStats(pkg, selectedSession, draft.references) : null),
    [draft.references, pkg, selectedSession],
  );
  const validation = useMemo(() => publicationGate(materialise(draft)), [draft]);

  const upsertActivityMetadata = useCallback((activityId: string, field: string, value: unknown) => {
    setDraft((current) => ({
      ...current,
      package: {
        ...current.package,
        activities: current.package.activities.map((activity) => (
          activity.id === activityId
            ? { ...activity, metadata: { ...activity.metadata, [field]: value } }
            : activity
        )),
      },
    }));
  }, []);

  const saveCompositionState = useCallback(async (nextDraft: AuthoringDraft, references: CompositionReference[]) => {
    persistDraftSnapshot(nextDraft);
    persistLocalCompositionState(nextDraft.id, references);
    if (isLive) {
      await callRpc("save_composition_draft_state", {
        p_curriculum_draft_id: nextDraft.id,
        p_references: serialiseCompositionReferences(references),
      });
    }
  }, [callRpc, isLive]);

  const restoreLastSaved = useCallback(async () => {
    const persisted = readPersistedDraft();
    if (!persisted) {
      setSaveMessage("No saved composition draft found.");
      return;
    }
    try {
      if (isLive) {
        const [draftRow, refRows] = await Promise.all([
          callRpc("get_curriculum_draft", { p_draft_id: persisted.id }),
          callRpc("get_composition_draft_state", { p_curriculum_draft_id: persisted.id }),
        ]);
        const remoteRecord = Array.isArray(draftRow) ? draftRow[0] as Record<string, unknown> : null;
        if (remoteRecord) {
          const restoredDraft: AuthoringDraft = {
            ...persisted,
            id: String(remoteRecord.id ?? persisted.id),
            hubId: String(remoteRecord.hub_code ?? persisted.hubId),
            courseKey: String(remoteRecord.course_key ?? persisted.courseKey),
            title: String(remoteRecord.title ?? persisted.title),
            status: String(remoteRecord.lifecycle_status ?? persisted.status) as AuthoringDraft["status"],
            remoteRevision: Number(remoteRecord.revision ?? persisted.remoteRevision),
            updatedAt: String(remoteRecord.updated_at ?? persisted.updatedAt),
            package: remoteRecord.package as AuthoringDraft["package"],
          };
          const references = parseCompositionReferences(refRows as Record<string, unknown>[]);
          setSavedDraft(restoredDraft);
          setDraft(hydrateCompositionFromDraft(restoredDraft, references));
          setSaveMessage(`Reopened draft ${restoredDraft.id}.`);
          return;
        }
      }
      const references = loadLocalCompositionState(persisted.id);
      setSavedDraft(persisted);
      setDraft(hydrateCompositionFromDraft(persisted, references));
      setSaveMessage(`Reopened local draft ${persisted.id}.`);
    } catch (caught) {
      setSaveMessage(caught instanceof Error ? caught.message : "Unable to reopen saved composition");
    }
  }, [callRpc, isLive]);

  const handleSaveComposition = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    if (!isLive) {
      setSaving(false);
      setSaveMessage("Saving a curriculum draft requires a live platform connection. Composition does not publish.");
      return;
    }
    const hubId = String(pkg.hub.id);
    if (hubId === "composition-preview") {
      setSaving(false);
      setSaveMessage("Select a real hub and course before saving a curriculum draft.");
      return;
    }
    try {
      const hubName = String(pkg.hub.metadata.name || hubId);
      const courseKey = String(pkg.curriculum.metadata.course || "course");
      const actor = data?.teachers?.[0]?.displayName ?? "author";
      const nextDraft = savedDraft
        ? updateDraftFromComposition(savedDraft, draft)
        : compositionToDraft(draft, hubId, hubName, courseKey, actor);
      const persistedDraft = {
        ...nextDraft,
        remoteRevision: (await saveCurriculumDraft(nextDraft)).revision,
      };
      await saveCompositionState(persistedDraft, draft.references);
      setSavedDraft(persistedDraft);
      setSaveMessage(`Saved as curriculum draft, revision ${persistedDraft.remoteRevision}. Open Curriculum Authoring to validate, approve and publish.`);
    } catch (caught) {
      setSaveMessage(caught instanceof Error ? caught.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [data, draft, isLive, pkg, saveCompositionState, saveCurriculumDraft, savedDraft]);

  const createDefaultTemplate = useCallback(async () => {
    if (!isLive) return;
    const title = `Custom Template ${customTemplates.length + 1}`;
    await callRpc("save_composition_template", {
      p_stable_key: makeStableKey(title, `custom-template-${customTemplates.length + 1}`),
      p_title: title,
      p_template_type: "custom",
      p_description: "New custom composition template",
      p_specification: {
        weekTitle: title,
        sessions: [{ title: "Lesson", kind: "session", activitySlots: [{ type: "activity", label: "Activity", estimatedDurationMinutes: null }] }],
      },
      p_status: "draft",
      p_tags: [],
      p_version: "1.0.0",
    });
    await fetchCatalog();
  }, [callRpc, customTemplates.length, fetchCatalog, isLive]);

  const createDefaultRecipe = useCallback(async () => {
    if (!isLive) return;
    const title = `Custom Recipe ${customRecipes.length + 1}`;
    await callRpc("save_curriculum_recipe", {
      p_stable_key: makeStableKey(title, `custom-recipe-${customRecipes.length + 1}`),
      p_title: title,
      p_recipe_type: "custom",
      p_description: "New custom curriculum recipe",
      p_specification: {
        title,
        kind: "session",
        slots: [{ type: "activity", label: "Activity", estimatedDurationMinutes: null }],
      },
      p_status: "draft",
      p_tags: [],
      p_version: "1.0.0",
    });
    await fetchCatalog();
  }, [callRpc, customRecipes.length, fetchCatalog, isLive]);

  const saveTemplate = useCallback(async (record: CustomTemplateRecord) => {
    await callRpc("save_composition_template", {
      p_id: record.id,
      p_stable_key: record.stableKey,
      p_title: record.title,
      p_template_type: record.templateType,
      p_description: record.description,
      p_specification: record.specification,
      p_tags: record.tags,
      p_status: record.status,
      p_version: record.version,
    });
    await fetchCatalog();
  }, [callRpc, fetchCatalog]);

  const duplicateTemplate = useCallback(async (record: CustomTemplateRecord) => {
    await callRpc("duplicate_composition_template", {
      p_id: record.id,
      p_stable_key: makeStableKey(`${record.stableKey}-copy`, `${record.stableKey}-copy`),
      p_title: `${record.title} Copy`,
    });
    await fetchCatalog();
  }, [callRpc, fetchCatalog]);

  const archiveTemplate = useCallback(async (record: CustomTemplateRecord) => {
    await callRpc("archive_composition_template", { p_id: record.id });
    await fetchCatalog();
  }, [callRpc, fetchCatalog]);

  const restoreTemplate = useCallback(async (record: CustomTemplateRecord) => {
    await callRpc("restore_composition_template", { p_id: record.id });
    await fetchCatalog();
  }, [callRpc, fetchCatalog]);

  const saveRecipe = useCallback(async (record: CustomRecipeRecord) => {
    await callRpc("save_curriculum_recipe", {
      p_id: record.id,
      p_stable_key: record.stableKey,
      p_title: record.title,
      p_recipe_type: record.recipeType,
      p_description: record.description,
      p_specification: record.specification,
      p_tags: record.tags,
      p_status: record.status,
      p_version: record.version,
    });
    await fetchCatalog();
  }, [callRpc, fetchCatalog]);

  const duplicateRecipe = useCallback(async (record: CustomRecipeRecord) => {
    await callRpc("duplicate_curriculum_recipe", {
      p_id: record.id,
      p_stable_key: makeStableKey(`${record.stableKey}-copy`, `${record.stableKey}-copy`),
      p_title: `${record.title} Copy`,
    });
    await fetchCatalog();
  }, [callRpc, fetchCatalog]);

  const archiveRecipe = useCallback(async (record: CustomRecipeRecord) => {
    await callRpc("archive_curriculum_recipe", { p_id: record.id });
    await fetchCatalog();
  }, [callRpc, fetchCatalog]);

  const restoreRecipe = useCallback(async (record: CustomRecipeRecord) => {
    await callRpc("restore_curriculum_recipe", { p_id: record.id });
    await fetchCatalog();
  }, [callRpc, fetchCatalog]);

  const handleUseTemplate = useCallback((record: CustomTemplateRecord) => {
    setDraft((current) => applyCustomCompositionTemplate(current, record.specification, current.package.weeks.length + 1));
  }, []);

  const handleUseRecipe = useCallback((record: CustomRecipeRecord) => {
    if (!selectedWeek) return;
    setDraft((current) => applyCustomRecipe(current, selectedWeek, record.specification));
  }, [selectedWeek]);

  const handleInsertActivity = useCallback((item: Record<string, unknown>) => {
    if (!selectedSession) return;
    const insert: LibraryActivityInsert = {
      stableKey: String(item.stable_key ?? ""),
      libraryId: String(item.id ?? ""),
      title: String(item.title ?? ""),
      activityType: String(item.item_type ?? ""),
      difficulty: "standard",
      familyId: null,
      summary: null,
      version: String(item.version ?? "1.0.0"),
      learningOutcomes: [],
      blocks: [],
      estimatedDurationMinutes: typeof item.estimated_time_minutes === "number" ? Number(item.estimated_time_minutes) : null,
    };
    setDraft((current) => insertActivityFromLibrary(current, selectedSession, insert));
    setShowActivitySearch(false);
  }, [selectedSession]);

  const handleInsertQuestion = useCallback((item: Record<string, unknown>) => {
    if (!selectedActivity) return;
    const question: LibraryQuestion = {
      id: String(item.id ?? ""),
      stableKey: String(item.stable_key ?? ""),
      title: String(item.title ?? ""),
      questionText: String(item.title ?? ""),
      questionType: String(item.item_type ?? "single"),
      difficulty: 3,
      marks: 1,
      content: {},
      tags: [],
      learningOutcomes: [],
    };
    setDraft((current) => insertQuestionFromLibrary(current, selectedActivity, question));
    setShowQuestionSearch(false);
  }, [selectedActivity]);

  const handleInsertResource = useCallback((item: Record<string, unknown>) => {
    if (!selectedActivity) return;
    const resource: LibraryResource = {
      id: String(item.id ?? ""),
      stableKey: String(item.stable_key ?? ""),
      title: String(item.title ?? ""),
      resourceType: String(item.item_type ?? "resource"),
      url: null,
      description: null,
    };
    setDraft((current) => attachResourceFromLibrary(current, selectedActivity, resource));
    setShowResourceSearch(false);
  }, [selectedActivity]);

  const handleWeekDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ordered = arrayMove(pkg.weeks.map((week) => week.id), pkg.weeks.findIndex((week) => week.id === active.id), pkg.weeks.findIndex((week) => week.id === over.id));
    setDraft((current) => reorderWeeks(current, ordered));
  }, [pkg.weeks]);

  const handleSessionDragEnd = useCallback((event: DragEndEvent) => {
    if (!selectedWeekRecord) return;
    const sessionIds = Array.isArray(selectedWeekRecord.relationships.sessions)
      ? selectedWeekRecord.relationships.sessions as string[]
      : [];
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ordered = arrayMove(sessionIds, sessionIds.indexOf(String(active.id)), sessionIds.indexOf(String(over.id)));
    setDraft((current) => reorderSessions(current, selectedWeekRecord.id, ordered));
  }, [selectedWeekRecord]);

  const handleActivityDragEnd = useCallback((event: DragEndEvent) => {
    if (!selectedSessionRecord) return;
    const activityIds = Array.isArray(selectedSessionRecord.relationships.activities)
      ? selectedSessionRecord.relationships.activities as string[]
      : [];
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ordered = arrayMove(activityIds, activityIds.indexOf(String(active.id)), activityIds.indexOf(String(over.id)));
    setDraft((current) => reorderActivities(current, selectedSessionRecord.id, ordered));
  }, [selectedSessionRecord]);

  const handleQuestionDragEnd = useCallback((event: DragEndEvent) => {
    if (!selectedActivityRecord) return;
    const blockIds = selectedActivityQuestionBlocks.map((block) => block.id);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ordered = arrayMove(blockIds, blockIds.indexOf(String(active.id)), blockIds.indexOf(String(over.id)));
    setDraft((current) => reorderQuestions(current, selectedActivityRecord.id, ordered));
  }, [selectedActivityQuestionBlocks, selectedActivityRecord]);

  const applyBuiltInTemplate = useCallback(() => {
    setDraft((current) => applyCompositionTemplate(current, selectedBuiltInTemplate, current.package.weeks.length + 1));
  }, [selectedBuiltInTemplate]);

  const applyBuiltInRecipe = useCallback(() => {
    if (!selectedWeek) return;
    setDraft((current) => applyRecipe(current, selectedWeek, selectedBuiltInRecipe));
  }, [selectedBuiltInRecipe, selectedWeek]);

  const selectedCustomTemplate = customTemplates.find((template) => template.id === selectedCustomTemplateId) ?? null;
  const selectedCustomRecipe = customRecipes.find((recipe) => recipe.id === selectedCustomRecipeId) ?? null;

  const durationState = selectedActivityRecord
    ? durationOverrideState(selectedActivityRecord, selectedActivityReference ?? undefined)
    : null;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Assemble reusable assets into a curriculum draft</p>
          <h1>Composition</h1>
          <p>Assemble Content Library assets into a standard curriculum draft. Publication happens in Curriculum authoring. This page does not publish to learners.</p>
        </div>
        <div className="page-header__actions">
          <button className="button button--secondary" type="button" onClick={() => setShowPreview((value) => !value)}>
            {showPreview ? "Hide Package" : "View Final Package"}
          </button>
          {savedDraft && (
            <button className="button button--secondary" type="button" onClick={() => setShowDiff((value) => !value)}>
              {showDiff ? "Hide Diff" : "Compare Draft"}
            </button>
          )}
          <button className="button button--secondary" type="button" onClick={() => void restoreLastSaved()}>
            Reopen Saved
          </button>
          <button className="button button--primary" type="button" onClick={() => void handleSaveComposition()} disabled={saving}>
            {saving ? "Saving…" : savedDraft ? "Update Curriculum Draft" : "Save as Curriculum Draft"}
          </button>
        </div>
      </header>

      <AuthoringAreaLinks current="composition" />

      {!isLive ? (
        <div className="notice-card notice-card--warning">
          <strong>Platform connection required</strong>
          <p>Composition saves standard curriculum drafts through the live admin_api. There is no production mock mode and this page does not publish.</p>
        </div>
      ) : null}

      {saveMessage && (
        <div className={`notice-card ${/failed|requires a live|conflict|elsewhere|Select a real hub/i.test(saveMessage) ? "notice-card--danger" : "notice-card--info"}`}>
          <p>{saveMessage}</p>
        </div>
      )}

      <section className="panel">
        <div className="toolbar">
          <div>
            <label htmlFor="composition-hub">Hub context</label>
            <select
              id="composition-hub"
              value={pkg.hub.id}
              onChange={(event) => setHubContext(event.target.value)}
            >
              {(productionHubs.length ? productionHubs : hubs).map((hub: HubRecord) => (
                <option key={hub.hubCode} value={hub.hubCode}>{hub.hubName}</option>
              ))}
              {!productionHubs.length && !hubs.length ? (
                <option value={pkg.hub.id}>{String(pkg.hub.metadata.name || pkg.hub.id)}</option>
              ) : null}
            </select>
          </div>
          <div>
            <label htmlFor="composition-course">Course</label>
            <select
              id="composition-course"
              value={String(pkg.curriculum.metadata.course || "")}
              onChange={(event) => setDraft((current) => ({
                ...current,
                package: {
                  ...current.package,
                  curriculum: {
                    ...current.package.curriculum,
                    metadata: { ...current.package.curriculum.metadata, course: event.target.value },
                  },
                },
              }))}
            >
              {links.filter((link) => link.hubCode === pkg.hub.id).map((link: HubCourseLinkRecord) => (
                <option key={link.courseKey} value={link.courseKey}>{link.courseTitle}</option>
              ))}
              {!links.some((link) => link.hubCode === pkg.hub.id) ? (
                <option value={String(pkg.curriculum.metadata.course || "course")}>
                  {String(pkg.curriculum.metadata.course || "course")}
                </option>
              ) : null}
            </select>
          </div>
          <span className="toolbar__count" role="status">
            Target: {pkg.hub.id} / {String(pkg.curriculum.metadata.course || "course")}
          </span>
        </div>
      </section>

      {showPreview && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Debug</p>
              <h2>Canonical Package JSON</h2>
            </div>
          </div>
          <pre className="package-preview">{previewPackageJson(draft)}</pre>
        </section>
      )}

      {showDiff && savedDraft && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Comparison</p>
              <h2>Current Draft vs Last Saved Draft</h2>
            </div>
          </div>
          <PackageDiffPanel current={materialise(draft)} previous={savedDraft.package} />
        </section>
      )}

      <div className="composition-layout">
        <section className="composition-builder panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Builder</p>
              <h2>Curriculum Structure</h2>
            </div>
            <StatusBadge label={validation.ok ? "Valid" : `${validation.issues.length} validation issues`} tone={validation.ok ? "positive" : "warning"} />
          </div>

          <div className="builder-toolbar">
            <div className="builder-toolbar__group">
              <label>Built-in week template
                <select value={selectedBuiltInTemplate} onChange={(event) => setSelectedBuiltInTemplate(event.target.value)}>
                  {Object.entries(BUILT_IN_TEMPLATES).map(([key, spec]) => (
                    <option key={key} value={key}>{spec.weekTitle}</option>
                  ))}
                </select>
              </label>
              <button className="button button--small button--primary" type="button" onClick={applyBuiltInTemplate}>Add Built-in Week</button>
            </div>
            <div className="builder-toolbar__group">
              <label>Custom week template
                <select value={selectedCustomTemplateId} onChange={(event) => setSelectedCustomTemplateId(event.target.value)}>
                  <option value="">Select custom template</option>
                  {customTemplates.filter((template) => template.status !== "archived").map((template) => (
                    <option key={template.id} value={template.id}>{template.title}</option>
                  ))}
                </select>
              </label>
              <button className="button button--small button--secondary" type="button" onClick={() => selectedCustomTemplate && handleUseTemplate(selectedCustomTemplate)} disabled={!selectedCustomTemplate}>
                Add Custom Week
              </button>
            </div>
          </div>

          <div className="builder-toolbar">
            <div className="builder-toolbar__group">
              <label>Built-in session recipe
                <select value={selectedBuiltInRecipe} onChange={(event) => setSelectedBuiltInRecipe(event.target.value)}>
                  {Object.entries(BUILT_IN_RECIPES).map(([key, spec]) => (
                    <option key={key} value={key}>{spec.title}</option>
                  ))}
                </select>
              </label>
              <button className="button button--small button--secondary" type="button" onClick={applyBuiltInRecipe} disabled={!selectedWeek}>
                Add Built-in Session
              </button>
            </div>
            <div className="builder-toolbar__group">
              <label>Custom session recipe
                <select value={selectedCustomRecipeId} onChange={(event) => setSelectedCustomRecipeId(event.target.value)}>
                  <option value="">Select custom recipe</option>
                  {customRecipes.filter((recipe) => recipe.status !== "archived").map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>{recipe.title}</option>
                  ))}
                </select>
              </label>
              <button className="button button--small button--secondary" type="button" onClick={() => selectedCustomRecipe && handleUseRecipe(selectedCustomRecipe)} disabled={!selectedCustomRecipe || !selectedWeek}>
                Add Custom Session
              </button>
            </div>
          </div>

          <div className="builder-toolbar__actions">
            <button className="button button--small button--secondary" type="button" onClick={() => setShowActivitySearch((value) => !value)} disabled={!selectedSession}>Insert Activity</button>
            <button className="button button--small button--secondary" type="button" onClick={() => setShowQuestionSearch((value) => !value)} disabled={!selectedActivity}>Insert Question</button>
            <button className="button button--small button--secondary" type="button" onClick={() => setShowResourceSearch((value) => !value)} disabled={!selectedActivity}>Attach Resource</button>
          </div>

          {showActivitySearch && <InlineLibrarySearch type="activity" callRpc={callRpc} onInsert={handleInsertActivity} />}
          {showQuestionSearch && <InlineLibrarySearch type="question" callRpc={callRpc} onInsert={handleInsertQuestion} />}
          {showResourceSearch && <InlineLibrarySearch type="resource" callRpc={callRpc} onInsert={handleInsertResource} />}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWeekDragEnd}>
            <SortableContext items={pkg.weeks.map((week) => week.id)} strategy={verticalListSortingStrategy}>
              <div className="builder-tree">
                {pkg.weeks.map((week, weekIndex) => (
                  <SortableShell key={week.id} id={week.id}>
                    {({ setNodeRef, style, listeners, attributes }) => (
                      <div ref={setNodeRef} style={style} className={`builder-week${selectedWeek === week.id ? " builder-week--selected" : ""}`}>
                        <div className="builder-week__header">
                          <button className="drag-handle button button--small button--secondary" type="button" aria-label={`Reorder ${String(week.metadata.title ?? week.id)}`} {...attributes} {...listeners}>Drag</button>
                          <button className="button button--small button--secondary" type="button" onClick={() => setSelectedWeek(week.id)}>{String(week.metadata.title || week.id)}</button>
                          <button className="button button--small button--secondary" type="button" onClick={() => {
                            const ordered = moveItem(pkg.weeks.map((item) => item.id), weekIndex, -1);
                            setDraft((current) => reorderWeeks(current, ordered as string[]));
                          }}>Move Up</button>
                          <button className="button button--small button--secondary" type="button" onClick={() => {
                            const ordered = moveItem(pkg.weeks.map((item) => item.id), weekIndex, 1);
                            setDraft((current) => reorderWeeks(current, ordered as string[]));
                          }}>Move Down</button>
                        </div>
                      </div>
                    )}
                  </SortableShell>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {selectedWeekRecord && (
            <section className="subpanel">
              <h3>Sessions in {String(selectedWeekRecord.metadata.title || selectedWeekRecord.id)}</h3>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSessionDragEnd}>
                <SortableContext items={selectedWeekSessions.map((session) => session.id)} strategy={verticalListSortingStrategy}>
                  {selectedWeekSessions.map((session, sessionIndex) => (
                    <SortableShell key={session.id} id={session.id}>
                      {({ setNodeRef, style, listeners, attributes }) => (
                        <div ref={setNodeRef} style={style} className={`builder-session${selectedSession === session.id ? " builder-session--selected" : ""}`}>
                          <button className="drag-handle button button--small button--secondary" type="button" aria-label={`Reorder ${String(session.metadata.title ?? session.id)}`} {...attributes} {...listeners}>Drag</button>
                          <button className="button button--small button--secondary" type="button" onClick={() => setSelectedSession(session.id)}>{String(session.metadata.title || session.id)}</button>
                          <button className="button button--small button--secondary" type="button" onClick={() => {
                            const sessionIds = selectedWeekSessions.map((item) => item.id);
                            const ordered = moveItem(sessionIds, sessionIndex, -1);
                            setDraft((current) => reorderSessions(current, selectedWeekRecord.id, ordered as string[]));
                          }}>Move Up</button>
                          <button className="button button--small button--secondary" type="button" onClick={() => {
                            const sessionIds = selectedWeekSessions.map((item) => item.id);
                            const ordered = moveItem(sessionIds, sessionIndex, 1);
                            setDraft((current) => reorderSessions(current, selectedWeekRecord.id, ordered as string[]));
                          }}>Move Down</button>
                        </div>
                      )}
                    </SortableShell>
                  ))}
                </SortableContext>
              </DndContext>
            </section>
          )}

          {selectedSessionRecord && (
            <section className="subpanel">
              <h3>Activities in {String(selectedSessionRecord.metadata.title || selectedSessionRecord.id)}</h3>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleActivityDragEnd}>
                <SortableContext items={selectedSessionActivities.map((activity) => activity.id)} strategy={verticalListSortingStrategy}>
                  {selectedSessionActivities.map((activity, activityIndex) => {
                    const reference = draft.references.find((item) => item.instanceId === activity.id);
                    return (
                      <SortableShell key={activity.id} id={activity.id}>
                        {({ setNodeRef, style, listeners, attributes }) => (
                          <div ref={setNodeRef} style={style} className={`builder-activity-item${selectedActivity === activity.id ? " builder-activity-item--selected" : ""}`}>
                            <button className="drag-handle button button--small button--secondary" type="button" aria-label={`Reorder ${String(activity.metadata.title ?? activity.id)}`} {...attributes} {...listeners}>Drag</button>
                            <button className="button button--small button--secondary" type="button" onClick={() => setSelectedActivity(activity.id)}>{String(activity.metadata.title || activity.id)}</button>
                            {reference && <StatusBadge label={reference.state} tone={toneForStatus(reference.state)} />}
                            <button className="button button--small button--secondary" type="button" onClick={() => {
                              const ids = selectedSessionActivities.map((item) => item.id);
                              const ordered = moveItem(ids, activityIndex, -1);
                              setDraft((current) => reorderActivities(current, selectedSessionRecord.id, ordered as string[]));
                            }}>Move Up</button>
                            <button className="button button--small button--secondary" type="button" onClick={() => {
                              const ids = selectedSessionActivities.map((item) => item.id);
                              const ordered = moveItem(ids, activityIndex, 1);
                              setDraft((current) => reorderActivities(current, selectedSessionRecord.id, ordered as string[]));
                            }}>Move Down</button>
                          </div>
                        )}
                      </SortableShell>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </section>
          )}

          {selectedActivityRecord && (
            <section className="subpanel">
              <h3>Questions in {String(selectedActivityRecord.metadata.title || selectedActivityRecord.id)}</h3>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleQuestionDragEnd}>
                <SortableContext items={selectedActivityQuestionBlocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                  {selectedActivityQuestionBlocks.map((block, blockIndex) => (
                    <SortableShell key={block.id} id={block.id}>
                      {({ setNodeRef, style, listeners, attributes }) => (
                        <div ref={setNodeRef} style={style} className="builder-question-item">
                          <button className="drag-handle button button--small button--secondary" type="button" aria-label={`Reorder ${block.id}`} {...attributes} {...listeners}>Drag</button>
                          <code>{block.id}</code>
                          <button className="button button--small button--secondary" type="button" onClick={() => {
                            const ids = selectedActivityQuestionBlocks.map((item) => item.id);
                            const ordered = moveItem(ids, blockIndex, -1);
                            setDraft((current) => reorderQuestions(current, selectedActivityRecord.id, ordered as string[]));
                          }}>Move Up</button>
                          <button className="button button--small button--secondary" type="button" onClick={() => {
                            const ids = selectedActivityQuestionBlocks.map((item) => item.id);
                            const ordered = moveItem(ids, blockIndex, 1);
                            setDraft((current) => reorderQuestions(current, selectedActivityRecord.id, ordered as string[]));
                          }}>Move Down</button>
                        </div>
                      )}
                    </SortableShell>
                  ))}
                </SortableContext>
              </DndContext>
            </section>
          )}

          {draft.references.length > 0 && (
            <section className="subpanel">
              <h3>Composition References</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Instance</th>
                      <th>Type</th>
                      <th>Version</th>
                      <th>State</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.references.map((reference) => (
                      <tr key={`${reference.libraryType}:${reference.instanceId}`}>
                        <td><code>{reference.instanceId}</code></td>
                        <td>{reference.libraryType}</td>
                        <td>{reference.libraryVersion}</td>
                        <td><StatusBadge label={reference.state} tone={toneForStatus(reference.state)} /></td>
                        <td>
                          {reference.state !== "detached" && (
                            <button className="button button--small button--secondary" type="button" onClick={() => setDraft((current) => detachFromLibrary(current, reference.instanceId))}>
                              Detach
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>

        <aside className="composition-sidebar">
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Template Management</p>
                <h2>Templates & Recipes</h2>
              </div>
              <label>
                <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
                Include archived
              </label>
            </div>
            <div className="button-row">
              <button className="button button--small button--primary" type="button" onClick={() => void createDefaultTemplate()} disabled={!isLive}>Create Template</button>
              <button className="button button--small button--primary" type="button" onClick={() => void createDefaultRecipe()} disabled={!isLive}>Create Recipe</button>
            </div>
            {loadingCatalog && <p className="text-muted">Loading composition catalog…</p>}
            {catalogMessage && <p className="text-muted">{catalogMessage}</p>}
          </section>

          {customTemplates.map((template) => (
            <TemplateEditor
              key={template.id}
              record={template}
              onSave={saveTemplate}
              onDuplicate={duplicateTemplate}
              onArchive={archiveTemplate}
              onRestore={restoreTemplate}
              onUse={handleUseTemplate}
            />
          ))}

          {customRecipes.map((recipe) => (
            <RecipeEditor
              key={recipe.id}
              record={recipe}
              onSave={saveRecipe}
              onDuplicate={duplicateRecipe}
              onArchive={archiveRecipe}
              onRestore={restoreRecipe}
              onUse={handleUseRecipe}
            />
          ))}

          {selectedActivityRecord && durationState && (
            <section className="panel">
              <h3>Duration</h3>
              <p>Inherited: <DurationValue minutes={durationState.inherited} /></p>
              <p>Resolved: <DurationValue minutes={durationState.resolved} /></p>
              {selectedActivityReference ? (
                <>
                  <label>Override duration minutes
                    <input
                      type="number"
                      min={1}
                      max={480}
                      value={durationState.overridden ? String(durationState.resolved ?? "") : ""}
                      onChange={(event) => {
                        const nextValue = event.target.value ? Number(event.target.value) : null;
                        if (nextValue == null) {
                          setDraft((current) => clearOverride(current, selectedActivityRecord.id, "estimatedDurationMinutes"));
                          return;
                        }
                        setDraft((current) => applyOverride(current, selectedActivityRecord.id, "estimatedDurationMinutes", nextValue));
                      }}
                    />
                  </label>
                  <button className="button button--small button--secondary" type="button" onClick={() => setDraft((current) => clearOverride(current, selectedActivityRecord.id, "estimatedDurationMinutes"))}>
                    Reset to inherited
                  </button>
                </>
              ) : (
                <label>Set duration minutes
                  <input
                    type="number"
                    min={1}
                    max={480}
                    value={selectedActivityRecord.metadata.estimatedDurationMinutes ? String(selectedActivityRecord.metadata.estimatedDurationMinutes) : ""}
                    onChange={(event) => upsertActivityMetadata(selectedActivityRecord.id, "estimatedDurationMinutes", event.target.value ? Number(event.target.value) : null)}
                  />
                </label>
              )}
            </section>
          )}

          {selectedSessionRecord && (
            <section className="panel">
              <h3>Session Timeline</h3>
              <SessionTimeline activities={selectedSessionActivities} references={draft.references} />
              {sessionStats && (
                <>
                  <p>Activities: {sessionStats.activityCount}</p>
                  <p>Questions: {sessionStats.questionCount}</p>
                  <p>Resources: {sessionStats.resourceCount}</p>
                  <p>Total marks: {sessionStats.totalMarks}</p>
                  <p>Known duration: {sessionStats.knownDurationMinutes} min</p>
                  {sessionStats.hasUnknownDuration
                    ? <p>{sessionStats.unknownDurationActivityCount} activit{sessionStats.unknownDurationActivityCount === 1 ? "y has" : "ies have"} no duration estimate.</p>
                    : <p>Total duration: {sessionStats.estimatedDuration} min</p>}
                </>
              )}
            </section>
          )}

          <section className="panel">
            <h3>Coverage</h3>
            {coverage.learningOutcomes.length === 0 ? <p className="text-muted">No outcomes declared.</p> : (
              <ul>
                {coverage.learningOutcomes.map((item) => (
                  <li key={item.id}>{item.id}: {item.activityCount} activities ({item.percentage}%)</li>
                ))}
              </ul>
            )}
            {coverage.missing.length > 0 && <p>Missing outcomes: {coverage.missing.join(", ")}</p>}
          </section>

          <section className="panel">
            <h3>Difficulty</h3>
            <p>Foundation: {difficulty.foundation}</p>
            <p>Standard: {difficulty.standard}</p>
            <p>Challenge: {difficulty.challenge}</p>
          </section>

          <section className="panel">
            <h3>Draft Status</h3>
            {savedDraft ? (
              <>
                <p><StatusBadge label={savedDraft.status} tone={toneForStatus(savedDraft.status)} /></p>
                <p>Draft id: <code>{savedDraft.id}</code></p>
                <p>Revision: {savedDraft.remoteRevision}</p>
                <p>Updated: {formatDate(savedDraft.updatedAt)}</p>
              </>
            ) : (
              <p className="text-muted">Not saved yet.</p>
            )}
          </section>

          {!validation.ok && (
            <section className="panel">
              <h3>Validation Issues</h3>
              <ul>
                {validation.issues.slice(0, 10).map((issue, index) => (
                  <li key={`${issue.path}-${index}`}><code>{issue.path}</code>: {issue.message}</li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
