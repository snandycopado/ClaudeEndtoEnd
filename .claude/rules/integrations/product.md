---
paths:
  - "force-app/**/ProductIntegration*"
  - "force-app/**/ProductClient*"
  - "force-app/**/namedCredentials/Product_*"
---
# Product integration (prefix: ProductIntegration / ProductClient) — PLANNED (not built yet)

Purpose: product catalogue / product system integration.

## When the first story for this area starts
1. Impact plan first (story-to-plan skill): name the objects, entry points and permission set.
2. All metadata goes in force-app/main/default/ — use this area's file-name prefix so this rule loads.
3. Replace this file with the real description: purpose, entry points, key objects, permission set, tests,
   gotchas (under ~80 lines), and update the table in .claude/CLAUDE.md.

## Known context
- Needs the Integration framework first (INT-001). new-integration skill. Named Credential `Product_API`.
