---
paths:
  - ".claude/e2e/**"
---

# E2E test rules (Playwright, `.claude/e2e/`)

- Skill: `.claude/skills/e2e-test/SKILL.md` · agent: `e2e-tester` · README: `.claude/e2e/README.md`.
- Layout: `lib/` generic (org access, Lightning helpers, test data) · `pages/<module>-*.js` page objects ·
  `specs/<module>/*.e2e.js` scenarios `TC-<nn>`.
- CommonJS `.js` (an `.mjs` config hangs with Playwright 1.49 on Node 24). Specs end in `.e2e.js`, so sfdx-lwc-jest never runs them.
- Login only through `global-setup.js` (sf front door, alias from `.claude/allowed-orgs`). No usernames, passwords,
  org IDs or URLs in specs — the repo is public.
- Lightning keeps old pages in the DOM: scope locators to `:visible`; navigate with `openRecord()` at the start of
  each test so a test never depends on a cached page.
- No `waitForTimeout`; use web-first `expect`. Verify UI and data (read-only `soql()`).
- Data is created through the UI, named `E2E-…`, and never deleted by the suite.
