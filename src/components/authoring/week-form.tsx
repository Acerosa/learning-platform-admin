import type { FormEvent } from "react";
import { getContentEngine } from "../../content/engine";
import { createWeek, slugify } from "../../content/factories";
import type { ContentDocument } from "../../content/types";

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export function WeekForm({
  existingIds,
  existing,
  onCreate,
}: {
  existingIds: readonly string[];
  existing?: ContentDocument | null;
  onCreate: (week: ContentDocument) => void;
}) {
  const engine = getContentEngine();
  const editing = Boolean(existing);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    const teachingWeek = Number(data.get("teachingWeek"));
    const requestedId = String(data.get("id") || "").trim();
    const id = existing?.id || requestedId || slugify(title, `week-${teachingWeek || existingIds.length + 1}`);
    if (existingIds.includes(id) && id !== existing?.id) {
      event.currentTarget.querySelector<HTMLInputElement>("#week-id")?.setCustomValidity("Week id must be unique.");
      event.currentTarget.querySelector<HTMLInputElement>("#week-id")?.reportValidity();
      return;
    }
    onCreate(createWeek({
      id,
      teachingWeek,
      title,
      status: String(data.get("status") || existing?.metadata.status || "planned"),
      phase: String(data.get("phase") || existing?.metadata.phase || "teaching"),
      learningOutcomes: String(data.get("learningOutcomes") || "").split(/[;,]/).map((item) => item.trim()).filter(Boolean),
      assignment: String(data.get("assignment") || "").trim() || null,
      sessions: stringList(existing?.relationships.sessions),
      weekCommencing: String(data.get("weekCommencing") || "").trim() || null,
    }));
    if (!editing) event.currentTarget.reset();
  }

  return (
    <form className="authoring-form" onSubmit={handleSubmit} aria-labelledby="create-week-title">
      <h3 id="create-week-title">{editing ? "Edit week" : "Create week"}</h3>
      <div className="authoring-form__grid">
        <div>
          <label htmlFor="week-id">id</label>
          <input
            id="week-id"
            name="id"
            defaultValue={existing?.id ?? ""}
            readOnly={editing}
            onChange={(event) => event.currentTarget.setCustomValidity("")}
          />
        </div>
        <div>
          <label htmlFor="week-number">week number</label>
          <input id="week-number" name="teachingWeek" type="number" min={1} required defaultValue={Number(existing?.metadata.teachingWeek || existingIds.length + 1)} />
        </div>
        <div className="authoring-form__span">
          <label htmlFor="week-title">title</label>
          <input id="week-title" name="title" required defaultValue={String(existing?.metadata.title || "")} />
        </div>
        <div>
          <label htmlFor="week-status">status (advanced)</label>
          <select id="week-status" name="status" defaultValue={String(existing?.metadata.status || "planned")}>
            {engine.STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <p className="field-hint">Prefer Post week / Remove week above the Weeks list for planned ↔ available.</p>
        </div>
        <div>
          <label htmlFor="week-phase">phase</label>
          <input id="week-phase" name="phase" defaultValue={String(existing?.metadata.phase || "teaching")} />
        </div>
        <div>
          <label htmlFor="week-los">learning outcome references</label>
          <input id="week-los" name="learningOutcomes" placeholder="LO1, LO2" defaultValue={stringList(existing?.relationships.learningOutcomes).join(", ")} />
        </div>
        <div>
          <label htmlFor="week-assignment">assignment reference</label>
          <input id="week-assignment" name="assignment" defaultValue={String(existing?.relationships.assignment || "")} />
        </div>
        <div>
          <label htmlFor="week-commencing">planner week commencing</label>
          <input id="week-commencing" name="weekCommencing" placeholder="Leave blank if unknown" defaultValue={String(existing?.metadata.weekCommencing || "")} />
        </div>
      </div>
      <button className="button button--primary" type="submit">{editing ? "Save week" : "Add week"}</button>
    </form>
  );
}
