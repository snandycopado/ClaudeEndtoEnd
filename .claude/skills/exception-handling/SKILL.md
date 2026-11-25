---
name: exception-handling
description: How and where to log and throw errors with the core exception framework (AppLogger, ValidationException, IntegrationException, AuraHandledException). Use when writing try/catch, error handling, or logging in Apex.
---
# Exception handling

Decide by layer — then copy the matching pattern from `examples.md`:

| Layer | Do |
|---|---|
| Trigger handler | Nothing extra. `TriggerHandler.run()` logs unhandled exceptions and rethrows. |
| Service (business rule broken) | `throw new ValidationException('message the user can act on');` — not logged. |
| Service (unexpected failure, must continue) | `AppLogger.error(ex, CLASS, 'method', recordId);` collect, `AppLogger.save()` once at the end. |
| Callout | Wrap in `IntegrationException(msg, ex)`, log, rethrow or record failure. |
| Queueable / Batch | catch per record/chunk, log with record id, `AppLogger.save()` in `execute` / `finish`. |
| `@AuraEnabled` | `ValidationException` → message as-is. Anything else → log + `AuraHandledException` with `setMessage`. |
| LWC | Toast with `reduceError(error)`; keep the user's input. |

Rules:
- `AppLogger.save()` costs one DML statement; call it once per unit of work, not per entry.
- Logs survive rollback only when the user has the `Application_Logger` permission set (platform event
  publish). Without it AppLogger falls back to a direct insert that rolls back with the transaction.
- Never `catch (Exception e) {}`; never only `System.debug`; never show stack traces to users.
- New exception types extend `ApplicationException` and are named `*Exception` (exception framework — asks first).
