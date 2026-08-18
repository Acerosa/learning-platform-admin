# Architecture

The platform-wide pattern is **Contract-First Modular Hub Architecture**,
documented in `learning-platform-backend` `docs/architecture.md`. This file
describes only the Central Admin Portal.

## Purpose and boundary

The portal is the platform **control plane**: a presentation-layer client of
the shared Learning Platform. It does not own platform data, learner
activities, authentication implementation, database migrations, RLS or API
contracts, and it does not edit learner-hub source code.

```text
Central Admin Portal
       │
       ├── shared theme service and tokens ──> learning-platform-core
       ├── canonical content engine ─────────> learning-platform-content
       ├── educational interpretation ───────> learning-platform-results
       │
       └── authenticated staff reads and
           curriculum publication RPC ───────> admin_api
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
- `src/content/` adapts `@learning-platform/content` for local authoring. It does not own schema semantics.

## Authentication and authority

Live mode creates one browser Supabase client with the public publishable (or
legacy anon) key. Supabase Auth owns session persistence and refresh. After a
session is restored, the existing session store reads
`admin_api.current_staff_context`; the shell mounts only for an active staff
profile with an active `platform_admin` role. Routes, browser storage and
frontend flags do not grant authority, and every data read remains protected by
backend RLS.

The shared core theme service remains in use. The core learner platform facade
is intentionally not used for staff authentication because it is constrained
to learner `api` services and learner onboarding state.

## Data modes

The portal supports three explicit modes:

1. **Live** — authenticated, RLS-protected reads from `admin_api`.
2. **Demo** — explicit development mode using synthetic fixtures.
3. **Unavailable** — live configuration, authentication or reads failed.

Analytics are supplied by backend aggregate views. Results / Markbook and
Assessment Analytics interpretation is supplied by `@learning-platform/results`
from those views. Intervention signals stay deterministic and explainable.

## Administrative writes

Backend 0.2.0 keeps general staff mutations pending. Documented exceptions
exist:

- Hub registration: the Hub Registry calls `admin_api.register_hub` with a
  reviewed `learning-platform-hub.json` object.
- Hub updates: the same registry calls `admin_api.update_hub` to edit metadata,
  course links and enablement. Hub codes cannot be changed.
- Curriculum publication: after a local Approved/Published snapshot exists, the
  live client calls `admin_api.publish_curriculum`. See [Backend publication](backend-publication.md).
- Content Library and Composition: live clients call the documented library and
  composition RPCs. Composition materialises a draft; it does not publish.

See [Hub registration](hub-registration.md) and
[Platform management](platform-management.md). The Hub Registry derives
publication status and health from existing reads; it does not publish.

The authoring view never issues `.rpc(` itself and never queries `learning` or
`platform`. Demo mode never calls live mutation RPCs.

Other write journeys still route through the pending mutation service. GitHub
publication and learner-hub deployment remain out of scope.

A further mutation becomes eligible only after the backend defines its role
requirement, validation and conflicts, transaction, stable errors, audit event,
idempotency where relevant, RLS and integration tests.

## Accessibility and responsive architecture

- Semantic headings, landmarks, labels and table headers are server-rendered.
- The skip link targets the main administration region.
- Native dialog semantics are used for detail and pending-action workflows.
- Curriculum authoring tabs, forms and block reorder controls are labelled and keyboard-operable; drag-and-drop is not the only reorder path.
- Focus indicators use the shared platform focus token.
- Large tables scroll within a labelled content region rather than forcing page-level horizontal scrolling.
- Navigation becomes an off-canvas region below 64rem; dashboard and record grids collapse progressively.
- Reduced motion and forced-colour preferences are respected.
