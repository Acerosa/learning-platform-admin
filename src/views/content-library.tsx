"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthoringAreaLinks } from "../components/authoring-area-links";
import { StatusBadge, type BadgeTone } from "../components/status-badge";
import { useAdminPortal } from "../stores/admin-portal";

const LIBRARY_TABS = [
  { id: "all", label: "All" },
  { id: "question", label: "Questions" },
  { id: "activity", label: "Activities" },
  { id: "template", label: "Templates" },
  { id: "resource", label: "Resources" },
  { id: "feedback", label: "Feedback" },
  { id: "hint", label: "Hints" },
] as const;

type LibraryTab = (typeof LIBRARY_TABS)[number]["id"];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "superseded", label: "Superseded" },
  { value: "archived", label: "Archived" },
] as const;

interface LibraryItem {
  libraryType: string;
  id: string;
  stableKey: string;
  title: string;
  itemType: string;
  status: string;
  version: string;
  tags: string[];
  subject: string | null;
  author: string;
  updatedAt: string;
  usedByCount: number;
}

function toneForStatus(status: string): BadgeTone {
  if (status === "published") return "positive";
  if (status === "draft") return "warning";
  if (status === "superseded" || status === "archived") return "neutral";
  return "info";
}

function typeIcon(libraryType: string): string {
  switch (libraryType) {
    case "question": return "Q";
    case "activity": return "A";
    case "template": return "T";
    case "resource": return "R";
    case "feedback": return "F";
    case "hint": return "H";
    default: return "?";
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

interface CreateQuestionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

function CreateQuestionDialog({ open, onClose, onSave }: CreateQuestionDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    stableKey: "",
    title: "",
    questionText: "",
    questionType: "single",
    difficulty: 3,
    marks: 1,
    subject: "",
    topic: "",
    tags: "",
    learningOutcomes: "",
  });

  const handleSave = useCallback(async () => {
    if (!form.stableKey || !form.title || !form.questionText) {
      setError("Key, title and question text are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        p_id: crypto.randomUUID(),
        p_stable_key: form.stableKey,
        p_title: form.title,
        p_question_text: form.questionText,
        p_question_type: form.questionType,
        p_difficulty: form.difficulty,
        p_marks: form.marks,
        p_subject: form.subject || null,
        p_topic: form.topic || null,
        p_tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
        p_learning_outcomes: form.learningOutcomes
          ? form.learningOutcomes.split(",").map((lo) => lo.trim())
          : [],
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [form, onSave, onClose]);

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-labelledby="create-question-title">
        <header className="dialog__header">
          <h2 id="create-question-title">Create Question</h2>
          <button className="dialog__close" type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="dialog__body">
          {error ? <div className="notice-card notice-card--danger"><p>{error}</p></div> : null}
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="q-key">Stable key</label>
              <input id="q-key" type="text" value={form.stableKey} onChange={(e) => setForm({ ...form, stableKey: e.target.value })} placeholder="e.g. cia-triad-q1" />
            </div>
            <div className="form-field">
              <label htmlFor="q-title">Title</label>
              <input id="q-title" type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Short descriptive title" />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="q-text">Question text</label>
              <textarea id="q-text" rows={3} value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} placeholder="The question prompt shown to learners" />
            </div>
            <div className="form-field">
              <label htmlFor="q-type">Question type</label>
              <select id="q-type" value={form.questionType} onChange={(e) => setForm({ ...form, questionType: e.target.value })}>
                <option value="single">Single choice</option>
                <option value="multiple">Multiple choice</option>
                <option value="text">Text</option>
                <option value="matching">Matching</option>
                <option value="order">Order</option>
                <option value="predict-output">Predict output</option>
                <option value="code-gap">Code gap</option>
                <option value="code-editor">Code editor</option>
                <option value="classification">Classification</option>
                <option value="short-response">Short response</option>
                <option value="reflection">Reflection</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="q-diff">Difficulty (1–5)</label>
              <input id="q-diff" type="number" min={1} max={5} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })} />
            </div>
            <div className="form-field">
              <label htmlFor="q-marks">Marks</label>
              <input id="q-marks" type="number" min={0.5} step={0.5} value={form.marks} onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} />
            </div>
            <div className="form-field">
              <label htmlFor="q-subject">Subject</label>
              <input id="q-subject" type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Cyber Security" />
            </div>
            <div className="form-field">
              <label htmlFor="q-topic">Topic</label>
              <input id="q-topic" type="text" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. CIA Triad" />
            </div>
            <div className="form-field">
              <label htmlFor="q-tags">Tags (comma-separated)</label>
              <input id="q-tags" type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. week-1, formative" />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="q-lo">Learning outcomes (comma-separated)</label>
              <input id="q-lo" type="text" value={form.learningOutcomes} onChange={(e) => setForm({ ...form, learningOutcomes: e.target.value })} placeholder="e.g. LO1, LO2" />
            </div>
          </div>
        </div>
        <footer className="dialog__footer">
          <button className="button button--secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button button--primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Create question"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CreateActivityDialog({ open, onClose, onSave }: CreateQuestionDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    stableKey: "",
    title: "",
    activityType: "lesson",
    summary: "",
    subject: "",
    tags: "",
  });

  const handleSave = useCallback(async () => {
    if (!form.stableKey || !form.title) {
      setError("Key and title are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        p_id: crypto.randomUUID(),
        p_stable_key: form.stableKey,
        p_title: form.title,
        p_activity_type: form.activityType,
        p_summary: form.summary || null,
        p_subject: form.subject || null,
        p_tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
        p_status: "draft",
        p_version: "1.0.0",
        p_content: {},
        p_learning_outcomes: [],
        p_question_ids: [],
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [form, onSave, onClose]);

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-labelledby="create-activity-title">
        <header className="dialog__header">
          <h2 id="create-activity-title">Create Activity</h2>
          <button className="dialog__close" type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="dialog__body">
          {error ? <div className="notice-card notice-card--danger"><p>{error}</p></div> : null}
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="a-key">Stable key</label>
              <input id="a-key" type="text" value={form.stableKey} onChange={(e) => setForm({ ...form, stableKey: e.target.value })} placeholder="e.g. cia-intro-activity" />
            </div>
            <div className="form-field">
              <label htmlFor="a-title">Title</label>
              <input id="a-title" type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Short descriptive title" />
            </div>
            <div className="form-field">
              <label htmlFor="a-type">Activity type</label>
              <select id="a-type" value={form.activityType} onChange={(e) => setForm({ ...form, activityType: e.target.value })}>
                <option value="lesson">Lesson</option>
                <option value="diagnostic">Diagnostic</option>
                <option value="practical">Practical</option>
                <option value="assessment">Assessment</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="a-subject">Subject</label>
              <input id="a-subject" type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="a-summary">Summary</label>
              <textarea id="a-summary" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="a-tags">Tags (comma-separated)</label>
              <input id="a-tags" type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
          </div>
        </div>
        <footer className="dialog__footer">
          <button className="button button--secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button button--primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Create activity"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function ContentLibraryPage() {
  const { data, dataSource, callRpc } = useAdminPortal();
  const [activeTab, setActiveTab] = useState<LibraryTab>("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createActivityOpen, setCreateActivityOpen] = useState(false);

  const isLive = dataSource.mode === "live" && dataSource.state === "ready";

  const fetchItems = useCallback(async () => {
    if (!isLive) return;
    setLoading(true);
    setSearchError(null);
    try {
      const params: Record<string, unknown> = {
        p_query: query,
        p_limit: 100,
        p_offset: 0,
      };
      if (activeTab !== "all") params.p_library_types = [activeTab];
      if (statusFilter) params.p_status = statusFilter;

      const rows = await callRpc("search_library", params);
      setItems(
        (rows as Record<string, unknown>[]).map((row) => ({
          libraryType: String(row.library_type ?? ""),
          id: String(row.id ?? ""),
          stableKey: String(row.stable_key ?? ""),
          title: String(row.title ?? ""),
          itemType: String(row.item_type ?? ""),
          status: String(row.status ?? ""),
          version: String(row.version ?? ""),
          tags: (row.tags as string[]) ?? [],
          subject: row.subject ? String(row.subject) : null,
          author: String(row.author ?? ""),
          updatedAt: String(row.updated_at ?? ""),
          usedByCount: Number(row.used_by_count ?? 0),
        })),
      );
    } catch (caught) {
      setItems([]);
      setSearchError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }, [isLive, callRpc, query, activeTab, statusFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const visibleItems = useMemo(() => items, [items]);

  const handleSaveQuestion = useCallback(
    async (params: Record<string, unknown>) => {
      await callRpc("save_library_question", params);
      fetchItems();
    },
    [callRpc, fetchItems],
  );

  const handleSaveActivity = useCallback(
    async (params: Record<string, unknown>) => {
      await callRpc("save_library_activity", params);
      fetchItems();
    },
    [callRpc, fetchItems],
  );

  const handleDelete = useCallback(async (item: LibraryItem) => {
    if (item.status !== "draft") return;
    setActionError(null);
    try {
      await callRpc("delete_library_item", { p_library_type: item.libraryType, p_id: item.id });
      await fetchItems();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Delete failed.");
    }
  }, [callRpc, fetchItems]);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Reusable master teaching assets</p>
          <h1>Content Library</h1>
          <p>Manage reusable questions, activities, templates and resources. This is not publication. Assemble these assets in Composition, then edit and publish a hub curriculum in Curriculum authoring.</p>
        </div>
        <div className="page-header__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setCreateActivityOpen(true)}
            disabled={!isLive}
          >
            Create activity
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!isLive}
          >
            <span aria-hidden="true">＋</span>Create question
          </button>
        </div>
      </header>

      <AuthoringAreaLinks current="content-library" />

      {searchError ? (
        <div className="notice-card notice-card--danger" role="alert">
          <strong>Search failed</strong>
          <p>{searchError}</p>
        </div>
      ) : null}
      {actionError ? (
        <div className="notice-card notice-card--danger" role="alert">
          <strong>Library action failed</strong>
          <p>{actionError}</p>
        </div>
      ) : null}

      <section className="panel">
        <nav className="tab-bar" aria-label="Library sections">
          {LIBRARY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-bar__tab${activeTab === tab.id ? " tab-bar__tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="toolbar">
          <div className="toolbar__search">
            <label htmlFor="library-search">Search</label>
            <input
              id="library-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, key or topic"
            />
          </div>
          <div>
            <label htmlFor="library-status">Status</label>
            <select
              id="library-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <span className="toolbar__count" role="status">
            {loading ? "Loading…" : `${visibleItems.length} items`}
          </span>
        </div>

        {!isLive ? (
          <div className="notice-card notice-card--warning">
            <strong>Platform connection required</strong>
            <p>The Content Library requires a live platform connection. Connect to the platform to browse and manage library items.</p>
          </div>
        ) : visibleItems.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Title</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Version</th>
                  <th scope="col">Used by</th>
                  <th scope="col">Author</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={`${item.libraryType}-${item.id}`}>
                    <td>
                      <span className="type-badge" title={item.libraryType}>
                        {typeIcon(item.libraryType)}
                      </span>
                    </td>
                    <th scope="row">
                      <span className="table-primary">{item.title}</span>
                      <code>{item.stableKey}</code>
                    </th>
                    <td>{item.itemType}</td>
                    <td>
                      <StatusBadge
                        label={item.status}
                        tone={toneForStatus(item.status)}
                      />
                    </td>
                    <td>{item.version}</td>
                    <td>{item.usedByCount}</td>
                    <td>{item.author}</td>
                    <td>{formatDate(item.updatedAt)}</td>
                    <td>
                      {item.status === "draft" ? (
                        <button className="button button--small button--secondary" type="button" onClick={() => void handleDelete(item)}>
                          Delete draft
                        </button>
                      ) : (
                        <span>{item.usedByCount ? `${item.usedByCount} uses` : "Published"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : searchError ? (
          <div className="empty-state">
            <span className="empty-state__mark" aria-hidden="true">◇</span>
            <h3>Library search failed</h3>
            <p>The live admin_api.search_library call did not complete. Retry after the platform connection is restored.</p>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-state__mark" aria-hidden="true">◇</span>
            <h3>No library items</h3>
            <p>
              {query || statusFilter
                ? "No items match the current filters."
                : "Create your first reusable question, activity, template or resource."}
            </p>
          </div>
        )}
      </section>

      {data && !isLive ? (
        <section className="notice-card notice-card--info">
          <strong>Demo mode</strong>
          <p>Content Library is available in live mode only. The library schema is not present in the demo data source.</p>
        </section>
      ) : null}

      <CreateQuestionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleSaveQuestion}
      />
      <CreateActivityDialog
        open={createActivityOpen}
        onClose={() => setCreateActivityOpen(false)}
        onSave={handleSaveActivity}
      />
    </>
  );
}
