# Admin Portal authentication

The Central Admin Portal uses **Supabase email and password authentication**.
Supabase Auth owns credentials. The backend remains the only authority for
staff and administrator access.

```text
Email + password
      │
      ▼
Supabase Auth (signInWithPassword)
      │
      ▼
Authenticated session (auth.uid())
      │
      ▼
admin_api.current_staff_context
      │
      ▼
active learning.teachers row
      │
      ▼
active platform.staff_roles.role = platform_admin
      │
      ▼
Admin Portal shell and admin_api reads
```

Successful sign-in is not sufficient. An authenticated learner, or an
authenticated teacher without `platform_admin`, sees the access-denied
state and cannot read protected Admin views.

## What the browser may do

- Collect email and password and call `supabase.auth.signInWithPassword`.
- Restore and refresh the Supabase session.
- Request a password reset through `supabase.auth.resetPasswordForEmail`.
- Update a password during a recovery session with `supabase.auth.updateUser`.
- Optionally request a magic link through `supabase.auth.signInWithOtp`.
- Read `admin_api.current_staff_context` after Auth restores a session.
- Hide navigation that the current backend context does not grant.

## What the browser must not do

- Decide that an email address, domain, query parameter or `localStorage`
  value is an administrator.
- Store passwords.
- Use a service-role or secret key.
- Grant `platform_admin` through Auth metadata or a client-submitted role.

## Portal states

| Status | Auth phase | Meaning |
| --- | --- | --- |
| `signed-out` | unauthenticated | No Auth session. Sign-in form. |
| `authenticating` | authenticating | Password or magic-link request in flight. |
| `loading` | authorising | Session present; staff context is being loaded. Protected data is not shown. |
| `ready` | authorised | Backend returned an active `platform_admin` context. |
| `access-denied` | forbidden | Authenticated, but not an authorised administrator. |
| `recovery` | recovery | Password-recovery session. Choose a new password only. |
| `error` | error | Live backend or Auth is unavailable. Demo data is not substituted. |

`getSession()` is not proof of administrator access.

## Password reset

1. Sign-in screen → **Forgot password** → enter email.
2. The portal calls `resetPasswordForEmail` with redirect
   `https://acerosa.github.io/learning-platform-admin/?type=recovery` on
   GitHub Pages (or `/?type=recovery` on local Next). Hash routes are not
   placed in the redirect URL, so the PKCE `?code=` query remains valid.
   The `type=recovery` marker prevents a recovery session from loading
   Admin data before the password form is shown.
3. The user opens the email in the same browser.
4. Supabase Auth establishes a recovery session.
5. The portal shows **Choose a new password**.
6. `updateUser({ password })` updates the Auth credential.
7. The portal then loads `admin_api.current_staff_context` as usual.

## First administrator

Production already has one active administrator, created through the original
one-time `admin_api.claim_initial_platform_admin` claim. That credential is
**consumed** and must not be reused.

For a **new** environment, or if a replacement first administrator is
required, do **not** use a public setup URL. Use the dashboard plus SQL
below. Do not put the administrator password in this repository.

### Step A — create the Auth user

In the Supabase Dashboard → Authentication → Users:

1. Add a user with the administrator email.
2. Set a temporary password.
3. Confirm the email if the project requires confirmed emails.

Copy the Auth user UUID (`auth.users.id`).

### Step B — associate `learning.teachers`

Run this as a privileged database operator (Dashboard SQL editor or an
approved service-role process). Replace the UUID.

```sql
insert into learning.teachers (
  auth_user_id,
  staff_reference,
  display_name,
  active
)
select
  auth_user.id,
  'PLATFORM-ADMIN',
  'Platform Administrator',
  true
from auth.users as auth_user
where auth_user.id = '<AUTH_USER_UUID>'
  and not exists (
    select 1
    from learning.teachers as teacher
    where teacher.auth_user_id = auth_user.id
  );
```

### Step C — assign `platform_admin`

```sql
insert into platform.staff_roles (
  teacher_id,
  role
)
select
  teacher.id,
  'platform_admin'
from learning.teachers as teacher
where teacher.auth_user_id = '<AUTH_USER_UUID>'
  and not exists (
    select 1
    from platform.staff_roles as staff_role
    where staff_role.teacher_id = teacher.id
      and staff_role.role = 'platform_admin'
      and staff_role.revoked_at is null
  );
```

The `NOT EXISTS` guards make the statements safe to re-run. They do not
create a second active `platform_admin` grant for the same teacher.

### Step D — verify

1. Sign into the Admin Portal with email and password.
2. Confirm `admin_api.current_staff_context` returns `platform_admin`.
3. Confirm an ordinary learner session cannot select Admin views.
4. Confirm Synthetic Teacher A / B (or another teacher without
   `platform_admin`) is denied portal data.

Never repeat this bootstrap for normal staff provisioning.

## Subsequent administrators

The People → Staff screen lists `admin_api.staff_roles` and still uses the
pending “Invite staff” placeholder. There is no administrator-only mutation
that creates Auth users or grants `platform_admin` from the browser.

Until that RPC exists, additional administrators are provisioned the same
way as the first: create the Auth user in the Dashboard, then insert
`learning.teachers` and `platform.staff_roles` with a privileged SQL
session. Ordinary authenticated users cannot insert those rows; grants are
`SELECT` only and RLS remains enabled.

Do not ask a second person to self-register in the Admin Portal and become
an administrator. `auth.signUp` does not create a teacher or a staff role.

## Magic links

Email sign-in links remain a secondary option. They are more fragile on
GitHub Pages because PKCE requires the same browser that requested the
link, and the Supabase Site URL / redirect allow list must include
`https://acerosa.github.io/learning-platform-admin/`. Password sign-in is
the supported production path.
