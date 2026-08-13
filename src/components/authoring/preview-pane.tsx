export function PreviewPane({ title, html }: { title: string; html: string }) {
  return (
    <section className="authoring-preview panel" aria-labelledby="authoring-preview-title">
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
