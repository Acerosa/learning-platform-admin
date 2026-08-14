# Hub registration

Hub registration is an administrative write. It is not curriculum publication.

```text
Hub Registry
  -> Register hub or Edit hub
  -> paste or upload learning-platform-hub.json, or complete the equivalent form
  -> validate and show diagnostics
  -> preview
  -> confirm
  -> admin_api.register_hub or admin_api.update_hub
  -> registry, course links, dashboard and audit refresh
```

The portal never writes `platform.hubs` or other protected schemas from the
browser. Live mode uses the public Supabase credential and the authenticated
staff session. Authority is enforced by the backend `platform_admin` role
check inside `admin_api.register_hub` and `admin_api.update_hub`.

The form fields are the LHDS `learning-platform-hub.json` contract plus
lifecycle status. Unknown manifest fields are rejected. Invalid manifests are
not submitted.

Validation rejects duplicate hub codes, duplicate repository or site URLs,
unsupported contract versions, missing courses, inactive courses, and active
hubs that are not in testing, production or maintenance. Hub codes cannot be
changed after registration. Updates reuse the same manifest contract and
synchronise course links in the same transaction.

## Demo mode

Demo mode never calls the live mutation RPC. A clearly labelled synthetic
local registration or update changes the current session snapshot so staff can
rehearse the workflow. It is not an authenticated backend write.

## Curriculum publication

Publishing weeks, activities and questions remains a separate workflow through
`admin_api.publish_curriculum`. Registering or updating a hub does not store
curriculum and does not modify learner hubs. See
[Platform management](platform-management.md).
