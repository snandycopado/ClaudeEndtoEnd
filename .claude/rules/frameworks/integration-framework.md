---
paths:
  - "force-app/**/classes/Integration*"
  - "force-app/**/classes/*Client.cls"
  - "force-app/**/namedCredentials/**"
  - "force-app/**/externalCredentials/**"
  - "force-app/**/remoteSiteSettings/**"
  - "force-app/**/objects/Integration_Setting__mdt/**"
---
# Integration framework (architect-owned) — NOT BUILT YET

Reserved names: `Integration*` classes and `Integration_Setting__mdt` (the hooks treat them as framework).

## Until it exists
No callouts. If a story needs one, stop and propose story INT-001 (see the `new-integration` skill).
`IntegrationException` already exists in the exception framework.

## Intended design (confirm with the architect in INT-001)
- `IntegrationClient` — sends via `callout:<System>_API` Named Credentials only; timeouts; retry for
  idempotent calls; failures → `IntegrationException`.
- `IntegrationRequest` / `IntegrationResponse` typed wrappers; correlation id carried into AppLogger.
- Callout logging through AppLogger, never secrets or full PII bodies.
- From triggers: a Queueable implementing `Database.AllowsCallouts`.
- `Integration_Setting__mdt` per system: enabled, timeout, retry count.
- Test support: HttpCalloutMock helpers for success / 4xx / 5xx / timeout.

When built: replace this file with real class names and a short usage example; update the table in .claude/CLAUDE.md.
