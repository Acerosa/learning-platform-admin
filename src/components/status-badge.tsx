import { titleCase } from "../utils/format";

export type BadgeTone = "positive" | "warning" | "danger" | "neutral" | "info";

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <span aria-hidden="true" className="status-badge__dot" />
      {titleCase(label)}
    </span>
  );
}
