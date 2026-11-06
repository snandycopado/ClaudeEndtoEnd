@IsTest
private class AppLoggerTest {
    @IsTest
    static void exceptionIsPersistedWithDetails() {
        Id recordId = UserInfo.getUserId();
        Test.startTest();
        try {
            throw new ValidationException('Start date must be in the future');
        } catch (Exception ex) {
            AppLogger.error(ex, 'OnboardingService', 'validate', recordId);
        }
        Assert.areEqual(1, AppLogger.pendingCount(), 'Entry should be buffered until save()');
        AppLogger.save();
        Assert.areEqual(0, AppLogger.pendingCount(), 'Buffer should be empty after save()');
        Test.stopTest();

        Error_Log__c log = [
            SELECT
                Severity__c,
                Message__c,
                Source_Class__c,
                Source_Method__c,
                Exception_Type__c,
                Stack_Trace__c,
                Line_Number__c,
                Record_Id__c,
                User__c,
                Request_Id__c,
                Quiddity__c,
                Logged_At__c
            FROM Error_Log__c
            WITH SYSTEM_MODE
        ];
        Assert.areEqual('ERROR', log.Severity__c, 'Severity');
        Assert.areEqual('Start date must be in the future', log.Message__c, 'Message');
        Assert.areEqual('OnboardingService', log.Source_Class__c, 'Source class');
        Assert.areEqual('validate', log.Source_Method__c, 'Source method');
        Assert.areEqual('ValidationException', log.Exception_Type__c, 'Exception type');
        Assert.isNotNull(log.Stack_Trace__c, 'Stack trace');
        Assert.isNotNull(log.Line_Number__c, 'Line number');
        Assert.areEqual(String.valueOf(recordId), log.Record_Id__c, 'Record id');
        Assert.areEqual(UserInfo.getUserId(), log.User__c, 'Originating user, not Automated Process');
        Assert.isNotNull(log.Request_Id__c, 'Request id');
        Assert.isNotNull(log.Quiddity__c, 'Quiddity');
        Assert.isNotNull(log.Logged_At__c, 'Logged at');
    }

    @IsTest
    static void causeChainIsIncludedInStackTrace() {
        Test.startTest();
        try {
            try {
                Integer zero = 0;
                Integer x = 1 / zero;
            } catch (MathException rootCause) {
                throw new IntegrationException('Provider failed', rootCause);
            }
        } catch (Exception ex) {
            AppLogger.error(ex, 'SsoService', 'call');
            AppLogger.save();
        }
        Test.stopTest();

        Error_Log__c log = [SELECT Stack_Trace__c, Exception_Type__c FROM Error_Log__c WITH SYSTEM_MODE];
        Assert.areEqual('IntegrationException', log.Exception_Type__c, 'Outer type');
        Assert.isTrue(log.Stack_Trace__c.contains('Caused by: System.MathException'), log.Stack_Trace__c);
    }

    @IsTest
    static void messageLevelsAreStored() {
        Test.startTest();
        AppLogger.error('e', 'C', 'm');
        AppLogger.warn('w', 'C', 'm');
        AppLogger.info('i', 'C', 'm');
        AppLogger.debug('d', 'C', 'm');
        AppLogger.save();
        Test.stopTest();

        Map<String, String> messageBySeverity = new Map<String, String>();
        for (Error_Log__c log : [SELECT Severity__c, Message__c, Exception_Type__c FROM Error_Log__c WITH SYSTEM_MODE]) {
            messageBySeverity.put(log.Severity__c, log.Message__c);
            Assert.isNull(log.Exception_Type__c, 'Message entries have no exception type');
        }
        Assert.areEqual(
            new Map<String, String>{ 'ERROR' => 'e', 'WARN' => 'w', 'INFO' => 'i', 'DEBUG' => 'd' },
            messageBySeverity,
            'One record per level'
        );
    }

    @IsTest
    static void saveWithNothingBufferedDoesNothing() {
        Integer dmlBefore = Limits.getDmlStatements();
        AppLogger.save();
        Assert.areEqual(dmlBefore, Limits.getDmlStatements(), 'Empty save must not use DML');
    }

    @IsTest
    static void nullExceptionIsTolerated() {
        Test.startTest();
        AppLogger.error((Exception) null, 'C', 'm');
        AppLogger.save();
        Test.stopTest();
        Assert.areEqual(1, [SELECT COUNT() FROM Error_Log__c WITH SYSTEM_MODE], 'Entry still written');
    }

    @IsTest
    static void longValuesAreTruncated() {
        String longText = 'x'.repeat(AppLogger.LONG_TEXT_LIMIT + 100);
        String longName = 'y'.repeat(AppLogger.TEXT_LIMIT + 10);

        Test.startTest();
        AppLogger.info(longText, longName, longName);
        AppLogger.save();
        Test.stopTest();

        Error_Log__c log = [SELECT Message__c, Source_Class__c FROM Error_Log__c WITH SYSTEM_MODE];
        Assert.areEqual(AppLogger.LONG_TEXT_LIMIT, log.Message__c.length(), 'Message truncated');
        Assert.areEqual(AppLogger.TEXT_LIMIT, log.Source_Class__c.length(), 'Class truncated');
        Assert.isNull(AppLogger.truncate(null, 10), 'Null stays null');
    }

    @IsTest
    static void logsSurviveRollback() {
        Test.startTest();
        Savepoint sp = Database.setSavepoint();
        insert new Account(Name = 'Rolled back');
        AppLogger.error('before rollback', 'C', 'm');
        AppLogger.save();
        Database.rollback(sp);
        Test.stopTest();

        Assert.areEqual(0, [SELECT COUNT() FROM Account WHERE Name = 'Rolled back'], 'Account rolled back');
        Assert.areEqual(1, [SELECT COUNT() FROM Error_Log__c WITH SYSTEM_MODE], 'Publish Immediately log survives rollback');
    }

    @IsTest
    static void userWithoutPublishPermissionFallsBackToDirectInsert() {
        User u = OnboardingTestFactory.createUserWithoutLogging();
        System.runAs(u) {
            AppLogger.error('no publish access', 'C', 'm');
            AppLogger.save();
        }
        // Written synchronously by the fallback; no event delivery needed.
        Error_Log__c log = [SELECT Message__c, User__c FROM Error_Log__c WITH SYSTEM_MODE];
        Assert.areEqual('no publish access', log.Message__c, 'Fallback keeps the entry');
        Assert.areEqual(u.Id, log.User__c, 'Originating user recorded');
    }

    @IsTest
    static void subscriberIgnoresInvalidUserId() {
        Test.startTest();
        ErrorLogEventSubscriber.createLogs(
            new List<Error_Log_Event__e>{
                new Error_Log_Event__e(Severity__c = 'INFO', Message__c = 'a', User_Id__c = 'not-an-id'),
                new Error_Log_Event__e(Severity__c = 'INFO', Message__c = 'b', User_Id__c = '005-bad-format'),
                new Error_Log_Event__e(Severity__c = 'INFO', Message__c = 'c')
            }
        );
        Test.stopTest();

        for (Error_Log__c log : [SELECT User__c FROM Error_Log__c WITH SYSTEM_MODE]) {
            Assert.isNull(log.User__c, 'Invalid or missing user id must not block the insert');
        }
        Assert.areEqual(3, [SELECT COUNT() FROM Error_Log__c WITH SYSTEM_MODE], 'All three rows written');
    }
}
