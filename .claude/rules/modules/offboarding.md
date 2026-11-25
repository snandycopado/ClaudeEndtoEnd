---
paths:
  - "force-app/**/*Offboarding*"
  - "force-app/**/*Offboarding*/**"
  - "force-app/**/offboarding*/**"
---
# Offboarding module (prefix: Offboarding / offboarding) — PLANNED (not built yet)

Purpose: deactivate accounts and remove access when a relationship ends (reverse of onboarding).

## When the first story for this area starts
1. Impact plan first (story-to-plan skill): name the objects, entry points and permission set.
2. All metadata goes in force-app/main/default/ — use this area's file-name prefix so this rule loads.
3. Replace this file with the real description: purpose, entry points, key objects, permission set, tests,
   gotchas (under ~80 lines), and update the table in .claude/CLAUDE.md.

## Known context
- Reuse Account_Status__c (shared), e.g. move to Inactive, rather than a new status field — confirm with the architect.
- Likely mirrors onboarding: Offboarding_Task_Template__mdt + tasks; OffboardingService called from AccountTriggerHandler.
