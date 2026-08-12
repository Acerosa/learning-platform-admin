# Permissions

## Authority

The backend is the sole authority for administrative access. A browser display, route, hidden button or role label is not an authorisation control.

The current backend path is:

```text
auth.uid()
  → active learning.teachers profile
  → active platform.staff_roles record
  → admin_api RLS policy
```

Teacher status does not automatically confer platform administration.

## Prepared roles

The interface is designed for future contexts including Platform Administrator, Curriculum Administrator, Teacher, Course Administrator, Quality Reviewer and Read-only Auditor.

Backend 0.2.0 currently defines `platform_admin`, `curriculum_admin`, `operations`, `auditor` and `support`. The MVP portal requires `platform_admin`; it does not invent a permanent role-to-permission map for future product roles.

## Portal access states

- No Auth session: staff sign-in surface.
- Auth session without an active teacher mapping: access denied.
- Active teacher without `platform_admin`: access denied.
- Active teacher with active `platform_admin`: shell and live reads enabled.
- Live read/configuration failure: unavailable state with no demo substitution.

## UI policy

- No email-address or email-domain role checks.
- No local-storage permissions.
- Navigation may reflect backend-granted actions for usability, but backend RLS remains mandatory.
- Mutation controls must remain pending until the backend documents the required role/action.
- Access denial must be safe and must not reveal protected data.
- Demo mode receives an explicit demonstration action snapshot and is never treated as an authenticated session.
- The browser credential must be a publishable or legacy anon key; service-role and secret keys are rejected.

## Review requirements

Every new permission must define purpose, scope, least-privilege behaviour, denial behaviour, revocation, audit event and RLS/integration tests.
