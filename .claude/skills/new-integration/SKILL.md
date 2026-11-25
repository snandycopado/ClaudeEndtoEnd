---
name: new-integration
description: Add an outbound integration (Named Credential, External Credential, callout class, mock) on the Integration framework. Use when a story needs a callout to an external system (Zapzilla, Product, any REST API).
---
# New integration

## Precondition — read first
The Integration framework is **not built yet**. If `force-app/main/default/classes/IntegrationClient.cls`
does not exist, STOP and tell the user:
"This story needs the Integration framework first. I suggest story INT-001: build IntegrationClient +
IntegrationRequest/Response, callout logging via AppLogger, retry policy and HttpCalloutMock support."
Do not write a one-off callout instead.

## Once the framework exists
1. Named Credential + External Credential per system, named `<System>_API` (e.g. `Zapzilla_API`); never
   endpoints or secrets in code, Custom Metadata or Custom Settings. Secrets are entered in Setup by an admin.
2. Callout class `force-app/main/default/classes/<System>Client.cls` (prefix = the integration, e.g.
   `ZapzillaClient`), starting from `templates/SystemClient.cls`. It uses `callout:<System>_API` and the
   framework's request/response types.
3. Errors: wrap failures in `IntegrationException` with the original exception as cause; log with
   `AppLogger.error(ex, '<System>Client', '<operation>', recordId)`.
4. Callouts from triggers go through a Queueable (`Database.AllowsCallouts`), never synchronously.
5. Tests use `mock-template.cls` (HttpCalloutMock) for success, 4xx, 5xx and timeout.
6. Permission set `<System>_Integration_User` grants the External Credential principal access.
7. The security-reviewer subagent is mandatory for integration stories.
