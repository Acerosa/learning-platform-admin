# Readiness Diagnostic (Analytics pane)

Staff-only view at **Analytics → Readiness Diagnostic**.

Live URL: https://acerosa.github.io/learning-platform-admin/

It reads `admin_api.diagnostic_sessions`, `admin_api.diagnostic_responses`, and `admin_api.diagnostic_summary`. It is not a public page. Unauthenticated visitors only see staff sign-in.

The matching learner hub is the Level 3 IT Year 1 Readiness Diagnostic. Trial instructions for that hub live in the hub repository `docs/staff-trial.md`.

## What to expect

Copy on the pane states that these are readiness / diagnostic indicators, not assessment results, and that student name and student ID are learner-entered identifiers.

Overview cards: hub, course, sessions started, completed, completion %, responses, Not sure.

Session list: student name, student ID, started, completed, status, response count, Not-sure count, Open.

Session detail: unit grouping, activity/question keys, evidence, Not sure, confidence. The Marked column stays hidden while every `is_correct` value is null.

If no sittings exist, the pane shows empty states (“No diagnostic summary yet” / “No diagnostic sessions yet”) rather than invented zeros presented as attainment.

## How to interpret

Valid now:

- completion
- Not-sure rate
- confidence
- response distributions
- individual evidence

Not available, and not to be inferred:

- readiness %
- average attainment
- unit score
- pass/fail
- learner ranking

Do not publish real learner names or student IDs in git, issues, or screenshots stored in this repository.
