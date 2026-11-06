@IsTest
private class __Name__TriggerHandlerTest {
    @IsTest
    static void handlerRunsOnInsert() {
        System.runAs(OnboardingTestFactory.createStandardUser(new List<String>{ 'Module_Permset', 'Application_Logger' })) {
            List<__Object__> records = new List<__Object__>();
            for (Integer i = 0; i < 200; i++) {
                records.add(new __Object__(/* required fields */));
            }
            Test.startTest();
            insert records;
            Test.stopTest();
            Assert.areEqual(200, [SELECT COUNT() FROM __Object__ WITH SYSTEM_MODE], 'bulk insert handled');
        }
    }

    @IsTest
    static void handlerCanBeBypassed() {
        TriggerHandler.bypass('__Name__TriggerHandler');
        Assert.isTrue(TriggerHandler.isBypassed('__Name__TriggerHandler'), 'bypass registered');
        TriggerHandler.clearBypass('__Name__TriggerHandler');
    }
}
