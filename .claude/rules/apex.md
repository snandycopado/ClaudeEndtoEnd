---
paths:
  - "**/*.cls"
  - "**/*.trigger"
---
# Apex rules

## Structure
- Trigger file: one line, `new <Object>TriggerHandler().run();`, all 7 events declared.
- Handler: `extends TriggerHandler`, overrides only the contexts it needs, casts `newList`/`oldMap`, delegates
  to a service. No SOQL/DML in the handler beyond selecting records to pass on.
- Service: `<Module><Noun>Service`, static methods taking `Set<Id>`/`List<SObject>` (bulk).
- Controller for LWC: `<Feature>Controller`, `with sharing`, thin — calls the service.
- Constants for picklist values live on the service (`OnboardingService.ACCOUNT_ACTIVE`), never inline strings twice.

## Access mode (API 67 enforces the running user's FLS on SOQL and DML — verified)
- User actions (controllers): `WITH USER_MODE`, `insert as user` / `update as user`,
  `Database.queryWithBinds(q, binds, AccessLevel.USER_MODE)` for dynamic SOQL.
- Automation (trigger services, queueables, audit/log writes): `WITH SYSTEM_MODE`,
  `Database.insert(records, AccessLevel.SYSTEM_MODE)`.
- Updating a record you queried with read-only fields fails in user mode — update a fresh
  `new X__c(Id = id, Field__c = value)` instead.
- `without sharing` only for automation that must work regardless of the user's record access, with the
  reason in the class header (see OnboardingService).

## Errors
- `try { … } catch (DmlException ex) { AppLogger.error(ex, CLASS_NAME, 'method', recordId); AppLogger.save(); throw …; }`
- Never `catch (Exception e) {}` and never only `System.debug`.
- Business-rule failures: `throw new ValidationException('message the user can act on');`
- `@AuraEnabled`: pass `ValidationException` messages through; log anything else, then
  `AuraHandledException ex = new AuraHandledException(msg); ex.setMessage(msg); throw ex;`

## Limits and bulk
- No SOQL/DML/callouts/`EventBus.publish`/`Messaging.sendEmail` inside loops — collect, then act once.
- Emails: `Messaging.reserveSingleEmailCapacity(n)` first; send in one `sendEmail(list, false)` call.
- Async work from triggers: one Queueable per transaction; check `Limits.getQueueableJobs()`.
- Custom Metadata: `X__mdt.getAll()` / `getInstance()`; add a `@TestVisible` override list for tests.

## Platform gotchas in this org
- Publishing a platform event needs Create on the event (Application_Logger permission set).
- Long text fields cannot be filtered in SOQL — filter in Apex.
- State/Country picklists are enabled — use full names ('United States', 'India').
- `inner` is a reserved word; so are `limit`, `group`, `order` as identifiers.

## Never
- Hard-coded Ids, URLs, endpoints or credentials. `SeeAllData=true`. SOQL built by concatenating user input
  (use binds). Callouts outside the Integration framework.
