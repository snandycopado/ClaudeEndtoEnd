/** Shared test data for the Onboarding module. */
@IsTest
public class OnboardingTestFactory {
    public static final String CUSTOMER = 'Customer';
    public static final String PARTNER = 'Partner';

    /** Standard User with Onboarding_Manager + Application_Logger — the realistic persona. */
    public static User createOnboardingUser() {
        return createStandardUser(new List<String>{ 'Onboarding_Manager', 'Application_Logger' });
    }

    /** Standard User without Application_Logger: cannot publish Error_Log_Event__e. */
    public static User createUserWithoutLogging() {
        return createStandardUser(new List<String>());
    }

    private static User createStandardUser(List<String> permissionSetNames) {
        Profile standard = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        String unique = String.valueOf(Crypto.getRandomInteger()).replace('-', '') + System.now().getTime();
        User u = new User(
            ProfileId = standard.Id,
            LastName = 'Onboarding Tester',
            Email = 'onboarding.tester@example.com',
            Username = 'onboarding.tester.' + unique + '@example.com',
            Alias = 'onbtst',
            TimeZoneSidKey = 'GMT',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US'
        );
        System.runAs(new User(Id = UserInfo.getUserId())) {
            insert u;
            List<PermissionSetAssignment> assignments = new List<PermissionSetAssignment>();
            for (PermissionSet ps : [SELECT Id FROM PermissionSet WHERE Name IN :permissionSetNames]) {
                assignments.add(new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = ps.Id));
            }
            insert assignments;
        }
        return u;
    }

    public static Id recordTypeId(String developerName) {
        return Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get(developerName).getRecordTypeId();
    }

    public static Account newAccount(String name, String recordTypeName, String status) {
        Account acc = new Account(Name = name, Account_Status__c = status);
        if (recordTypeName != null) {
            acc.RecordTypeId = recordTypeId(recordTypeName);
        }
        return acc;
    }

    /** Custom metadata cannot be inserted in tests; build in-memory records instead. */
    public static Onboarding_Task_Template__mdt template(
        String developerName,
        Integer order,
        String recordType,
        Boolean active,
        String emailTemplate
    ) {
        Map<String, Object> fields = new Map<String, Object>{
            'DeveloperName' => developerName,
            'MasterLabel' => developerName.replace('_', ' '),
            'Order__c' => order,
            'Account_Record_Type__c' => recordType,
            'Is_Active__c' => active,
            'Status__c' => 'Not Started',
            'Task_Description__c' => 'Do ' + developerName,
            'Email_Template_Name__c' => emailTemplate
        };
        return (Onboarding_Task_Template__mdt) JSON.deserialize(JSON.serialize(fields), Onboarding_Task_Template__mdt.class);
    }

    /** ALL (10), CUSTOMER (20), PARTNER (30) and an inactive one (40). */
    public static List<Onboarding_Task_Template__mdt> standardTemplates() {
        return new List<Onboarding_Task_Template__mdt>{
            template('All_Accounts_Task', 10, null, true, null),
            template('Customer_Task', 20, CUSTOMER, true, null),
            template('Partner_Task', 30, PARTNER, true, null),
            template('Inactive_Task', 40, null, false, null)
        };
    }
}
