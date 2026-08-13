import { authorableBlockTypes, getContentEngine } from "../../content/engine";
import type { ContentBlock } from "../../content/types";

function Field({
  id,
  label,
  value,
  onChange,
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {multiline
        ? <textarea id={id} rows={4} value={value} onChange={(event) => onChange(event.target.value)} />
        : <input id={id} value={value} onChange={(event) => onChange(event.target.value)} />}
    </div>
  );
}

function updateContent(block: ContentBlock, patch: Record<string, unknown>): ContentBlock {
  return { ...block, content: { ...(block.content || {}), ...patch } };
}

export function BlockEditor({
  block,
  onChange,
}: {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
}) {
  const engine = getContentEngine();
  const type = engine.normaliseBlockType(block.type);
  const content = block.content || {};
  const questionId = String(content.questionId || "");

  return (
    <fieldset className="authoring-block-editor">
      <legend>{type} · <code>{block.id}</code></legend>
      <p className="authoring-stable-id">Block id is stable. Editing content does not regenerate it.</p>
      {engine.isInteractiveBlockType(type) ? (
        <Field
          id={`${block.id}-question-id`}
          label="question id"
          value={questionId}
          onChange={(value) => onChange(updateContent(block, { questionId: value }))}
        />
      ) : null}
      {type === "heading" ? (
        <>
          <Field id={`${block.id}-text`} label="text" value={String(content.text || "")} onChange={(value) => onChange(updateContent(block, { text: value }))} />
          <div>
            <label htmlFor={`${block.id}-level`}>level</label>
            <input id={`${block.id}-level`} type="number" min={2} max={4} value={Number(content.level || 3)} onChange={(event) => onChange(updateContent(block, { level: Number(event.target.value) }))} />
          </div>
        </>
      ) : null}
      {["paragraph", "markdown", "hint", "quote", "teacher-note"].includes(type) ? (
        <Field id={`${block.id}-text`} label="text" multiline value={String(content.text || "")} onChange={(value) => onChange(updateContent(block, { text: value }))} />
      ) : null}
      {type === "callout" ? (
        <>
          <Field id={`${block.id}-title`} label="title" value={String(content.title || "")} onChange={(value) => onChange(updateContent(block, { title: value }))} />
          <Field id={`${block.id}-text`} label="text" multiline value={String(content.text || "")} onChange={(value) => onChange(updateContent(block, { text: value }))} />
          <Field id={`${block.id}-tone`} label="tone" value={String(content.tone || "info")} onChange={(value) => onChange(updateContent(block, { tone: value }))} />
        </>
      ) : null}
      {type === "accordion" ? (
        <>
          <Field id={`${block.id}-title`} label="title" value={String(content.title || "")} onChange={(value) => onChange(updateContent(block, { title: value }))} />
          <Field id={`${block.id}-body`} label="body" multiline value={String(content.body || "")} onChange={(value) => onChange(updateContent(block, { body: value }))} />
        </>
      ) : null}
      {type === "single-choice" ? (
        <>
          <Field id={`${block.id}-prompt`} label="prompt" multiline value={String(content.prompt || "")} onChange={(value) => onChange(updateContent(block, { prompt: value }))} />
          {((content.options as { id: string; label: string }[]) || []).map((option, index) => (
            <div className="authoring-option" key={option.id}>
              <Field id={`${block.id}-opt-${option.id}`} label={`option ${option.id}`} value={option.label} onChange={(value) => {
                const options = [...((content.options as { id: string; label: string }[]) || [])];
                options[index] = { ...option, label: value };
                onChange(updateContent(block, { options }));
              }} />
            </div>
          ))}
          <Field id={`${block.id}-correct`} label="correct option id" value={String(content.correctOptionId || "")} onChange={(value) => onChange(updateContent(block, { correctOptionId: value }))} />
          <Field id={`${block.id}-feedback-correct`} label="correct feedback" multiline value={String((content.feedback as { correct?: string } | undefined)?.correct || "")} onChange={(value) => onChange(updateContent(block, { feedback: { ...((content.feedback as object) || {}), correct: value } }))} />
          <Field id={`${block.id}-feedback-incorrect`} label="incorrect feedback" multiline value={String((content.feedback as { incorrect?: string } | undefined)?.incorrect || "")} onChange={(value) => onChange(updateContent(block, { feedback: { ...((content.feedback as object) || {}), incorrect: value } }))} />
        </>
      ) : null}
      {type === "classification" ? (
        <>
          <Field id={`${block.id}-prompt`} label="prompt" multiline value={String(content.prompt || "")} onChange={(value) => onChange(updateContent(block, { prompt: value }))} />
          {((content.categories as { id: string; label: string }[]) || []).map((category, index) => (
            <Field
              key={category.id}
              id={`${block.id}-cat-${category.id}`}
              label={`category ${category.id}`}
              value={category.label}
              onChange={(value) => {
                const categories = [...((content.categories as { id: string; label: string }[]) || [])];
                categories[index] = { ...category, label: value };
                onChange(updateContent(block, { categories }));
              }}
            />
          ))}
          {((content.items as { id: string; label: string; correctCategoryId: string }[]) || []).map((item, index) => (
            <div className="authoring-option" key={item.id}>
              <Field
                id={`${block.id}-item-${item.id}`}
                label={`item ${item.id}`}
                value={item.label}
                onChange={(value) => {
                  const items = [...((content.items as { id: string; label: string; correctCategoryId: string }[]) || [])];
                  items[index] = { ...item, label: value };
                  onChange(updateContent(block, { items }));
                }}
              />
              <Field
                id={`${block.id}-item-${item.id}-cat`}
                label="correct category id"
                value={item.correctCategoryId}
                onChange={(value) => {
                  const items = [...((content.items as { id: string; label: string; correctCategoryId: string }[]) || [])];
                  items[index] = { ...item, correctCategoryId: value };
                  onChange(updateContent(block, { items }));
                }}
              />
            </div>
          ))}
        </>
      ) : null}
      {type === "image" || type === "video" ? (
        <>
          <Field id={`${block.id}-src`} label="src" value={String(content.src || "")} onChange={(value) => onChange(updateContent(block, { src: value }))} />
          <Field id={`${block.id}-alt`} label="alt" value={String(content.alt || "")} onChange={(value) => onChange(updateContent(block, { alt: value }))} />
          <Field id={`${block.id}-title`} label="title" value={String(content.title || "")} onChange={(value) => onChange(updateContent(block, { title: value }))} />
        </>
      ) : null}
      {type === "reference" ? (
        <>
          <Field id={`${block.id}-label`} label="label" value={String(content.label || "")} onChange={(value) => onChange(updateContent(block, { label: value }))} />
          <Field id={`${block.id}-href`} label="href" value={String(content.href || "")} onChange={(value) => onChange(updateContent(block, { href: value }))} />
        </>
      ) : null}
      {type === "short-response" || type === "reflection" ? (
        <Field id={`${block.id}-prompt`} label="prompt" multiline value={String(content.prompt || "")} onChange={(value) => onChange(updateContent(block, { prompt: value }))} />
      ) : null}
      {type === "code-editor" || type === "python-exercise" ? (
        <>
          <Field id={`${block.id}-instructions`} label="instructions" multiline value={String(content.instructions || "")} onChange={(value) => onChange(updateContent(block, { instructions: value }))} />
          <Field id={`${block.id}-starter`} label="starter" multiline value={String(content.starter || "")} onChange={(value) => onChange(updateContent(block, { starter: value }))} />
        </>
      ) : null}
      {!authorableBlockTypes().some((item) => item.id === type) ? (
        <p>This block type is not implemented for authoring.</p>
      ) : null}
    </fieldset>
  );
}
