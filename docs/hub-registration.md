# Hub registration

Hub registration is an administrative write. It is not curriculum publication.

```text
Hub Registry
  -> Register hub
  -> paste or upload learning-platform-hub.json, or complete the equivalent form
  -> validate and show diagnostics
  -> preview
  -> confirm
  -> admin_api.register_hub
  -> registry and dashboard refresh
```

The portal never writes `platform.hubs` or other protected schemas from the
browser. Live mode uses the public Supabase credential and the authenticated
staff session. Authority is enforced by the backend `platform_admin` role
check inside `admin_api.register_hub`.

The form fields are the LHDS `learning-platform-hub.json` contract plus
lifecycle status. Unknown manifest fields are rejected. Invalid manifests are
not submitted.

Duplicate hub codes are rejected and do not overwrite an existing registry
row. Course associations are created only when the current registration
contract can link them in the same transaction.

## Demo mode

Demo mode never calls the live mutation RPC. A clearly labelled synthetic
local registration updates the current session snapshot so staff can rehearse
the workflow. It is not an authenticated backend write.

## Curriculum publication

Publishing weeks, activities and questions is a later, separate workflow
through `admin_api.publish_curriculum`. Registering a hub does not publish
curriculum and does not modify learner hubs.
