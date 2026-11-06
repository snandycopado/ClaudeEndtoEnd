---
paths:
  - "force-app/**/classes/AppLogger*"
  - "force-app/**/classes/*Exception.cls"
  - "force-app/**/classes/ErrorLogEvent*"
  - "force-app/**/triggers/ErrorLogEvent*"
  - "force-app/**/objects/Error_Log__c/**"
  - "force-app/**/objects/Error_Log_Event__e/**"
  - "force-app/**/permissionsets/Application_Logger*"
  - "force-app/**/permissionsets/Error_Log_Admin*"
---
# Exception framework (architect-owned — edits ask for approval)

`AppLogger` buffers entries and on `save()` publishes `Error_Log_Event__e` (Publish Immediately), so entries
survive a rollback. `ErrorLogEventTrigger` → `ErrorLogEventSubscriber` writes `Error_Log__c`.
Exceptions: `ApplicationException` ← `ValidationException`, `IntegrationException`.

Components: AppLogger(+Test), ErrorLogEventSubscriber, ApplicationException, ValidationException,
IntegrationException, ErrorLogEventTrigger, Error_Log__c (ERR-000000: Severity, Source Class/Method, Message,
Stack Trace, Line, Record Id, User, Request Id, Quiddity, Logged At), Error_Log_Event__e, tab Error_Log__c,
permission sets Application_Logger (Create on the event — EVERY user) and Error_Log_Admin (tab + full access).

## Mandatory usage
```apex
AppLogger.error(ex, 'OnboardingService', 'startOnboarding', accountId);
AppLogger.warn('No templates for record type Partner', 'OnboardingService', 'startOnboarding');
AppLogger.log(AppLogger.Severity.WARN, message, CLASS_NAME, 'method', recordId);
AppLogger.save();                                                         // once per unit of work
throw new ValidationException('Select at least one vendor account.');    // user-facing rule
throw new IntegrationException('Zapzilla returned 503', calloutEx);       // wrap the cause
```
Patterns by layer: `exception-handling` skill.

## Gotchas
- Without `Application_Logger` the user cannot publish the event; `save()` falls back to a direct insert
  that rolls back with the transaction.
- `save()` = one DML statement; entries are dropped (System.debug) if the DML limit is reached.
- `ErrorLogEventSubscriber` must never use AppLogger or TriggerHandler (a failing log would log itself).
- Subscriber runs as Automated Process; the originating user is in `User_Id__c`.
- Tests: event-written logs appear after `Test.stopTest()`; query `WITH SYSTEM_MODE`.

## Never change
- Publish Immediately on Error_Log_Event__e. Public AppLogger signatures (every module calls them).
