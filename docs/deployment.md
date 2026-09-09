# Deployment

## Current status

GitHub Pages publishes Admin from `main`
(https://acerosa.github.io/learning-platform-admin/).

Curriculum authoring, Content Library and Composition are production Admin
routes. Hosted Admin correctly denies sessions that are not `platform_admin`.
The intended administrator is `ricardo.rosa@nhc.ac.uk`.

Teaching-content publication does not use this Pages workflow. Application
changes do.

## Build

```bash
npm install
npm run build
npm run build:pages
```

The normal build retains the vinext application output for local and compatible worker environments. The Pages build performs a full static export under the repository base path. GitHub Actions publishes that static output; GitHub Pages never serves the repository README as the application.

## Environment

Deployment configuration remains environment-driven. A live environment may contain only:

- Supabase project URL;
- public browser credential;
- non-secret portal configuration and feature state.

It must never contain service-role keys, database passwords, access tokens committed to source, or environment-specific permission rules.

The GitHub Pages workflow reads non-secret repository variables named
`ADMIN_DATA_MODE`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Blank mode
defaults to demo. A hosted Supabase project must explicitly allow the final
Pages URL as an Auth redirect before live mode is enabled.

### Supabase Authentication settings Ricardo must confirm

These are Dashboard settings. This repository cannot change them.

**Authentication → Providers → Email**

- Enable Email provider.
- Enable email and password sign-in (do not disable password authentication).
- Confirm-email policy should match how the first administrator was created.

**Authentication → URL Configuration**

- Site URL: `https://acerosa.github.io/learning-platform-admin/`
- Redirect URLs must include:
  - `https://acerosa.github.io/learning-platform-admin/`
  - `https://acerosa.github.io/learning-platform-admin/**`
  - local development origins used with `npm run dev` (for example
    `http://localhost:3000/` and `http://localhost:5173/`)

Do not set Site URL to `https://acerosa.github.io/` without the repository
path. Password-reset emails use the Site URL / redirect allow list. Magic
links also need that allow list and must be opened in the same browser that
requested them (PKCE).

**Email / SMTP**

- Default Supabase SMTP is enough for development and early production volume.
- Do not change custom SMTP without a separate approval.

See [Authentication](authentication.md).

## Release gate

A production release requires:

1. Explicit version and release notes.
2. Static analysis, build and regression tests.
3. Accessibility and responsive review.
4. Authenticated hosted `admin_api`/RLS integration tests using synthetic identities.
5. Security and privacy review.
6. Compatibility review against active hubs and backend contract versions.
7. Rollback and deployment-verification plan.
8. Explicit approval to deploy.
