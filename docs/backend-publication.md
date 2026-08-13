# Backend curriculum publication

Admin remains the authoring system. After a local Published snapshot exists,
staff can send it to the platform backend. The backend is the authoritative
published catalogue. Learner hubs are not updated by this step and never
receive Draft or Review data.

```text
Admin Draft → Review → Approved → local Published snapshot
        → Publish to Platform
            → admin_api.publish_curriculum
                → platform.curriculum_publications
                    → api.published_curriculum metadata
```

There is no GitHub automation and no write into learner repositories.

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

`api.published_curriculum()` exposes current package metadata. Wiring a hub
renderer to that catalogue is later work. Unit 14 rendering is unchanged.
