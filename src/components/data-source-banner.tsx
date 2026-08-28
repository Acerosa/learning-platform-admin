import type { AdminDataSourceStatus } from "../stores/admin-portal";

export function DataSourceBanner({ status }: { status: AdminDataSourceStatus }) {
  const stateLabel = status.state === "refreshing" ? "ready" : status.state;
  return (
    <section className={`data-source-banner data-source-banner--${stateLabel}`} aria-label="Data source status">
      <span className="data-source-banner__mark" aria-hidden="true">{status.mode === "live" ? "●" : "i"}</span>
      <div>
        <strong>{status.title}</strong>
        <span>{status.message}</span>
      </div>
      <span className="data-source-banner__version">
        {status.state === "refreshing" ? "Refreshing… · " : ""}
        admin_api 0.2.0 · draft
      </span>
    </section>
  );
}
