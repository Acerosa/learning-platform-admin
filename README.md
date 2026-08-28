# Learning Platform Administration

Version **0.2.0** — Platform Integration MVP for the Learning Platform Central Administration Portal.

[Open the administration dashboard](https://acerosa.github.io/learning-platform-admin/)

This repository is the administration interface for the entire Learning Platform. It is not a learner hub. Curriculum authoring drafts local canonical `lp.content.*` objects, previews them with the shared learner renderer, and can publish approved snapshots to the backend catalogue. It does not write into learner hubs.

## Current state

- The portal consumes the shared theme service and semantic tokens from `@learning-platform/core`.
- Curriculum authoring consumes `@learning-platform/content` 0.1.0 from [Acerosa/learning-platform-content](https://github.com/Acerosa/learning-platform-content) for schemas, validation, import and preview.
- Results / Markbook consumes `@learning-platform/results` for interpretation and `admin_api.attempts` / `admin_api.responses` for data.
- The backend `admin_api` contract is version `0.2.0`, draft, with read models and curriculum publication.
- Explicit live mode uses Supabase Auth and RLS-protected `admin_api` reads with a public browser credential only.
- Explicit demo mode uses reviewed hub metadata and synthetic local fixtures.
- The portal exposes six primary areas: Dashboard, Hubs & Curriculum, People, Assignments & Results, Analytics and System. Legacy module URLs remain available.
- Dashboard, hubs, people, assignments, results, analytics and system consume the shared read-service snapshot.
- Write journeys against backend data remain pending except hub registration,
  hub updates and curriculum publication: they explain the missing mutation
  contract and never invent an endpoint.
- Curriculum authoring drafts weeks, sessions and activities locally, validates them with `@learning-platform/content`, publishes immutable local versions, and can publish those snapshots to the backend catalogue. Learner hubs are not updated.
- No hosted credentials, database migrations or learner-hub source editing live here.

## Local development

Requirements: Node.js 22.13 or later.

```bash
npm install
npm run dev
```

The development server prints the local URL. With no environment file, the app starts in clearly labelled demo mode.

For live local mode, copy `.env.example` to an ignored `.env.local`, set
`NEXT_PUBLIC_ADMIN_DATA_MODE=live`, and use the local values reported by
`supabase status` for the URL and **publishable** key. Never use the secret or
service-role key.

After resetting the sibling backend, sign in as the synthetic local staff
account `platform.admin@local.invalid`. It has no committed password; use the
portal’s email-link action and open the message in local Mailpit. This fixture
exists only in the backend local seed.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test:integration
npm test
```

`npm test` builds the portal and runs route, architecture, accessibility, responsive-contract and curriculum-authoring tests.

`npm run build:pages` creates the static GitHub Pages build used by the deployment workflow.

## Repository structure

```text
learning-platform-admin/
├── app/                    Route entry points and global presentation
├── src/
│   ├── api/                Documented admin API types and view names
│   ├── components/         Shared administration and authoring components
│   ├── content/            Canonical authoring adapters (not schema ownership)
│   ├── layouts/            Administration shell
│   ├── views/              Independent module surfaces
│   ├── router/             Module and navigation registry
│   ├── services/           Demo read service and pending mutations
│   ├── stores/             Backend-shaped session snapshots
│   ├── theme/              Adapter for learning-platform-core theme
│   ├── types/              Local package declarations
│   └── utils/              Presentation utilities
├── docs/                   Architecture and operating documentation
├── tests/                  Automated foundation checks
├── public/                 Excel template and other public assets
└── worker/                 Sites-compatible request entry
```

## Documentation

- [Architecture](docs/architecture.md)
- [Modules](docs/modules.md)
- [Hub registration](docs/hub-registration.md)
- [Platform management](docs/platform-management.md)
- [Curriculum authoring](docs/curriculum-authoring.md)
- [Publication workflow](docs/publication-workflow.md)
- [Backend and core integration](docs/integration.md)
- [Permissions](docs/permissions.md)
- [Deployment](docs/deployment.md)
- [Testing](docs/testing.md)
- [Changelog](CHANGELOG.md)

## Known limitations

- The backend has no general administrative mutation RPCs in 0.2.0. Hub
  registration and hub updates use `admin_api.register_hub` and
  `admin_api.update_hub`. Authoring drafts remain local until platform
  publication.
- GitHub curriculum automation, hosted curriculum writes, certification workflows, external monitoring ingestion and Weeks 2–19 authoring remain deferred.
- Demo-mode people, group, enrolment, assignment and attempt records are synthetic fixtures.
- A hosted live release still requires approved environment configuration, Auth redirect URLs and hosted RLS integration validation.

## Version history

### 0.2.0 — 11 August 2026

Authenticated live `admin_api` integration, backend-derived dashboard and
analytics, registered hub contracts/course links, safe operational lists,
explicit data-source/error states and a dedicated Attempts module.

### 0.1.0 — 11 August 2026

Initial modular foundation with all requested administration modules, shared-platform theming, documented service boundaries, read-only/demo surfaces, pending write workflows, responsive layouts and automated quality checks.
