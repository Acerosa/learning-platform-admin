import type { FormEvent } from "react";
import { getContentEngine } from "../../content/engine";
import { createWeek, slugify } from "../../content/factories";
import type { ContentDocument } from "../../content/types";

export function WeekForm({
  existingIds,
  onCreate,
}: {
  existingIds: readonly string[];
  onCreate: (week: ContentDocument) => void;
}) {
  const engine = getContentEngine();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    const teachingWeek = Number(data.get("teachingWeek"));
    const requestedId = String(data.get("id") || "").trim();
    const id = requestedId || slugify(title, `week-${teachingWeek || existingIds.length + 1}`);
    if (existingIds.includes(id)) {
      event.currentTarget.querySelector<HTMLInputElement>("#week-id")?.setCustomValidity("Week id must be unique.");
      event.currentTarget.querySelector<HTMLInputElement>("#week-id")?.reportValidity();
      return;
    }
    onCreate(createWeek({
      id,
      teachingWeek,
      title,
      status: String(data.get("status") || "planned"),
      phase: String(data.get("phase") || "teaching"),
      learningOutcomes: String(data.get("learningOutcomes") || "").split(/[;,]/).map((item) => item.trim()).filter(Boolean),
      assignment: String(data.get("assignment") || "").trim() || null,
      weekCommencing: String(data.get("weekCommencing") || "").trim() || null,
    }));
    event.currentTarget.reset();
  }

  return (
    <form className="authoring-form" onSubmit={handleSubmit} aria-labelledby="create-week-title">
      <h3 id="create-week-title">Create week</h3>
      <div className="authoring-form__grid">
        <div>
          <label htmlFor="week-id">id</label>
          <input id="week-id" name="id" onChange={(event) => event.currentTarget.setCustomValidity("")} />
        </div>
        <div>
          <label htmlFor="week-number">week number</label>
          <input id="week-number" name="teachingWeek" type="number" min={1} required defaultValue={existingIds.length + 1} />
        </div>
        <div className="authoring-form__span">
          <label htmlFor="week-title">title</label>
          <input id="week-title" name="title" required />
        </div>
        <div>
          <label htmlFor="week-status">status</label>
          <select id="week-status" name="status" defaultValue="planned">
            {engine.STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="week-phase">phase</label>
          <input id="week-phase" name="phase" defaultValue="teaching" />
        </div>
        <div>
          <label htmlFor="week-los">learning outcome references</label>
          <input id="week-los" name="learningOutcomes" placeholder="LO1, LO2" />
        </div>
        <div>
          <label htmlFor="week-assignment">assignment reference</label>
          <input id="week-assignment" name="assignment" />
        </div>
        <div>
          <label htmlFor="week-commencing">planner week commencing</label>
          <input id="week-commencing" name="weekCommencing" placeholder="Leave blank if unknown" />
        </div>
      </div>
      <button className="button button--primary" type="submit">Add week</button>
    </form>
  );
}
