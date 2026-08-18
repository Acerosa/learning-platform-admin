import { useState, type FormEvent } from "react";
import { ACTIVITY_DIFFICULTIES, activityDifficulty } from "../../content/activity-variants";
import { authorableBlockTypes } from "../../content/engine";
import { createActivity, createBlock, duplicateBlock, slugify } from "../../content/factories";
import type { ContentActivity, ContentBlock } from "../../content/types";
import { BlockEditor } from "./block-editor";

export function ActivityComposer({
  existingIds,
  activity,
  onCreate,
  onChange,
  onDuplicate,
  onCreateVariant,
}: {
  existingIds: readonly string[];
  activity: ContentActivity | null;
  onCreate: (activity: ContentActivity) => void;
  onChange: (activity: ContentActivity) => void;
  onDuplicate?: () => void;
  onCreateVariant?: (difficulty: "foundation" | "standard" | "challenge") => void;
}) {
  const [blockType, setBlockType] = useState("paragraph");

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    const requestedId = String(data.get("id") || "").trim();
    const id = requestedId || slugify(title, `activity-${existingIds.length + 1}`);
    if (existingIds.includes(id)) {
      event.currentTarget.querySelector<HTMLInputElement>("#activity-id")?.setCustomValidity("Activity id must be unique.");
      event.currentTarget.querySelector<HTMLInputElement>("#activity-id")?.reportValidity();
      return;
    }
    onCreate(createActivity({
      id,
      title,
      summary: String(data.get("summary") || ""),
      status: String(data.get("status") || "planned"),
      difficulty: String(data.get("difficulty") || "standard") as "foundation" | "standard" | "challenge",
    }));
    event.currentTarget.reset();
  }

  function replaceBlocks(blocks: ContentBlock[]) {
    if (!activity) return;
    onChange({ ...activity, blocks });
  }

  function move(index: number, offset: number) {
    if (!activity) return;
    const next = index + offset;
    if (next < 0 || next >= activity.blocks.length) return;
    const blocks = [...activity.blocks];
    const [item] = blocks.splice(index, 1);
    blocks.splice(next, 0, item);
    replaceBlocks(blocks);
  }

  return (
    <div className="authoring-composer">
      <form className="authoring-form" onSubmit={handleCreate} aria-labelledby="create-activity-title">
        <h3 id="create-activity-title">Create activity</h3>
        <div className="authoring-form__grid">
          <div>
            <label htmlFor="activity-id">id</label>
            <input id="activity-id" name="id" onChange={(event) => event.currentTarget.setCustomValidity("")} />
          </div>
          <div>
            <label htmlFor="activity-status">status</label>
            <select id="activity-status" name="status" defaultValue="planned">
              <option value="planned">planned</option>
              <option value="available">available</option>
              <option value="archived">archived</option>
            </select>
          </div>
            <div>
            <label htmlFor="activity-difficulty">difficulty</label>
            <select id="activity-difficulty" name="difficulty" defaultValue="standard">
              {ACTIVITY_DIFFICULTIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="authoring-form__span">
            <label htmlFor="activity-title">title</label>
            <input id="activity-title" name="title" required />
          </div>
          <div className="authoring-form__span">
            <label htmlFor="activity-summary">summary</label>
            <textarea id="activity-summary" name="summary" rows={3} />
          </div>
        </div>
        <button className="button button--primary" type="submit">Add activity</button>
      </form>

      {activity ? (
        <section className="panel" aria-labelledby="block-composer-title">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Composition</p>
              <h3 id="block-composer-title">{activity.metadata.title as string}</h3>
              <p>
                Difficulty: {activityDifficulty(activity)}
                {activity.metadata.familyId ? <> · Family <code>{String(activity.metadata.familyId)}</code></> : null}
              </p>
            </div>
            <code>{activity.id}</code>
          </div>
          <div className="toolbar">
            <div>
              <label htmlFor="edit-activity-title">Title</label>
              <input
                id="edit-activity-title"
                value={String(activity.metadata.title || "")}
                onChange={(event) => onChange({
                  ...activity,
                  metadata: { ...activity.metadata, title: event.target.value },
                })}
              />
            </div>
            <div>
              <label htmlFor="edit-activity-difficulty">Difficulty</label>
              <select
                id="edit-activity-difficulty"
                value={activityDifficulty(activity)}
                onChange={(event) => onChange({
                  ...activity,
                  metadata: {
                    ...activity.metadata,
                    difficulty: event.target.value,
                    familyId: activity.metadata.familyId || activity.id,
                  },
                })}
              >
                {ACTIVITY_DIFFICULTIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <button className="button button--secondary" type="button" onClick={onDuplicate}>Duplicate</button>
            <button className="button button--secondary" type="button" onClick={() => onCreateVariant?.("foundation")}>Create Foundation</button>
            <button className="button button--secondary" type="button" onClick={() => onCreateVariant?.("challenge")}>Create Challenge</button>
          </div>
          <div className="toolbar">
            <div>
              <label htmlFor="add-block-type">Add implemented block</label>
              <select id="add-block-type" value={blockType} onChange={(event) => setBlockType(event.target.value)}>
                {authorableBlockTypes().map((type) => (
                  <option key={type.id} value={type.id}>{type.id}</option>
                ))}
              </select>
            </div>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => replaceBlocks([
                ...activity.blocks,
                createBlock(activity.id, blockType, activity.blocks.map((block) => block.id)),
              ])}
            >
              Add block
            </button>
          </div>
          {activity.blocks.length ? activity.blocks.map((block, index) => (
            <article className="authoring-block" key={block.id}>
              <div className="authoring-block__toolbar">
                <p><strong>{block.type}</strong> <code>{block.id}</code></p>
                <div>
                  <button className="button button--small button--secondary" type="button" onClick={() => move(index, -1)} disabled={index === 0}>Move up</button>
                  <button className="button button--small button--secondary" type="button" onClick={() => move(index, 1)} disabled={index === activity.blocks.length - 1}>Move down</button>
                  <button className="button button--small button--secondary" type="button" onClick={() => replaceBlocks([...activity.blocks, duplicateBlock(block, activity.id, activity.blocks.map((item) => item.id))])}>Duplicate</button>
                  <button className="button button--small button--secondary" type="button" onClick={() => replaceBlocks(activity.blocks.filter((item) => item.id !== block.id))}>Remove</button>
                </div>
              </div>
              <BlockEditor
                block={block}
                onChange={(next) => replaceBlocks(activity.blocks.map((item) => item.id === next.id ? next : item))}
              />
            </article>
          )) : <p>No blocks yet. Activities are ordered block lists, not separate quiz or coding editors.</p>}
        </section>
      ) : <p>Create or select an activity to compose blocks.</p>}
    </div>
  );
}
