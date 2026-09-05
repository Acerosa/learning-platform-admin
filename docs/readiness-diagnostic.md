# Readiness Diagnostic results

Staff can inspect induction diagnostic sittings in two places. Both read the
same `admin_api.diagnostic_*` views and reuse `ReadinessDiagnosticPage`.

- **Assignments & Results → Results → Induction / Readiness** (primary)
- **Analytics → Readiness Diagnostic**

Live URL: https://acerosa.github.io/learning-platform-admin/

The matching learner hub is the Level 3 IT Year 1 Readiness Diagnostic. Trial
instructions for that hub live in the hub repository `docs/staff-trial.md`.

Results is a hub/source shell. Induction / Readiness is the first connected
diagnostic adapter. Assignment markbook remains available from the same
Results selector. L2E, L3E, Unit 3, T Level and Unit 14 are listed as not
available yet.

## What to expect

Copy states that these are readiness / diagnostic indicators, not assessment
results, and that student name and student ID are learner-entered identifiers.

Overview cards: hub, course, sessions started, completed, completion %,
responses, Not sure.

Session list: student ID, name, group (`—`), diagnostic version, status,
started, completed, answered, current question total (25), score (`—`), last
activity, Open.

The default date filter is the last 7 days so recent sittings are not buried.
Change it to All dates if an older sitting is missing.

Session detail: version, times, result (`—`), unanswered identifiers against
the stored response catalogue, unit grouping, evidence, Not sure, confidence.
The Marked column stays hidden while every `is_correct` value is null.

If no sittings exist, the pane shows empty states rather than invented zeros
presented as attainment.

## How to interpret

Valid now:

- completion
- Not-sure rate
- confidence
- response distributions
- individual evidence
- diagnostic version
- answered count against the current 25-question diagnostic

Not available, and not to be inferred:

- readiness %
- average attainment
- unit score
- pass/fail
- learner ranking
- teaching group / cohort (not stored on diagnostic sittings)
- Not Started from a roster (no roster is linked)

Do not publish real learner names or student IDs in git, issues, or screenshots
stored in this repository.
