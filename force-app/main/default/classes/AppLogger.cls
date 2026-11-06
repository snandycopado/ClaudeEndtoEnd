/**
 * Application logging and exception capture.
 *
 * Entries are buffered in memory and published as Error_Log_Event__e (Publish Immediately) when
 * save() is called, so they are persisted to Error_Log__c even if the transaction rolls back.
 *
 *     try {
 *         ...
 *     } catch (DmlException ex) {
 *         AppLogger.error(ex, 'OnboardingService', 'createUser', contactId);
 *         AppLogger.save();
 *         throw new ApplicationException('Could not create user for ' + contactId, ex);
 *     }
 *
 *     AppLogger.info('Batch finished: 200 records', 'OffboardingBatch', 'finish');
 *     AppLogger.save();
 *
 * Call save() once at the end of a unit of work (each save costs one DML statement).
 * TriggerHandler already logs and saves unhandled exceptions from handlers.
 */
public without sharing class AppLogger {
    public enum Severity {
        ERROR,
        WARN,
        INFO,
        DEBUG
    }

    @TestVisible
    private static final Integer LONG_TEXT_LIMIT = 32768;
    @TestVisible
    private static final Integer TEXT_LIMIT = 255;

    @TestVisible
    private static List<Error_Log_Event__e> pending = new List<Error_Log_Event__e>();

    // ------------------------------------------------------------------ exceptions

    public static void error(Exception ex, String sourceClass, String sourceMethod) {
        error(ex, sourceClass, sourceMethod, null);
    }

    public static void error(Exception ex, String sourceClass, String sourceMethod, Id recordId) {
        Error_Log_Event__e evt = newEvent(Severity.ERROR, ex?.getMessage(), sourceClass, sourceMethod, recordId);
        if (ex != null) {
            evt.Exception_Type__c = truncate(ex.getTypeName(), TEXT_LIMIT);
            evt.Stack_Trace__c = truncate(stackTraceOf(ex), LONG_TEXT_LIMIT);
            evt.Line_Number__c = ex.getLineNumber();
        }
        pending.add(evt);
    }

    // ------------------------------------------------------------------ messages

    public static void error(String message, String sourceClass, String sourceMethod) {
        log(Severity.ERROR, message, sourceClass, sourceMethod, null);
    }

    public static void warn(String message, String sourceClass, String sourceMethod) {
        log(Severity.WARN, message, sourceClass, sourceMethod, null);
    }

    public static void info(String message, String sourceClass, String sourceMethod) {
        log(Severity.INFO, message, sourceClass, sourceMethod, null);
    }

    public static void debug(String message, String sourceClass, String sourceMethod) {
        log(Severity.DEBUG, message, sourceClass, sourceMethod, null);
    }

    public static void log(Severity level, String message, String sourceClass, String sourceMethod, Id recordId) {
        pending.add(newEvent(level, message, sourceClass, sourceMethod, recordId));
    }

    // ------------------------------------------------------------------ persistence

    /** Publishes all buffered entries. Safe to call when nothing is buffered. */
    public static void save() {
        if (pending.isEmpty()) {
            return;
        }
        List<Error_Log_Event__e> toPublish = pending.clone();
        pending.clear();

        if (Limits.getDmlStatements() >= Limits.getLimitDmlStatements()) {
            System.debug(LoggingLevel.ERROR, 'AppLogger: DML limit reached, dropping ' + toPublish.size() + ' entries.');
            return;
        }
        List<Database.SaveResult> results = EventBus.publish(toPublish);
        List<Error_Log_Event__e> failed = new List<Error_Log_Event__e>();
        for (Integer i = 0; i < results.size(); i++) {
            if (!results[i].isSuccess()) {
                failed.add(toPublish[i]);
                for (Database.Error err : results[i].getErrors()) {
                    System.debug(LoggingLevel.ERROR, 'AppLogger: publish failed: ' + err.getMessage());
                }
            }
        }
        if (!failed.isEmpty()) {
            writeDirectly(failed);
        }
    }

    /**
     * Fallback when the running user cannot publish Error_Log_Event__e (missing Application_Logger
     * permission set). Writes Error_Log__c in this transaction instead, so the entry is kept unless
     * the whole transaction rolls back.
     */
    private static void writeDirectly(List<Error_Log_Event__e> events) {
        if (Limits.getDmlStatements() >= Limits.getLimitDmlStatements()) {
            System.debug(LoggingLevel.ERROR, 'AppLogger: DML limit reached, fallback dropped ' + events.size() + ' entries.');
            return;
        }
        try {
            ErrorLogEventSubscriber.insertLogs(ErrorLogEventSubscriber.toLogs(events));
        } catch (Exception ex) {
            System.debug(LoggingLevel.ERROR, 'AppLogger: fallback insert failed: ' + ex.getMessage());
        }
    }

    public static Integer pendingCount() {
        return pending.size();
    }

    // ------------------------------------------------------------------ helpers

    private static Error_Log_Event__e newEvent(
        Severity level,
        String message,
        String sourceClass,
        String sourceMethod,
        Id recordId
    ) {
        Request req = Request.getCurrent();
        return new Error_Log_Event__e(
            Severity__c = level.name(),
            Message__c = truncate(message, LONG_TEXT_LIMIT),
            Source_Class__c = truncate(sourceClass, TEXT_LIMIT),
            Source_Method__c = truncate(sourceMethod, TEXT_LIMIT),
            Record_Id__c = recordId,
            User_Id__c = UserInfo.getUserId(),
            Request_Id__c = truncate(req.getRequestId(), TEXT_LIMIT),
            Quiddity__c = String.valueOf(req.getQuiddity()),
            Logged_At__c = System.now()
        );
    }

    /** Includes the stack of chained causes, which getStackTraceString() alone omits. */
    private static String stackTraceOf(Exception ex) {
        String trace = ex.getStackTraceString();
        Exception cause = ex.getCause();
        while (cause != null) {
            trace += '\nCaused by: ' + cause.getTypeName() + ': ' + cause.getMessage() + '\n' + cause.getStackTraceString();
            cause = cause.getCause();
        }
        return trace;
    }

    @TestVisible
    private static String truncate(String value, Integer maxLength) {
        return value == null ? null : value.abbreviate(maxLength);
    }
}
