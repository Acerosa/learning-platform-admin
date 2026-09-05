"use client";

import { useState } from "react";
import type { AdminDataSnapshot, ReviewResponseRequest } from "../api/admin-api";
import {
  ASSIGNMENT_MARKBOOK_SOURCE_ID,
  INDUCTION_READINESS_SOURCE_ID,
  RESULT_SOURCES,
  isResultSourceId,
  resultSourceById,
  type ResultSourceId,
} from "../results/result-sources";
import { ResultsMarkbookPage } from "./results-markbook";
import { ReadinessDiagnosticPage } from "./readiness-diagnostic";

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state__mark" aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export function ResultsArea({
  data,
  onReviewResponse,
  includeAttempts = false,
  error = null,
  loading = false,
  initialSourceId = INDUCTION_READINESS_SOURCE_ID,
}: {
  data: AdminDataSnapshot;
  onReviewResponse: (request: ReviewResponseRequest) => Promise<unknown>;
  includeAttempts?: boolean;
  error?: string | null;
  loading?: boolean;
  initialSourceId?: ResultSourceId;
}) {
  const [sourceId, setSourceId] = useState<ResultSourceId>(
    includeAttempts ? ASSIGNMENT_MARKBOOK_SOURCE_ID : initialSourceId,
  );
  const source = resultSourceById(sourceId);

  return (
    <div data-testid="results-area">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Results</p>
            <h2>{source?.label ?? "Select a hub"}</h2>
            <p>
              Induction diagnostic sittings and assignment markbook share this Results area.
              Other hubs can be added here without a separate results application.
            </p>
          </div>
        </div>
        <div className="toolbar">
          <div className="toolbar__search">
            <label htmlFor="results-source">Hub / source</label>
            <select
              id="results-source"
              value={sourceId}
              onChange={(event) => {
                const next = event.target.value;
                if (isResultSourceId(next)) setSourceId(next);
              }}
            >
              {RESULT_SOURCES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.available ? item.label : `${item.label} (not available yet)`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {source?.kind === "diagnostic" ? (
        <ReadinessDiagnosticPage
          sessions={data.diagnosticSessions}
          responses={data.diagnosticResponses}
          summaries={data.diagnosticSummary}
          error={error}
          loading={loading}
          expectedQuestionCount={source.expectedQuestionCount}
          variant="results"
        />
      ) : null}

      {source?.kind === "assignment-markbook" ? (
        <ResultsMarkbookPage data={data} onReviewResponse={onReviewResponse} embedded />
      ) : null}

      {source?.kind === "unavailable" ? (
        <section className="panel">
          <EmptyState
            title={`${source.label} results are not available yet`}
            body={source.description}
          />
        </section>
      ) : null}
    </div>
  );
}
