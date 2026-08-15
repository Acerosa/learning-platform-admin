# Backend curriculum publication

Admin remains the authoring system. After a local Published snapshot exists,
staff can send it to the platform backend. The backend is the authoritative
published catalogue. Learner hubs load that published package at runtime and
never receive Draft or Review data.

```text
Admin Draft → Review → Approved → local Published snapshot
        → Publish to Platform
            → admin_api.publish_curriculum
                → platform.curriculum_publications
                → delivery catalogue projection
                    → api.published_curriculum_package
```

There is no GitHub automation and no write into learner repositories. A
GitHub Pages redeploy is not required for normal curriculum publication.

## Admin responsibilities

- Author and review locally.
- Freeze an immutable local version with **Publish immutable version**.
- Call **Publish to Platform** only for that Approved/Published snapshot.
- Show Pending, Publishing, Published, or Failed for the platform call.
- Display backend publication history from `admin_api.curriculum_publications`.
- Never send a service-role key. Never query `learning` or `platform` schemas.
- Keep `updateCurriculum` and other general mutations pending.

## Backend ownership

The browser does not decide whether a package is valid. `admin_api.publish_curriculum`
authenticates `auth.uid()`, requires `platform_admin`, validates the package
again, and inserts an immutable catalogue row. A newer version marks the
previous current row Superseded.

## Audit and versioning

Each successful publish is audited. Rollback is Restore as Draft, review, and
publish a new version. Existing published rows are never edited or deleted.

## Future learner-hub consumption

Learner hubs fetch `api.published_curriculum_package`. Wiring a hub renderer
to Admin localStorage is prohibited. Unit 14 loads the published package at
runtime and uses the bundled snapshot only as fallback.
