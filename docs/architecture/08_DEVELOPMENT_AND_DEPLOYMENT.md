# 08 — Development and deployment

Commands below are the ones declared in each repository. They were **not run** while writing this documentation, so a failure here would be pre-existing and is not something this exercise introduced. Do not copy secret values into shell history from a shared note. `.env.example` files name the variables. Fill them from a local `supabase status` or from the hosting dashboard.

## 9.1 Run the Admin Portal locally

Prerequisites that the repository states:

| Requirement | Source |
| --- | --- |
| Node.js `>=22.13.0` | `package.json` `engines`. No `.nvmrc` or `.node-version` in this repo. GitHub Actions uses Node 22. |
| npm | `package-lock.json` only. No pnpm or yarn lockfile. |
| Sibling checkouts | `file:../learning-platform-core`, `file:../learning-platform-content`, `file:../learning-platform-results` |

```bash
cd /path/to/learning-platform-admin
npm install
npm run dev
```

`npm run dev` runs `vinext dev`. With no env file the mode defaults to `demo`. Demo mode does not contact Supabase. It serves `demoAdminService` fixtures, including a fictional platform administrator.

Live mode against a **local** backend:

1. In `learning-platform-backend`, start Supabase (see below) and read the API URL and publishable key from `supabase status`.
2. Copy this repo’s `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_ADMIN_DATA_MODE=live`, `NEXT_PUBLIC_SUPABASE_URL` to the local API URL, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the publishable or anon key. `isBrowserSafeSupabaseKey` rejects a service-role key.
4. Optional: `NEXT_PUBLIC_GROUP_GENERATOR_URL` if the group-generator dev server is not the GitHub Pages default.
5. Restart `npm run dev`. The client is created only when the config is valid and live.

The local portal then uses the same code path as production: schema `admin_api`, PKCE, `current_staff_context`. The local seed creates synthetic staff. It does not create a usable password (`encrypted_password` is null in `supabase/seed.sql`). Signing in against local seed data therefore needs an Auth user you create yourself and a matching `learning.teachers` plus `platform.staff_roles` row. The exact SQL for that grant is the privileged path described in `docs/permissions.md`. This exercise did not create one.

| Command | Effect |
| --- | --- |
| `npm run dev` | Vinext dev server |
| `npm run build` | Vinext production build |
| `npm run build:pages` | Static Pages bundle (`vite.pages.config.ts`, base `/learning-platform-admin/`) |
| `npm start` | Vinext start |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, ignoring `dist` and `.next` |
| `npm test` | Both builds, then `node --test tests/*.test.mjs`, then `test:authoring` |
| `npm run test:unit` | Architecture and responsive tests only |
| `npm run test:authoring` | TypeScript node tests listed in `package.json` |
| `npm run test:accessibility` | Build plus axe |
| `npm run test:integration` | `tests/integration.test.ts` |
| `npm run build:activity-template` | Sample Excel template |

`docs/testing.md` matches these script names. It also describes pgTAP. That suite is not in this repository.

There is no `supabase/config.toml` here. The portal does not embed the Supabase CLI.

## 9.2 Backend development

Repository: `learning-platform-backend`. No `engines` field. CI uses Node 22. Python 3 runs the validators. Docker is required for the Supabase CLI.

`supabase/config.toml` sets `project_id = "learning-platform-backend"`, Postgres 17, and local API and database ports (56321 and 56322 in the file that was read). Confirm with `supabase status` after start. Do not assume those ports if the file has changed.

Documented local loop (`README.md`, `docs/migrations.md`):

```bash
python3 scripts/validation/validate_repository.py
supabase start
supabase db reset
supabase test db
supabase stop
```

`db reset` applies `supabase/migrations/` in filename order and then the seed paths in `config.toml`. It is a local operation. `docs/migrations.md` says not to treat `supabase db push` as the everyday local loop. Hosted apply is a reviewed migration, described in `docs/release-process.md`. Hosted history timestamps can differ from these filenames. This document cannot confirm the hosted project from git alone.

