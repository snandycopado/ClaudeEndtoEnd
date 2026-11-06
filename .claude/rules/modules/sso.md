---
paths:
  - "force-app/**/Sso*"
  - "force-app/**/sso*/**"
  - "force-app/**/authproviders/**"
  - "force-app/**/samlssoconfigs/**"
---
# Single Sign-On module (prefix: Sso / sso) — PLANNED (not built yet)

Purpose: SSO configuration and user provisioning (permission set assignment) for internal and Experience Cloud users.

## When the first story for this area starts
1. Impact plan first (story-to-plan skill): name the objects, entry points and permission set.
2. All metadata goes in force-app/main/default/ — use this area's file-name prefix so this rule loads.
3. Replace this file with the real description: purpose, entry points, key objects, permission set, tests,
   gotchas (under ~80 lines), and update the table in .claude/CLAUDE.md.

## Known context
- security-reviewer subagent is mandatory for every SSO story.
- Auth providers, SAML/OIDC configs and certificates are set up by an admin; never commit secrets or certificates.
