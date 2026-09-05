# Changelog

All notable changes to the Learning Platform Administration Portal are recorded
here.

## [Unreleased]

### Added

- Results → Induction / Readiness now shows the server-authoritative diagnostic
  score as `awarded / maximum (percentage)` when those fields exist, plus a
  unit-area breakdown from stored `unit_key` metadata. Unmarked or historical
  sittings stay —. The browser does not calculate the official score.

- Results → Induction / Readiness: staff can inspect readiness diagnostic
  sittings from Assignments & Results. The Results area is a hub/source shell
  so later hubs can attach without a second results architecture. Score stays
  — until the server stores an authoritative mark.

- Contextual Analytics: hierarchical Hub → Course → Group → Activity filters,
  an active scope bar, learner and activity drill-down, and metric definitions
  for First Result, Latest Result, Best Result, Attempt Average, Completion and
  Participation. Learner scores are shown per assignment from
  `admin_api.learner_activity_performance`.

- Database-backed curriculum drafts with debounced autosave, Open published
  content, Duplicate / Foundation / Challenge variants, and awaited Publish to
  Platform. Teaching-content publication does not require a GitHub deploy.

- Assessment & Analytics MVP: overview, group/learner/activity/question/topic-skill
  panes, explainable readiness indicators, and deterministic Needs attention
  signals. Consumes new `admin_api` analytics views and Results analytics helpers.

### Added

- Teacher review workflow in Results: open queue item, inspect evidence, award
  score, record feedback, confirm, and refresh markbook/queue without a full
  reload. Uses `admin_api.review_response`.

- Results / Markbook module consuming `admin_api` and `@learning-platform/results`.

- Real Hub Registry management: register, edit, enable/disable, publication
  status and informational health. Live mode uses `admin_api.register_hub` and
  `admin_api.update_hub`. Demo mode keeps synthetic local actions.
- Publish to Platform after local Publish, with Pending / Publishing / Published / Failed states and backend publication history.
- Local curriculum publication lifecycle with immutable versions, working copies, review metadata, history, compare and restore.
- Curriculum authoring module for canonical weeks, sessions, activities and blocks.
- JSON and controlled Excel import against the shared `lp.content.*` contract.
- Local draft workspace, validation diagnostics, learner-renderer preview and canonical export.
- `@learning-platform/content` 0.1.0 as the authoring engine dependency.
- Supabase Auth staff sign-in using a public browser credential.
- Backend-derived staff authority through `admin_api.current_staff_context`.
- Explicit live, demo, loading, signed-out, access-denied and unavailable states.
- Live read adapter for every Phase 2 MVP `admin_api` view.
- Backend-derived dashboard and activity-performance analytics.
- Dedicated summary-only Attempts module in the existing route registry.
- Integration tests for authority, live reads, safe projections and failures.

### Changed

- Existing portal modules now consume the shared read-service snapshot instead
  of importing demo arrays directly.
- Hub details now include contracts, course links, capabilities and compatibility.
- Portal and draft admin API contract versions advance to `0.2.0`.

### Security

- Secret and service-role credentials are rejected by runtime configuration.
- Live failures never silently fall back to demo data.
- General learner, attempt, health and audit reads exclude unnecessary PII,
  response payloads, diagnostics and sensitive context.

## [0.1.0] - 2026-08-11

Initial modular foundation, shared-platform theming, static Pages build,
read-only service boundaries and pending mutation UX.