| Topic | What the repo supports |
| --- | --- |
| Migration layout | `supabase/migrations/YYYYMMDDHHMMSS_snake_name.sql`. 103 files in the inspected tree. |
| Rollback | One manual file, `supabase/rollbacks/20260913180000_admin_hub_learning_results.down.sql`. It is not a migration and is not applied by `db reset`. |
| Schema version | There is no single `schema_migrations` document beyond Supabase’s own migration history table. Compatibility is the `api` / `admin_api` contract plus package tags. |
| Database tests | `supabase test db`. 62 pgTAP files under `supabase/tests/`. |
| Ops tests | `npm test` runs `scripts/ops/tests/*.test.mjs` only. It does not replace `supabase test db`. |
| Synthetic QA | `npm run provision:synthetic-qa` and `check:synthetic-qa`. These use the service role. Variable names are in `.env.example` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and per-hub `*_TEST_EMAIL` / `*_TEST_PASSWORD`). Do not prefix the service role with `VITE_` or `NEXT_PUBLIC_`. |

Changing a view or RPC that hubs call (`submit_attempt`, `published_curriculum_package`, `my_hub_activity_progress`) changes every deployed hub at once. Hubs do not vendor the SQL. Pinning Core does not pin the database.

## 9.3 Deployment

### Admin Portal

Workflow: `.github/workflows/pages.yml`.

- Triggers: push to `main`, or `workflow_dispatch`. The inspected working branch is not `main`. A push of that branch does not deploy until it is merged.
- Job `build`: checkout this repo, `learning-platform-core` with **no ref** (default branch), `learning-platform-content` at `v0.1.3`, `learning-platform-results` at `v0.1.2`. Node 22, `npm ci`, `npm run build:pages`.
- Build-time variables: `ADMIN_DATA_MODE`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` become `NEXT_PUBLIC_ADMIN_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Job `deploy`: environment `github-pages`, `actions/deploy-pages@v5`.
- Published URL recorded in `README.md` and `docs/deployment.md`: `https://acerosa.github.io/learning-platform-admin/`.
- Base path: `/learning-platform-admin/` (`vite.pages.config.ts`).

What a portal deploy does: it replaces the static bundle. It does not run migrations. A portal change that only calls an RPC which the hosted database does not have yet will fail at runtime with a PostgREST error, which the client shows as `unavailable` or `error.message`.

`worker/index.ts` is not what `pages.yml` deploys. A vinext/Cloudflare deployment was not found as a second workflow.

### Hubs and other front ends

