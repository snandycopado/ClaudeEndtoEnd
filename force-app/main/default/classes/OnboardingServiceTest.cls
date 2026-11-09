@IsTest
private class OnboardingServiceTest {
    private static List<Onboarding_Task__c> tasksOf(Id accountId) {
        return [
            SELECT Name, Description__c, Order__c, Status__c, Template_Key__c, Completed_Date__c, Completed_By__c
            FROM Onboarding_Task__c
            WHERE Account__c = :accountId
            WITH SYSTEM_MODE
            ORDER BY Order__c
        ];
    }

    private static Account reload(Id accountId) {
        return [
            SELECT Account_Status__c, Onboarding_Completed_Date__c, Onboarding_Tasks_Total__c, Onboarding_Tasks_Completed__c, Onboarding_Progress__c
            FROM Account
            WHERE Id = :accountId
            WITH SYSTEM_MODE
        ];
    }

    private static void completeAll(Id accountId) {
        List<Onboarding_Task__c> updates = new List<Onboarding_Task__c>();
        for (Onboarding_Task__c t : tasksOf(accountId)) {
            updates.add(setStatus(t.Id, OnboardingService.TASK_COMPLETED));
        }
        update updates;
    }

    /** Update only Id + Status, as the UI does: DML here respects the running user's field access. */
    private static Onboarding_Task__c setStatus(Id taskId, String status) {
        return new Onboarding_Task__c(Id = taskId, Status__c = status);
    }

    @IsTest
    static void startOnboardingCreatesTasksForMatchingRecordType() {
        OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
        User u = OnboardingTestFactory.createOnboardingUser();
        System.runAs(u) {
            Account acc = OnboardingTestFactory.newAccount('Acme', OnboardingTestFactory.AUSTRALIA, 'New');
            insert acc;
            Assert.areEqual(0, tasksOf(acc.Id).size(), 'No tasks before onboarding starts');

            Test.startTest();
            acc.Account_Status__c = OnboardingService.ACCOUNT_START_ONBOARDING;
            update acc;
            Test.stopTest();

            List<Onboarding_Task__c> tasks = tasksOf(acc.Id);
            Assert.areEqual(2, tasks.size(), 'Generic + Customer task; Partner and inactive excluded');
            Assert.areEqual('All_Accounts_Task', tasks[0].Template_Key__c, 'Ordered by Order__c');
            Assert.areEqual('Customer_Task', tasks[1].Template_Key__c, 'Customer task second');
            Assert.areEqual('All Accounts Task', tasks[0].Name, 'Name from template label');
            Assert.areEqual('Do All_Accounts_Task', tasks[0].Description__c, 'Description copied');
            Assert.areEqual(10, tasks[0].Order__c, 'Order copied');
            Assert.areEqual(OnboardingService.TASK_NOT_STARTED, tasks[0].Status__c, 'Initial status from template');
            Assert.areEqual(OnboardingService.ACCOUNT_START_ONBOARDING, reload(acc.Id).Account_Status__c, 'Still onboarding');
        }
    }

