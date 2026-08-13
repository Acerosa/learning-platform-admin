import { useState } from "react";
import { getContentEngine } from "../../content/engine";
import { importToPackage, mergePackages } from "../../content/draft-store";
import { applyWorkbookExtensions, parseJsonImport, sheetsFromWorkbook } from "../../content/import-files";
import { sanitizeObject } from "../../content/sanitize";
import type { ContentPackage } from "../../content/types";
import { DiagnosticsList } from "./diagnostics-list";
import { validatePackage } from "../../content/validate";

export function ImportPanel({
  pkg,
  onImported,
}: {
  pkg: ContentPackage;
  onImported: (pkg: ContentPackage) => void;
}) {
  const [issues, setIssues] = useState(validatePackage(pkg).issues);
  const [message, setMessage] = useState("");

  async function handleJson(file: File) {
    try {
      const parsed = parseJsonImport(await file.text());
      const incoming = importToPackage(parsed, pkg.hub, pkg.curriculum);
      const merged = mergePackages(pkg, incoming);
      const result = validatePackage(merged);
      setIssues(result.issues);
      setMessage(result.valid ? "JSON imported and valid." : "JSON imported with validation issues.");
      onImported(merged);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "JSON import failed.");
    }
  }

  async function handleExcel(file: File) {
    try {
      const XLSX = await import("xlsx");
      const reader = XLSX.default ?? XLSX;
      const workbook = reader.read(await file.arrayBuffer(), { type: "array" });
      const sheets = sheetsFromWorkbook(workbook, reader.utils);
      const engine = getContentEngine();
      const incoming = applyWorkbookExtensions(
        engine.importFromSheets({
          ...sanitizeObject(sheets) as Record<string, unknown>,
          hub: pkg.hub,
          curriculum: pkg.curriculum,
        }) as ContentPackage,
        sheets,
      );
      const merged = mergePackages(pkg, incoming);
      const result = validatePackage(merged);
      setIssues(result.issues);
      setMessage(result.valid ? "Excel imported and valid." : "Excel imported with validation issues.");
      onImported(merged);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Excel import failed.");
    }
  }

  return (
    <section className="panel" aria-labelledby="import-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Untrusted author input</p>
          <h2 id="import-title">Import</h2>
        </div>
      </div>
      <p>JSON may be a canonical object or package. Excel must use the documented activity workbook. Script markup is rejected.</p>
      <div className="authoring-form__grid">
        <div>
          <label htmlFor="json-import">Canonical JSON</label>
          <input id="json-import" type="file" accept="application/json,.json" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleJson(file);
          }} />
        </div>
        <div>
          <label htmlFor="excel-import">Excel workbook</label>
          <input id="excel-import" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleExcel(file);
          }} />
        </div>
      </div>
      <p>
        <a className="text-link" href="/templates/lp-content-activity-import.xlsx">Download Excel activity template</a>
      </p>
      {message ? <p role="status">{message}</p> : null}
      <DiagnosticsList issues={issues} />
    </section>
  );
}