Each hub has its own `pages.yml`: install pinned Core, Content and UI, `npm test`, deploy `dist` on a non-PR push to the configured branch. Unit 3 deploys from `main` or `unit-3-Cyber-Security-Hub`. The others inspected deploy from `main`. Reports deploys from `main` or `feat/phase-1b-session-reports`. The group generator deploys from `main` and injects `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

Libraries (`core`, `ui`, `results`, `cli`) have a quality workflow and no Pages site. Content had no workflow in the checkout that was read.

### Backend

Workflow: `learning-platform-backend/.github/workflows/database-tests.yml`.

- Repository validation (`validate_repository.py`).
- Ops script tests (`npm test`).
- Database tests: Supabase CLI 2.113.0, `db reset`, `supabase test db`.

That workflow does not deploy to the hosted project. Hosted release steps are in `docs/release-process.md`. Read that file before applying SQL. A backend change is live for every hub and for the portal as soon as the hosted migration succeeds. Old hub bundles keep working only while the `api` signature they call still exists. `submit_attempt` has already been replaced in place (4 arguments dropped, 8-argument form kept). Removing an argument hubs still send would break those hubs on the next request.

### Version compatibility

| Pin | Risk if ignored |
| --- | --- |
| Portal CI Content `v0.1.3` versus sibling `0.1.4` | Local authoring accepts documents Pages does not, or the reverse. |
| Portal CI Core with no tag | A Core default-branch change can change the portal’s theme helper without a portal commit. |
| Hub Core tags from `v0.2.5` (readiness) to `v0.2.27` (Unit 3) | Security and submission fixes in a newer Core do not reach an older hub until its workflow ref moves. |
| Results `v0.1.2` | Portal markbook and Reports must agree on interpretation. The library does not read the database, so an old Results build mis-labels rows rather than corrupting them. |
| `admin_api` contract constant `"0.2.0"` / `"draft"` | The constant is not enforced by Postgres. Drift is the missing names in `ADMIN_API_RPCS` described in [03 Backend integration](03_BACKEND_INTEGRATION.md). |

There is no automated check that every hub’s pin still typechecks against latest Core. Core’s own quality workflow does not install the hubs.

## 9.4 Testing

| Suite | Command | What it is for | Executed for this document |
| --- | --- | --- | --- |
| Portal unit | `npm run test:unit` | Version, seven primary areas, `admin_api`-only client, no email role check, responsive CSS | No |
| Portal authoring | `npm run test:authoring` | Drafts, publication payloads, navigation, hub registration arguments, markbook, analytics, auth phases, grouping poll | No |
| Portal accessibility | `npm run test:accessibility` | axe on rendered routes | No |
| Portal integration | `npm run test:integration` | Config rejects secret keys, sign-in mapping, learner denied, view method names, publish and review argument mapping | No |
| Portal full | `npm test` | Builds plus the mjs tests plus authoring | No |
| Core | `npm test` / `npm run check` in `learning-platform-core` | Submission allow-list, auth, conformance | No |
| Content | `npm test` | Schemas, learner-safe package, sanitise | No |
| UI | `npm test` (Vitest) | Components | No |
| Results | `npm test` | In-memory interpretation | No |
| Backend ops | `npm test` in the backend | Ops scripts only | No |
| Backend database | `supabase test db` | pgTAP for API, RLS, multi-course submission | No |
| Hubs | `npm test` in each hub | Node tests, Vitest, hub-security, learner-bundle, Vite build, post-build | No |
| Group generator | `npm test` | Join-code client | No |
| Reports | `npm test` | Vitest plus node tests | No |
| Doc generator | `PYTHONPATH=src python -m pytest` | Word generation | No |

`npm test` in the portal is a large command because it runs two production builds first. Use `test:unit` or `test:authoring` when changing one area.

Hub security and learner-bundle checks are part of hub `npm test`, not a separate hosted scanner. No OWASP ZAP, no dependency-review workflow, and no end-to-end browser suite (Playwright or Cypress) were found in the portal. Accessibility tests use jsdom and axe, which is not a browser session.

### Troubleshooting

| Symptom | Place to look |
| --- | --- |
| Demo data when a live backend was expected | `NEXT_PUBLIC_ADMIN_DATA_MODE` unset or not `live`. Invalid config shows an error instead of demo. |
| Access denied after a successful password | `current_staff_context` empty or `active_roles` without `platform_admin`. |
| `Platform not connected` | `callRpc` without a live client. Group Generator, library and composition need live mode. |
| Empty hub list while the dashboard shows hubs | `assertHubListMatchesSummary` treats that as unavailable. |
| Publication error in the dialog | `AdminPublicationError` message from `publish_curriculum` or `save_curriculum_draft` (validation, revision conflict, authorisation). |
| Learner submit returns `ACTIVITY_NOT_ASSIGNED` | No single active `learning.activity_assignments` row for that group and version. The portal cannot create that row yet. |
| Pages site calls the wrong Supabase project | The URL is fixed at build time from Actions variables, not from `.env.local`. |
| Local portal types differ from CI | `file:` siblings are newer or older than the workflow refs. |

Related: [10 Implementation status](10_IMPLEMENTATION_STATUS_AND_ROADMAP.md), [12 Technical reference](12_TECHNICAL_REFERENCE.md).
