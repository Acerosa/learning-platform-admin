# Platform management

The Administration Portal manages registered learner hubs as platform records.
It does not author curriculum, render learner activities, or deploy hubs.

```text
Hub Registry
  -> list, inspect, register, edit, enable or disable
  -> admin_api.hubs / admin_api.courses / admin_api.curriculum_publications
  -> admin_api.register_hub / admin_api.update_hub
  -> health and publication status derived in the portal
```

A future hub is added by registering a reviewed `learning-platform-hub.json`.
The portal does not need a new module, route or source change for that hub.

## What staff can do

- Search and filter registered hubs.
- Open hub details: metadata, linked courses, contracts, capabilities.
- Register a hub through the existing LHDS manifest contract.
- Edit hub metadata, lifecycle, course links and enablement.
- Enable or disable a hub without deleting the registry row.
- See linked curriculum publication status.
- See informational hub health.
- See registration and update history from `admin_api.audit_events`.

## Publication status

The Hub Registry does not publish. It reads:

- local authoring records in this browser, when present;
- `admin_api.curriculum_publications` for the hub.

Displayed labels are Draft, Ready for Review, In Review, Approved, Published,
Superseded, Archived, or No curriculum. Platform catalogue rows are only
Published or Superseded. Local authoring supplies the earlier states.

## Health

Hub health is computed from the current snapshot. It is informational.

Checks include hub registration, active course link, publication availability,
current package version, schema version, Core / learner API / submission
compatibility, UI and Content notes, and backend `admin-api` 0.2.0 presence.

Hub Manifest 1.0.0 does not declare UI or Content package versions. Those
checks are labelled informational and do not fail registration.

## Out of scope

Course creation, GitHub publication, learner-hub deployment, Unit 3 / T Level
source changes and curriculum authoring remain separate workflows.
