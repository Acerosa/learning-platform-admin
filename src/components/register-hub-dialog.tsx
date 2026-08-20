"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminDataSnapshot, HubLifecycle, HubRecord } from "../api/admin-api";
import {
  EMPTY_HUB_REGISTRATION_FORM,
  formFromManifest,
  HUB_LIFECYCLES,
  HUB_MANIFEST_FILENAME,
  manifestFromForm,
  manifestFromHubRecord,
  parseHubManifestJson,
  type HubManifest,
  type HubRegistrationFormState,
} from "../content/hub-manifest";
import { validateHubRegistration } from "../content/hub-registration";
import type { ValidationIssue } from "../content/types";
import { DiagnosticsList } from "./authoring/diagnostics-list";

interface RegisterHubDialogProps {
  open: boolean;
  mode?: "register" | "edit";
  initialHub?: HubRecord | null;
  data: AdminDataSnapshot;
  demoMode: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (input: { manifest: HubManifest; status: HubLifecycle; active: boolean }) => Promise<void>;
}

type DialogStep = "edit" | "preview";

function formFromHub(hub: HubRecord, data: AdminDataSnapshot): HubRegistrationFormState {
  const courseKeys = data.hubCourseLinks
    .filter((link) => link.hubCode === hub.hubCode && link.active)
    .map((link) => link.courseKey);
  return formFromManifest(manifestFromHubRecord(hub, courseKeys), hub.status, hub.active);
}

