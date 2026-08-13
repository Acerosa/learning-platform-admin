# Testing

## Commands

```bash
npm run lint
npm run typecheck
npm run test:integration
npm test
npm run test:accessibility
npm run test:unit
```

## Coverage

- **Routing and navigation:** all 16 modules have unique routes, labels and navigation entries.
- **Permissions:** source checks reject email-based role logic and document backend authority.
- **Dashboard and modules:** rendered route tests verify backend-shaped metrics, tables, attempts, analytics and pending states.
- **Hub registry, curriculum and people:** source/data contract tests verify the reviewed registry and synthetic fixtures.
- **Curriculum authoring:** factories, stable IDs, JSON/Excel import, sanitisation, drafts, preview, export, publication lifecycle, compare, restore and shared content-engine interoperability.
- **Accessibility:** axe checks run against server-rendered dashboard and module routes, including `/curriculum`; semantic checks cover landmarks, skip links, labels, tabs and scoped table headers.
- **Responsive behaviour:** CSS contract tests require tablet/mobile breakpoints, contained table overflow, off-canvas navigation and reduced-motion support.
- **Platform-core integration:** dependency, CSS and theme-service usage are asserted.
- **Live integration:** adapter tests cover safe runtime configuration,
  learner/non-admin denial, platform-admin access, all MVP view mappings,
  admin-only schema usage, PII-safe selections and failed-live-read behaviour.
- **Database integration:** backend pgTAP covers learner, ordinary-teacher and
  platform-admin access to staff context and aggregates.

## Deliberate limits

Automated static and DOM checks are not a substitute for keyboard-only journeys, assistive-technology testing, real authenticated API/RLS integration, multi-browser/device testing or a production performance budget. Those remain certification work before release.
