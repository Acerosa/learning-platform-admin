# Learning Platform Administration

Version **0.1.0** — modular foundation for the Learning Platform Central Administration Portal.

[Open the administration dashboard](https://acerosa.github.io/learning-platform-admin/)

This repository is the administration interface for the entire Learning Platform. It is not a learner hub and does not render curriculum activities. It prepares staff workflows for hubs, curriculum, people, delivery, analytics, operations, certification and audit.

## Current state

- The portal consumes the shared theme service and semantic tokens from `@learning-platform/core`.
- The backend `admin_api` contract is version `0.1.0`, draft and read-only.
- Read surfaces reflect the documented backend views, reviewed hub manifests and synthetic local fixtures.
- Write journeys are visible but safe: they explain the missing backend contract and never invent an endpoint.
- No hosted credentials, database migrations or learner-hub code live here.

## Local development

Requirements: Node.js 22.13 or later.

```bash
npm install
npm run dev
```

The development server prints the local URL. The app does not require a live backend for its foundation/demo state.

## Quality checks

```bash
npm run lint
npm test
```

`npm test` builds the portal and runs route, architecture, accessibility and responsive-contract tests.

`npm run build:pages` creates the static GitHub Pages build used by the deployment workflow.

## Repository structure

```text
learning-platform-admin/
├── app/                    Route entry points and global presentation
├── src/
│   ├── api/                Documented admin API types and view names
│   ├── components/         Shared administration components
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
├── public/                 Public assets, when required
└── worker/                 Sites-compatible request entry
```

## Documentation

- [Architecture](docs/architecture.md)
- [Modules](docs/modules.md)
- [Backend and core integration](docs/integration.md)
- [Permissions](docs/permissions.md)
- [Deployment](docs/deployment.md)
- [Testing](docs/testing.md)

## Known limitations

- Live Supabase authentication and `admin_api` reads are not connected in 0.1.0.
- The backend has no administrative mutation RPCs in 0.1.0.
- Analytics aggregation, certification records, external monitoring and deployment integrations do not yet have approved contracts.
- Demonstration people, group, enrolment and assignment records are synthetic local fixtures.
- Both registered hubs remain uncertified and in testing.

## Version history

### 0.1.0 — 11 August 2026

Initial modular foundation with all requested administration modules, shared-platform theming, documented service boundaries, read-only/demo surfaces, pending write workflows, responsive layouts and automated quality checks.
