trigger ErrorLogEventTrigger on Error_Log_Event__e(after insert) {
    ErrorLogEventSubscriber.createLogs(Trigger.new);
}
