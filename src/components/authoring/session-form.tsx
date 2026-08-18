import type { FormEvent } from "react";
import { getContentEngine } from "../../content/engine";
import { createSession, slugify } from "../../content/factories";
import type { ContentDocument } from "../../content/types";

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export function SessionForm({
  weeks,
  existingIds,
  existing,
  onCreate,
}: {
  weeks: readonly ContentDocument[];
  existingIds: readonly string[];
  existing?: ContentDocument | null;
  onCreate: (session: ContentDocument) => void;
}) {
  const engine = getContentEngine();
  const editing = Boolean(existing);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    const requestedId = String(data.get("id") || "").trim();
    const id = existing?.id || requestedId || slugify(title, `session-${existingIds.length + 1}`);
    if (existingIds.includes(id) && id !== existing?.id) {
      event.currentTarget.querySelector<HTMLInputElement>("#session-id")?.setCustomValidity("Session id must be unique.");
      event.currentTarget.querySelector<HTMLInputElement>("#session-id")?.reportValidity();
      return;
    }
    onCreate(createSession({
      id,
      title,
      kind: String(data.get("kind") || existing?.metadata.kind || "session"),
      weekId: String(data.get("weekId") || existing?.relationships.week || ""),
      activities: String(data.get("activities") || "").split(/[;,]/).map((item) => item.trim()).filter(Boolean),
      summary: String(data.get("summary") || ""),
      sortOrder: Number(data.get("sortOrder") || 0),
      defaultOpen: data.get("defaultOpen") === "on",
    }));
    if (!editing) event.currentTarget.reset();
  }

  return (
    <form className="authoring-form" onSubmit={handleSubmit} aria-labelledby="create-session-title">
      <h3 id="create-session-title">{editing ? "Edit session" : "Create session"}</h3>
      <div className="authoring-form__grid">
        <div>
          <label htmlFor="session-id">id</label>
          <input
            id="session-id"
            name="id"
            defaultValue={existing?.id ?? ""}
            readOnly={editing}
            onChange={(event) => event.currentTarget.setCustomValidity("")}
          />
        </div>
        <div>
          <label htmlFor="session-kind">kind</label>
          <select id="session-kind" name="kind" defaultValue={String(existing?.metadata.kind || "session")}>
            {engine.SESSION_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
        </div>
        <div className="authoring-form__span">
          <label htmlFor="session-title">title</label>
          <input id="session-title" name="title" required defaultValue={String(existing?.metadata.title || "")} />
        </div>
        <div>
          <label htmlFor="session-week">week</label>
          <select id="session-week" name="weekId" defaultValue={String(existing?.relationships.week || weeks[0]?.id || "")}>
            <option value="">None</option>
            {weeks.map((week) => <option key={week.id} value={week.id}>{week.id}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="session-order">sort order</label>
          <input id="session-order" name="sortOrder" type="number" min={0} defaultValue={Number(existing?.metadata.sortOrder || 0)} />
        </div>
        <div className="authoring-form__span">
          <label htmlFor="session-activities">activity references</label>
          <input id="session-activities" name="activities" placeholder="activity-id-1, activity-id-2" defaultValue={stringList(existing?.relationships.activities).join(", ")} />
        </div>
        <div className="authoring-form__span">
          <label htmlFor="session-summary">summary</label>
          <textarea id="session-summary" name="summary" rows={3} defaultValue={String(existing?.metadata.summary || "")} />
        </div>
        <div>
          <label htmlFor="session-open">
            <input id="session-open" name="defaultOpen" type="checkbox" defaultChecked={existing?.metadata.defaultOpen === true} /> default open
          </label>
        </div>
      </div>
      <button className="button button--primary" type="submit">{editing ? "Save session" : "Add session"}</button>
    </form>
  );
}
