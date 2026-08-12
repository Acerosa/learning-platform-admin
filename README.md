# Learning Platform Administration

Version **0.2.0** — Platform Integration MVP for the Learning Platform Central Administration Portal.

[Open the administration dashboard](https://acerosa.github.io/learning-platform-admin/)

This repository is the administration interface for the entire Learning Platform. It is not a learner hub and does not render curriculum activities. It prepares staff workflows for hubs, curriculum, people, delivery, analytics, operations, certification and audit.

## Current state

- The portal consumes the shared theme service and semantic tokens from `@learning-platform/core`.
- The backend `admin_api` contract is version `0.2.0`, draft and read-only.
- Explicit live mode uses Supabase Auth and RLS-protected `admin_api` reads with a public browser credential only.
- Explicit demo mode uses reviewed hub metadata and synthetic local fixtures.
- Dashboard, hubs, courses, learners, staff roles, groups, enrolments, assignments, attempts, analytics, monitoring, contracts and audit consume the shared read-service snapshot.
- Write journeys are visible but safe: they explain the missing backend contract and never invent an endpoint.
- No hosted credentials, database migrations or learner-hub code live here.

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
- [Changelog](CHANGELOG.md)

## Known limitations

- The backend has no administrative mutation RPCs in 0.2.0.
- Curriculum/activity authoring, certification workflows, external monitoring ingestion and deployment integrations remain deferred.
- Demo-mode people, group, enrolment, assignment and attempt records are synthetic fixtures.
- A hosted live release still requires approved environment configuration, Auth redirect URLs and hosted RLS integration validation.

## Version history

### 0.2.0 — 11 August 2026

Authenticated live `admin_api` integration, backend-derived dashboard and
analytics, registered hub contracts/course links, safe operational lists,
explicit data-source/error states and a dedicated Attempts module.

### 0.1.0 — 11 August 2026

Initial modular foundation with all requested administration modules, shared-platform theming, documented service boundaries, read-only/demo surfaces, pending write workflows, responsive layouts and automated quality checks.
