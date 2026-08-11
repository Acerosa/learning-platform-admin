# Architecture

## Purpose and boundary

The portal is a presentation-layer client of the shared Learning Platform. It does not own platform data, learner activities, authentication implementation, database migrations, RLS or API contracts.

```text
Central Admin Portal
       │
       ├── shared theme service and tokens ──> learning-platform-core
       │
       └── authenticated staff reads ────────> admin_api
                                                   │
                                      learning + platform schemas
                                                   │
                                            Supabase Auth
```

The learner-safe `api` schema and staff-only `admin_api` schema remain separate. The portal must not query protected `learning` or `platform` tables directly.

## Application layers

- `app/` owns route entry points and global metadata.
- `src/router/` is the single module/navigation registry. A new hub must never require a new portal route.
- `src/layouts/` owns administration chrome and shared navigation.
- `src/views/` owns independent administration module surfaces.
- `src/api/` mirrors documented backend view names and record shapes. It contains no URLs or invented RPC names.
- `src/services/` supplies read data and mutation boundaries.
- `src/stores/` represents backend-derived staff context without email-based checks.
- `src/theme/` adapts the shared platform theme service for React.

## Data modes

The foundation supports three explicit concepts:

1. **Reviewed registry data** from backend source manifests.
2. **Synthetic fixture data** from the local backend seed.
3. **Pending integrations** where an API or operational contract does not exist.

The interface labels these states. It does not present demo data as live production data and does not fabricate analytics.

## Administrative writes

Backend 0.1.0 intentionally excludes staff mutation RPCs. All visible write journeys route through a pending mutation service. The interface explains the required backend work instead of constructing speculative endpoints.

A mutation becomes eligible only after the backend defines its role requirement, validation and conflicts, transaction, stable errors, audit event, idempotency where relevant, RLS and integration tests.

## Accessibility and responsive architecture

- Semantic headings, landmarks, labels and table headers are server-rendered.
- The skip link targets the main administration region.
- Native dialog semantics are used for detail and pending-action workflows.
- Focus indicators use the shared platform focus token.
- Large tables scroll within a labelled content region rather than forcing page-level horizontal scrolling.
- Navigation becomes an off-canvas region below 64rem; dashboard and record grids collapse progressively.
- Reduced motion and forced-colour preferences are respected.
