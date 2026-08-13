# learning-platform-content 0.1.0

Vendored from `unit-14-software-engineering-for-business-hub` commit
`655e2d9168d80bf07b3d05bdb22d83c24f44e741` (`curriculum-engine-mvp`).

Copied unmodified:

- `content/schemas/*.json`
- `content/engine/{constants,block-registry,validate,load,resolve,render,importer,excel}.js`

`engine-bundle.js` concatenates those IIFE files for Admin browser/Node load.
The Admin portal depends on this copy; it does not own schema semantics.

Future extraction target: `learning-platform-content`.
