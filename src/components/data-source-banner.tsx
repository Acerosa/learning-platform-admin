import { DEMO_DATA_NOTICE } from "../services/demo-admin-service";

export function DataSourceBanner() {
  return (
    <section className="data-source-banner" aria-label="Data source status">
      <span className="data-source-banner__mark" aria-hidden="true">i</span>
      <div>
        <strong>{DEMO_DATA_NOTICE.title}</strong>
        <span>{DEMO_DATA_NOTICE.message}</span>
      </div>
      <span className="data-source-banner__version">admin_api 0.1.0 · draft</span>
    </section>
  );
}