    @IsTest
    static void partnerGetsPartnerTasks() {
        OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            Account acc = OnboardingTestFactory.newAccount('Partner Co', OnboardingTestFactory.PARTNER, OnboardingService.ACCOUNT_START_ONBOARDING);
            insert acc; // insert directly in Start Onboarding

            Set<String> keys = new Set<String>();
            for (Onboarding_Task__c t : tasksOf(acc.Id)) {
                keys.add(t.Template_Key__c);
            }
            Assert.areEqual(new Set<String>{ 'All_Accounts_Task', 'Partner_Task' }, keys, 'Partner tasks only');
        }
    }

    @IsTest
    static void restartDoesNotDuplicateTasks() {
        OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            Account acc = OnboardingTestFactory.newAccount('Acme', OnboardingTestFactory.AUSTRALIA, OnboardingService.ACCOUNT_START_ONBOARDING);
            insert acc;
            acc.Account_Status__c = 'New';
            update acc;
            acc.Account_Status__c = OnboardingService.ACCOUNT_START_ONBOARDING;
            update acc;
            Assert.areEqual(2, tasksOf(acc.Id).size(), 'Restart must not duplicate tasks');
        }
    }

    @IsTest
    static void completingAllTasksActivatesAccount() {
        OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
        User u = OnboardingTestFactory.createOnboardingUser();
        System.runAs(u) {
            Account acc = OnboardingTestFactory.newAccount('Acme', OnboardingTestFactory.AUSTRALIA, OnboardingService.ACCOUNT_START_ONBOARDING);
            insert acc;

            List<Onboarding_Task__c> tasks = tasksOf(acc.Id);
            update setStatus(tasks[0].Id, OnboardingService.TASK_COMPLETED);

            Account partial = reload(acc.Id);
            Assert.areEqual(OnboardingService.ACCOUNT_START_ONBOARDING, partial.Account_Status__c, 'Not active while a task is open');
            Assert.areEqual(50, partial.Onboarding_Progress__c, 'Progress roll-up');
            Assert.areEqual(u.Id, tasksOf(acc.Id)[0].Completed_By__c, 'Completed By stamped');
            Assert.isNotNull(tasksOf(acc.Id)[0].Completed_Date__c, 'Completed Date stamped');

            completeAll(acc.Id);
            Account done = reload(acc.Id);
            Assert.areEqual(OnboardingService.ACCOUNT_ACTIVE, done.Account_Status__c, 'All tasks complete => Active');
            Assert.isNotNull(done.Onboarding_Completed_Date__c, 'Completion date set');
            Assert.areEqual(100, done.Onboarding_Progress__c, 'Progress 100%');
        }
    }

    @IsTest
    static void reopeningTaskClearsCompletionStamp() {
        OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            Account acc = OnboardingTestFactory.newAccount('Acme', OnboardingTestFactory.AUSTRALIA, OnboardingService.ACCOUNT_START_ONBOARDING);
            insert acc;
            Onboarding_Task__c task = tasksOf(acc.Id)[0];
            update setStatus(task.Id, OnboardingService.TASK_COMPLETED);
            update setStatus(task.Id, 'In Progress');

            Onboarding_Task__c reopened = tasksOf(acc.Id)[0];
            Assert.isNull(reopened.Completed_Date__c, 'Completed Date cleared');
            Assert.isNull(reopened.Completed_By__c, 'Completed By cleared');
        }
    }

    @IsTest
    static void deletingLastOpenTaskActivatesAccount() {
        OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            Account acc = OnboardingTestFactory.newAccount('Acme', OnboardingTestFactory.AUSTRALIA, OnboardingService.ACCOUNT_START_ONBOARDING);
            insert acc;
            List<Onboarding_Task__c> tasks = tasksOf(acc.Id);
            update setStatus(tasks[0].Id, OnboardingService.TASK_COMPLETED);
            delete tasks[1];
            Assert.areEqual(OnboardingService.ACCOUNT_ACTIVE, reload(acc.Id).Account_Status__c, 'Remaining tasks all complete');

            undelete tasks[1];
            Assert.areEqual(2, tasksOf(acc.Id).size(), 'Undelete restores the task');
        }
    }

    @IsTest
    static void restartWithAllTasksCompleteActivatesImmediately() {
        OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            Account acc = OnboardingTestFactory.newAccount('Acme', OnboardingTestFactory.AUSTRALIA, OnboardingService.ACCOUNT_START_ONBOARDING);
            insert acc;
            completeAll(acc.Id);
            Assert.areEqual(OnboardingService.ACCOUNT_ACTIVE, reload(acc.Id).Account_Status__c, 'Active after completion');

            acc.Account_Status__c = OnboardingService.ACCOUNT_START_ONBOARDING;
            update acc;
            Assert.areEqual(OnboardingService.ACCOUNT_ACTIVE, reload(acc.Id).Account_Status__c, 'Nothing left to do => Active again');
        }
    }

    @IsTest
    static void noMatchingTemplatesLogsWarning() {
        OnboardingService.templateOverride = new List<Onboarding_Task_Template__mdt>{
            OnboardingTestFactory.template('Partner_Only', 10, OnboardingTestFactory.PARTNER, true, null)
        };
        Account acc;
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            Test.startTest();
            acc = OnboardingTestFactory.newAccount('Acme', OnboardingTestFactory.AUSTRALIA, OnboardingService.ACCOUNT_START_ONBOARDING);
            insert acc;
            Test.stopTest();
        }
        Assert.areEqual(0, tasksOf(acc.Id).size(), 'No tasks created');
        Assert.areEqual(OnboardingService.ACCOUNT_START_ONBOARDING, reload(acc.Id).Account_Status__c, 'Never auto-activate with zero tasks');
        List<Error_Log__c> logs = [SELECT Severity__c, Record_Id__c FROM Error_Log__c WITH SYSTEM_MODE];
        Assert.areEqual(1, logs.size(), 'Warning logged');
        Assert.areEqual('WARN', logs[0].Severity__c, 'Severity');
        Assert.areEqual(String.valueOf(acc.Id), logs[0].Record_Id__c, 'Account id on the log');
    }

    @IsTest
    static void emailJobLogsMissingTemplate() {
        OnboardingService.templateOverride = new List<Onboarding_Task_Template__mdt>{
            OnboardingTestFactory.template('With_Email', 10, null, true, 'Onboarding_Task_Assigned'),
            OnboardingTestFactory.template('With_Missing_Email', 20, null, true, 'Does_Not_Exist')
        };
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            Test.startTest();
            insert OnboardingTestFactory.newAccount('Acme', OnboardingTestFactory.AUSTRALIA, OnboardingService.ACCOUNT_START_ONBOARDING);
            Test.stopTest(); // runs the queueable, then delivers log events
        }
        // Long text fields cannot be filtered in SOQL; filter in Apex.
        List<Error_Log__c> logs = new List<Error_Log__c>();
        for (Error_Log__c log : [SELECT Severity__c, Message__c FROM Error_Log__c WITH SYSTEM_MODE]) {
            if (log.Message__c != null && log.Message__c.contains('Does_Not_Exist')) {
                logs.add(log);
            }
        }
        Assert.areEqual(1, logs.size(), 'Missing template is logged, not thrown');
        Assert.areEqual('WARN', logs[0].Severity__c, 'Severity');
    }

    @IsTest
    static void usesOrgTemplatesByDefault() {
        // No override: the deployed Onboarding_Task_Template__mdt records drive task creation.
        Integer expected = 0;
        for (Onboarding_Task_Template__mdt t : Onboarding_Task_Template__mdt.getAll().values()) {
            if (t.Is_Active__c && OnboardingService.appliesTo(t, OnboardingTestFactory.AUSTRALIA)) {
                expected++;
            }
        }
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            Account acc = OnboardingTestFactory.newAccount('Acme', OnboardingTestFactory.AUSTRALIA, OnboardingService.ACCOUNT_START_ONBOARDING);
            insert acc;
            Assert.areEqual(expected, tasksOf(acc.Id).size(), 'One task per matching org template');
        }
    }

    private static Id fakeAccountId(Integer n) {
        String suffix = String.valueOf(n);
        return Id.valueOf('001' + '0'.repeat(12 - suffix.length()) + suffix);
    }

    @IsTest
    static void enteringOnboardingOnlyOnTransition() {
        Account fresh = new Account(Id = fakeAccountId(1), Account_Status__c = OnboardingService.ACCOUNT_START_ONBOARDING);
        Account already = new Account(Id = fakeAccountId(2), Account_Status__c = OnboardingService.ACCOUNT_START_ONBOARDING);
        Map<Id, SObject> oldMap = new Map<Id, SObject>{
            fresh.Id => new Account(Id = fresh.Id, Account_Status__c = 'New'),
            already.Id => new Account(Id = already.Id, Account_Status__c = OnboardingService.ACCOUNT_START_ONBOARDING)
        };
        Assert.areEqual(
            new Set<Id>{ fresh.Id },
            AccountTriggerHandler.enteringOnboarding(new List<Account>{ fresh, already }, oldMap),
            'Only accounts changing into Start Onboarding'
        );
    }
}
