@IsTest
private class SubjectTest {
    private static final Integer BULK = 200;

    private static User persona() {
        // Module permission set + Application_Logger, on a Standard User — never the admin running the deploy.
        return OnboardingTestFactory.createStandardUser(new List<String>{ 'Module_Permset', 'Application_Logger' });
    }

    @IsTest
    static void happyPath() {
        System.runAs(persona()) {
            Account acc = OnboardingTestFactory.newAccount('Acme', OnboardingTestFactory.CUSTOMER, null);
            insert acc;

            Test.startTest();
            // act: call the service / controller, or DML that fires the trigger
            Test.stopTest();

            Account result = [SELECT Id, Name FROM Account WHERE Id = :acc.Id WITH SYSTEM_MODE];
            Assert.areEqual('Acme', result.Name, 'describe the expected behaviour');
        }
    }

    @IsTest
    static void bulkThroughTrigger() {
        System.runAs(persona()) {
            List<Account> accounts = new List<Account>();
            for (Integer i = 0; i < BULK; i++) {
                accounts.add(OnboardingTestFactory.newAccount('Bulk ' + i, OnboardingTestFactory.CUSTOMER, null));
            }
            Test.startTest();
            insert accounts; // must stay within limits for 200 records
            Test.stopTest();
            Assert.areEqual(BULK, [SELECT COUNT() FROM Account WITH SYSTEM_MODE], 'all records processed');
        }
    }

    @IsTest
    static void invalidInputIsRejected() {
        System.runAs(persona()) {
            try {
                // act with invalid input
                Assert.fail('Expected a ValidationException');
            } catch (ValidationException ex) {
                Assert.isTrue(ex.getMessage().contains('expected text'), ex.getMessage());
            }
        }
    }

    @IsTest
    static void userWithoutPermissionSetCannot() {
        System.runAs(OnboardingTestFactory.createStandardUser(new List<String>())) {
            try {
                // act as a user without the module permission set
                Assert.fail('Expected an access error');
            } catch (Exception ex) {
                Assert.isNotNull(ex.getMessage(), 'access is enforced');
            }
        }
    }
}
