# Deployment

## Current status

Version 0.1.0 is currently published to GitHub Pages from the `main` branch.
The local Phase 2 changes have not been deployed:

<https://acerosa.github.io/learning-platform-admin/>

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
