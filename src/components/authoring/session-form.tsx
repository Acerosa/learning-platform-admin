import type { FormEvent } from "react";
import { getContentEngine } from "../../content/engine";
import { createSession, slugify } from "../../content/factories";
import type { ContentDocument } from "../../content/types";

export function SessionForm({
  weeks,
  existingIds,
  onCreate,
}: {
  weeks: readonly ContentDocument[];
  existingIds: readonly string[];
  onCreate: (session: ContentDocument) => void;
}) {
  const engine = getContentEngine();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    const requestedId = String(data.get("id") || "").trim();
    const id = requestedId || slugify(title, `session-${existingIds.length + 1}`);
    if (existingIds.includes(id)) {
      event.currentTarget.querySelector<HTMLInputElement>("#session-id")?.setCustomValidity("Session id must be unique.");
      event.currentTarget.querySelector<HTMLInputElement>("#session-id")?.reportValidity();
      return;
    }
    onCreate(createSession({
      id,
      title,
      kind: String(data.get("kind") || "session"),
      weekId: String(data.get("weekId") || ""),
      activities: String(data.get("activities") || "").split(/[;,]/).map((item) => item.trim()).filter(Boolean),
      summary: String(data.get("summary") || ""),
      sortOrder: Number(data.get("sortOrder") || 0),
      defaultOpen: data.get("defaultOpen") === "on",
    }));
    event.currentTarget.reset();
  }

  return (
    <form className="authoring-form" onSubmit={handleSubmit} aria-labelledby="create-session-title">
      <h3 id="create-session-title">Create session</h3>
      <div className="authoring-form__grid">
        <div>
          <label htmlFor="session-id">id</label>
          <input id="session-id" name="id" onChange={(event) => event.currentTarget.setCustomValidity("")} />
        </div>
        <div>
          <label htmlFor="session-kind">kind</label>
          <select id="session-kind" name="kind" defaultValue="session">
            {engine.SESSION_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
        </div>
        <div className="authoring-form__span">
          <label htmlFor="session-title">title</label>
          <input id="session-title" name="title" required />
        </div>
        <div>
          <label htmlFor="session-week">week</label>
          <select id="session-week" name="weekId" defaultValue={weeks[0]?.id || ""}>
            <option value="">None</option>
            {weeks.map((week) => <option key={week.id} value={week.id}>{week.id}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="session-order">sort order</label>
          <input id="session-order" name="sortOrder" type="number" min={0} defaultValue={0} />
        </div>
        <div className="authoring-form__span">
          <label htmlFor="session-activities">activity references</label>
          <input id="session-activities" name="activities" placeholder="activity-id-1, activity-id-2" />
        </div>
        <div className="authoring-form__span">
          <label htmlFor="session-summary">summary</label>
          <textarea id="session-summary" name="summary" rows={3} />
        </div>
        <div>
          <label htmlFor="session-open">
            <input id="session-open" name="defaultOpen" type="checkbox" /> default open
          </label>
        </div>
      </div>
      <button className="button button--primary" type="submit">Add session</button>
    </form>
  );
}
