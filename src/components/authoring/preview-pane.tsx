export function PreviewPane({ title, html, id }: { title: string; html: string; id?: string }) {
  return (
    <section className="authoring-preview panel" aria-labelledby="authoring-preview-title" id={id}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Read-only learner renderer</p>
          <h2 id="authoring-preview-title">{title}</h2>
        </div>
      </div>
      <iframe
        className="authoring-preview__frame"
        title="Canonical learner preview"
        sandbox=""
        srcDoc={html}
      />
    </section>
  );
}
