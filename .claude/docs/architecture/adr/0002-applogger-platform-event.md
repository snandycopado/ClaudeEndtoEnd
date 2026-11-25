# ADR-0002: Log through a Publish-Immediately platform event

- Status: Accepted (2026-11-06)
- Context: Errors are most important when a transaction fails — and a failed transaction rolls back any
  log record inserted in it.
- Decision: AppLogger buffers entries and publishes Error_Log_Event__e (Publish Immediately) on save();
  ErrorLogEventTrigger writes Error_Log__c. If the user cannot publish the event (no Application_Logger
  permission set), AppLogger falls back to a direct system-mode insert.
- Consequences: Logs survive rollback for users with Application_Logger. Every user must get that permission
  set. Each save() costs one DML statement. The subscriber must never log through AppLogger itself.
