---
paths:
  - "force-app/**/*DocuSign*"
  - "force-app/**/*DocuSign*/**"
  - "force-app/**/*dsfs__*"
---
# DocuSign extensions (prefix: DocuSign) — PLANNED (not built yet)

Purpose: your own code that extends the DocuSign managed package (namespace dsfs__).

## When the first story for this area starts
1. Impact plan first (story-to-plan skill): name the objects, entry points and permission set.
2. All metadata goes in force-app/main/default/ — use this area's file-name prefix so this rule loads.
3. Replace this file with the real description: purpose, entry points, key objects, permission set, tests,
   gotchas (under ~80 lines), and update the table in .claude/CLAUDE.md.

## Hard rules
- The DocuSign package is not installed in the developer org yet.
- Only your own extension components (Apex, flows, LWCs using dsfs__ objects). Never edit, copy or retrieve
  the managed package's metadata — guard-protected-files blocks any dsfs__ file.
