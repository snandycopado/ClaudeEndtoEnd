/**
 * Converts Error_Log_Event__e into Error_Log__c records. Called from ErrorLogEventTrigger.
 *
 * Deliberately does NOT extend TriggerHandler or use AppLogger: a failure here must never
 * publish another log event, or it could loop.
 */
public without sharing class ErrorLogEventSubscriber {
    public static void createLogs(List<Error_Log_Event__e> events) {
        insertLogs(toLogs(events));
    }

    /** Also used by AppLogger's fallback when the publishing user cannot publish the event. */
    public static void insertLogs(List<Error_Log__c> logs) {
        for (Database.SaveResult result : Database.insert(logs, false, AccessLevel.SYSTEM_MODE)) {
            if (!result.isSuccess()) {
                for (Database.Error err : result.getErrors()) {
                    System.debug(LoggingLevel.ERROR, 'ErrorLogEventSubscriber: insert failed: ' + err.getMessage());
                }
            }
        }
    }

    public static List<Error_Log__c> toLogs(List<Error_Log_Event__e> events) {
        List<Error_Log__c> logs = new List<Error_Log__c>();
        for (Error_Log_Event__e evt : events) {
            logs.add(
                new Error_Log__c(
                    Severity__c = evt.Severity__c,
                    Message__c = evt.Message__c,
                    Source_Class__c = evt.Source_Class__c,
                    Source_Method__c = evt.Source_Method__c,
                    Exception_Type__c = evt.Exception_Type__c,
                    Stack_Trace__c = evt.Stack_Trace__c,
                    Line_Number__c = evt.Line_Number__c,
                    Record_Id__c = evt.Record_Id__c,
                    Request_Id__c = evt.Request_Id__c,
                    Quiddity__c = evt.Quiddity__c,
                    Logged_At__c = evt.Logged_At__c,
                    User__c = toUserId(evt.User_Id__c)
                )
            );
        }
        return logs;
    }

    private static Id toUserId(String value) {
        if (String.isBlank(value) || !value.startsWith('005')) {
            return null;
        }
        try {
            return Id.valueOf(value);
        } catch (StringException ex) {
            return null;
        }
    }
}
