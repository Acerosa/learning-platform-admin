import type { ValidationIssue } from "../../content/types";

export function DiagnosticsList({ issues }: { issues: readonly ValidationIssue[] }) {
  if (!issues.length) {
    return <p role="status">No validation issues.</p>;
  }
  return (
    <div className="authoring-diagnostics" role="alert">
      <h3>Validation issues</h3>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.path}-${index}`}>
            <code>{issue.code}</code>
            <span>{issue.path}</span>
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
