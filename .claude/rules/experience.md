---
paths:
  - "force-app/**/experiences/**"
  - "force-app/**/digitalExperiences/**"
  - "force-app/**/networks/**"
  - "force-app/**/sites/**"
  - "force-app/**/sharingSets/**"
---
# Experience Cloud — PLANNED (not built yet)

Purpose: partner and customer sites, guest user configuration.

## When the first story for this area starts
1. Impact plan first (story-to-plan skill): name the objects, entry points and permission set.
2. All metadata goes in force-app/main/default/ — use this area's file-name prefix so this rule loads.
3. Replace this file with the real description: purpose, entry points, key objects, permission set, tests,
   gotchas (under ~80 lines), and update the table in .claude/CLAUDE.md.

## Known context
- security-reviewer subagent is mandatory: guest user access, sharing sets, guest sharing rules.
- Apex exposed to sites: `with sharing`, validate every Id against the user's access.
