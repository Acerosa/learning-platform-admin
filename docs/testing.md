# Testing

## Commands

```bash
npm run lint
npm test
npm run test:accessibility
npm run test:unit
```

## Coverage

- **Routing and navigation:** all 15 modules have unique routes, labels and navigation entries.
- **Permissions:** source checks reject email-based role logic and document backend authority.
- **Dashboard and modules:** rendered route tests verify key headings, tables and pending states.
- **Hub registry, curriculum and people:** source/data contract tests verify the reviewed registry and synthetic fixtures.
- **Accessibility:** axe checks run against server-rendered dashboard and module routes; semantic checks cover landmarks, skip links, labels and scoped table headers.
- **Responsive behaviour:** CSS contract tests require tablet/mobile breakpoints, contained table overflow, off-canvas navigation and reduced-motion support.
- **Platform-core integration:** dependency, CSS and theme-service usage are asserted.

## Deliberate limits

Automated static and DOM checks are not a substitute for keyboard-only journeys, assistive-technology testing, real authenticated API/RLS integration, multi-browser/device testing or a production performance budget. Those remain certification work before release.
