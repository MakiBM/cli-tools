---
"@makibm/gites": patch
---

Fix crash on `installHook` in the published package: the bundled `hooks/pre-push`
was resolved for the source layout only, so setup/migration threw `ENOENT` from
the built `dist/src/` layout. Resolve the hook against both layouts.
