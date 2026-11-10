# Exception framework examples (real code in this repo)

## Business rule in a service
```apex
if (vendorIds == null || vendorIds.isEmpty()) {
    throw new ValidationException('Select at least one vendor account.');
}
```
From `LcmNotificationService.validate`.

## Continue on failure, log with record id, save once
```apex
for (Onboarding_Task__c task : tasks) {
    try {
        messages.add(buildMessage(templateId, task.Account__r.OwnerId, task.Id));
    } catch (Exception ex) {
        AppLogger.error(ex, CLASS_NAME, 'buildMessage', task.Id);
    }
}
// … send …
AppLogger.save();
```
From `OnboardingEmailQueueable.execute`.

## Warning without an exception
```apex
AppLogger.log(AppLogger.Severity.WARN, 'No active onboarding templates match record type ' + rtName,
    CLASS_NAME, 'startOnboarding', acc.Id);
```

## @AuraEnabled boundary
```apex
private static AuraHandledException toAuraException(Exception ex, String method, Id recordId) {
    String message = ex.getMessage();
    if (!(ex instanceof ValidationException)) {
        AppLogger.error(ex, CLASS_NAME, method, recordId);
        AppLogger.save();
        message = 'Something went wrong: ' + message;
    }
    AuraHandledException auraEx = new AuraHandledException(message);
    auraEx.setMessage(message); // without this, tests and some clients see "Script-thrown exception"
    return auraEx;
}
```
From `LcmNotificationController`.

## DML failure surfaced to the user
```apex
} catch (Exception ex) {
    AppLogger.error(ex, CLASS_NAME, 'completeTask', taskId);
    AppLogger.save();
    String message = ex instanceof DmlException ? ((DmlException) ex).getDmlMessage(0) : ex.getMessage();
    …
}
```
From `OnboardingTaskController.completeTask`.

## Callout (once the Integration framework exists)
```apex
} catch (Exception ex) {
    AppLogger.error(ex, 'ZapzillaClient', 'syncStatus', recordId);
    throw new IntegrationException('Zapzilla status sync failed: ' + ex.getMessage(), ex);
}
```

## Reading logs
Error Logs tab (permission set `Error_Log_Admin`), or
`SELECT Name, Severity__c, Source_Class__c, Message__c, Record_Id__c FROM Error_Log__c ORDER BY CreatedDate DESC`.