export function RegisterHubDialog({
  open,
  mode = "register",
  initialHub = null,
  data,
  demoMode,
  submitting,
  error,
  onClose,
  onConfirm,
}: RegisterHubDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = mode === "edit";
  const [step, setStep] = useState<DialogStep>("edit");
  const [form, setForm] = useState<HubRegistrationFormState>(() => (
    editing && initialHub ? formFromHub(initialHub, data) : EMPTY_HUB_REGISTRATION_FORM
  ));
  const [manifestText, setManifestText] = useState(() => {
    if (!(editing && initialHub)) return "";
    return JSON.stringify(manifestFromForm(formFromHub(initialHub, data)), null, 2);
  });
  const [importIssues, setImportIssues] = useState<readonly ValidationIssue[]>([]);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  const field = (key: keyof HubRegistrationFormState) => (event: { target: { value: string } }) => {
    setImported(false);
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const candidateManifest = useMemo(() => manifestFromForm(form), [form]);
  const report = useMemo(
    () => validateHubRegistration(
      candidateManifest,
      form.status,
      form.active,
      data,
      editing ? initialHub?.hubCode : undefined,
    ),
    [candidateManifest, data, editing, form.active, form.status, initialHub?.hubCode],
  );

  function applyParsedManifest(raw: string) {
    const parsed = parseHubManifestJson(raw);
    if (parsed.issues.length) {
      setImportIssues(parsed.issues);
      setImported(false);
      return;
    }
    const validated = validateHubRegistration(
      parsed.manifest,
      form.status,
      form.active,
      data,
      editing ? initialHub?.hubCode : undefined,
    );
    setImportIssues(validated.issues);
    if (!validated.manifest) {
      setImported(false);
      return;
    }
    setForm(formFromManifest(validated.manifest, form.status, form.active));
    setManifestText(JSON.stringify(validated.manifest, null, 2));
    setImported(true);
  }

  async function handleUpload(event: { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    applyParsedManifest(await file.text());
    event.currentTarget.value = "";
  }

  async function handleConfirm() {
    if (!report.manifest) return;
    await onConfirm({
      manifest: report.manifest,
      status: form.status,
      active: form.active,
    });
  }

  if (!open) return null;

  const rpcName = editing ? "admin_api.update_hub" : "admin_api.register_hub";
  const titleId = editing ? "edit-hub-title" : "register-hub-title";

  return (
    <dialog
      className="admin-dialog admin-dialog--wide"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting) onClose();
      }}
      onClose={onClose}
      aria-labelledby={titleId}
    >
      <div className="admin-dialog__header">
        <div>
          <p className="eyebrow">{editing ? "Hub registry" : "Hub registration"}</p>
          <h2 id={titleId}>
            {step === "preview"
              ? (editing ? "Confirm hub update" : "Confirm hub registration")
              : (editing ? "Edit hub" : "Register a hub")}
          </h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close hub dialog" disabled={submitting}>×</button>
      </div>
      <div className="admin-dialog__body">
        {demoMode ? (
          <div className="notice-card notice-card--warning">
            <strong>Demo mode</strong>
            <p>This stays in the browser session and does not call <code>{rpcName}</code>.</p>
          </div>
        ) : (
          <div className="notice-card notice-card--info">
            <strong>Reviewed administrative write</strong>
            <p>This updates hub metadata through <code>{rpcName}</code>. It does not publish curriculum.</p>
          </div>
        )}

        {step === "edit" ? (
          <>
            <section className="dialog-section" aria-labelledby="hub-manifest-import-title">
              <h3 id="hub-manifest-import-title">Import {HUB_MANIFEST_FILENAME}</h3>
              <p>Paste or upload a reviewed hub manifest. Invalid JSON is rejected before preview.</p>
              <label htmlFor="hub-manifest-json">Manifest JSON</label>
              <textarea
                id="hub-manifest-json"
                rows={8}
                value={manifestText}
                placeholder="Paste learning-platform-hub.json here"
                onChange={(event) => {
                  setManifestText(event.target.value);
                  setImported(false);
                }}
                spellCheck={false}
              />
              <div className="toolbar">
                <button className="button button--secondary" type="button" onClick={() => applyParsedManifest(manifestText)}>
                  Validate import
                </button>
                <button className="button button--secondary" type="button" onClick={() => fileRef.current?.click()}>
                  Upload file
                </button>
                <input
                  ref={fileRef}
                  className="sr-only"
                  type="file"
                  accept="application/json,.json"
                  onChange={handleUpload}
                />
                {imported ? <span className="toolbar__count" role="status">Manifest imported</span> : null}
              </div>
              {importIssues.length ? <DiagnosticsList issues={importIssues} /> : null}
            </section>

            <form className="authoring-form" aria-labelledby="hub-registration-fields-title">
              <h3 id="hub-registration-fields-title">Hub metadata</h3>
              <div className="authoring-form__grid">
                <div>
                  <label htmlFor="hub-code">Hub code</label>
                  <input id="hub-code" value={form.hubId} onChange={field("hubId")} autoComplete="off" disabled={editing} />
                </div>
                <div>
                  <label htmlFor="hub-name">Hub name</label>
                  <input id="hub-name" value={form.name} onChange={field("name")} />
                </div>
                <div className="authoring-form__span">
                  <label htmlFor="hub-description">Description</label>
                  <textarea id="hub-description" rows={3} value={form.description} onChange={field("description")} />
                </div>
                <div>
                  <label htmlFor="hub-version">Hub version</label>
                  <input id="hub-version" value={form.version} onChange={field("version")} />
                </div>
                <div>
                  <label htmlFor="hub-lifecycle">Lifecycle</label>
                  <select id="hub-lifecycle" value={form.status} onChange={field("status")}>
                    {HUB_LIFECYCLES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="hub-repository">Repository URL</label>
                  <input id="hub-repository" value={form.repositoryUrl} onChange={field("repositoryUrl")} />
                </div>
                <div>
                  <label htmlFor="hub-deployment">Pages / site URL</label>
                  <input id="hub-deployment" value={form.deploymentUrl} onChange={field("deploymentUrl")} />
                </div>
                <div>
                  <label htmlFor="hub-manifest-version">Manifest version</label>
                  <input id="hub-manifest-version" value={form.manifestVersion} onChange={field("manifestVersion")} />
                </div>
                <div>
                  <label htmlFor="hub-core-version">Core version</label>
                  <input id="hub-core-version" value={form.coreVersion} onChange={field("coreVersion")} />
                </div>
                <div>
                  <label htmlFor="hub-learner-api-version">Learner API version</label>
                  <input id="hub-learner-api-version" value={form.learnerApiVersion} onChange={field("learnerApiVersion")} />
                </div>
                <div>
                  <label htmlFor="hub-submission-version">Submission contract version</label>
                  <input id="hub-submission-version" value={form.submissionContractVersion} onChange={field("submissionContractVersion")} />
                </div>
                <div className="authoring-form__span">
                  <label htmlFor="hub-courses">Course associations</label>
                  <input id="hub-courses" value={form.courses} onChange={field("courses")} placeholder={data.courses.filter((course) => course.active).map((course) => course.courseKey).join(", ") || "course-key"} />
                </div>
                <div>
                  <label htmlFor="hub-evidence">Evidence capabilities</label>
                  <input id="hub-evidence" value={form.evidence} onChange={field("evidence")} />
                </div>
                <div>
                  <label htmlFor="hub-activities">Activity capabilities</label>
                  <input id="hub-activities" value={form.activities} onChange={field("activities")} />
                </div>
                <div className="authoring-form__span">
                  <label htmlFor="hub-feature-flags">Feature flags</label>
                  <input id="hub-feature-flags" value={form.featureFlags} onChange={field("featureFlags")} />
                </div>
              </div>
              <label htmlFor="hub-active">
                <input
                  id="hub-active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                />
                {" "}{editing ? "Hub is active" : "Register as active"}
              </label>
            </form>
            <DiagnosticsList issues={report.issues} />
          </>
        ) : (
          <section className="dialog-section" aria-labelledby="hub-registration-preview-title">
            <h3 id="hub-registration-preview-title">{editing ? "Update preview" : "Registration preview"}</h3>
            <dl className="detail-grid">
              <div><dt>Hub code</dt><dd><code>{candidateManifest.hubId}</code></dd></div>
              <div><dt>Hub name</dt><dd>{candidateManifest.name}</dd></div>
              <div><dt>Version</dt><dd>{candidateManifest.version}</dd></div>
              <div><dt>Lifecycle</dt><dd>{form.status}{form.active ? " · active" : " · inactive"}</dd></div>
              <div className="detail-grid__wide"><dt>Description</dt><dd>{candidateManifest.description}</dd></div>
              <div><dt>Repository</dt><dd>{candidateManifest.repositoryUrl}</dd></div>
              <div><dt>Pages / site</dt><dd>{candidateManifest.deploymentUrl}</dd></div>
              <div><dt>Contracts</dt><dd>Manifest {candidateManifest.manifestVersion} · Core {candidateManifest.compatibility.required.coreVersion} · API {candidateManifest.compatibility.required.learnerApiContractVersion} · Submission {candidateManifest.compatibility.required.submissionContractVersion}</dd></div>
              <div className="detail-grid__wide"><dt>Courses</dt><dd>{candidateManifest.courses.join(", ")}</dd></div>
            </dl>
            {error ? <div className="notice-card notice-card--warning" role="alert"><strong>{editing ? "Update failed" : "Registration failed"}</strong><p>{error}</p></div> : null}
          </section>
        )}
      </div>
      <div className="admin-dialog__footer">
        {step === "preview" ? (
          <button className="button button--secondary" type="button" onClick={() => setStep("edit")} disabled={submitting}>
            Back
          </button>
        ) : null}
        <button className="button button--secondary" type="button" onClick={onClose} disabled={submitting}>Cancel</button>
        {step === "edit" ? (
          <button className="button button--primary" type="button" onClick={() => setStep("preview")} disabled={!report.valid}>
            {editing ? "Preview update" : "Preview registration"}
          </button>
        ) : (
          <button className="button button--primary" type="button" onClick={() => void handleConfirm()} disabled={submitting || !report.valid}>
            {submitting
              ? (editing ? "Saving…" : "Registering…")
              : (editing ? "Confirm update" : "Confirm registration")}
          </button>
        )}
      </div>
    </dialog>
  );
}
