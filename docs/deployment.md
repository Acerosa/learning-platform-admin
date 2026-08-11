# Deployment

## Current status

Version 0.1.0 is a local foundation. It has not been committed, pushed, deployed or published.

## Build

```bash
npm install
npm run build
```

The generated application is Cloudflare Worker-compatible through the retained Sites/vinext build configuration. Hosting is intentionally not configured in this version.

## Future environments

Deployment configuration must remain environment-driven. A future live environment may contain only:

- Supabase project URL;
- public browser credential;
- non-secret portal configuration and feature state.

It must never contain service-role keys, database passwords, access tokens committed to source, or environment-specific permission rules.

## Release gate

A production release requires:

1. Explicit version and release notes.
2. Static analysis, build and regression tests.
3. Accessibility and responsive review.
4. Authenticated hosted `admin_api`/RLS integration tests.
5. Security and privacy review.
6. Compatibility review against active hubs and backend contract versions.
7. Rollback and deployment-verification plan.
8. Explicit approval to deploy.
