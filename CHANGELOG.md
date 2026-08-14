# Changelog

All notable changes to the Learning Platform Administration Portal are recorded
here.

## [Unreleased]

### Added

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
