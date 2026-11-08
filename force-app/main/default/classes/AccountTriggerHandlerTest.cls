/**
 * KAN-2: country record types (Australia, New Zealand, United States, Canada) replace Customer on Account.
 * Covers record type setup, visibility through Onboarding_Manager, onboarding through AccountTrigger and LCM regression.
 */
@IsTest
private class AccountTriggerHandlerTest {
    private static Map<String, Schema.RecordTypeInfo> accountRecordTypes() {
        return Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName();
    }

    private static List<Onboarding_Task__c> tasksOf(Set<Id> accountIds) {
        return [
            SELECT Account__c, Template_Key__c
            FROM Onboarding_Task__c
            WHERE Account__c IN :accountIds
            WITH SYSTEM_MODE
        ];
    }

    @IsTest
    static void countryRecordTypesExistAndAreActive() {
        Map<String, Schema.RecordTypeInfo> rts = accountRecordTypes();
        for (String country : OnboardingTestFactory.COUNTRIES) {
            Assert.isTrue(rts.containsKey(country), country + ' record type exists');
            Assert.isTrue(rts.get(country).isActive(), country + ' record type is active');
        }
        Assert.areEqual('United States', rts.get(OnboardingTestFactory.UNITED_STATES).getName(), 'US label');
        Assert.areEqual('New Zealand', rts.get(OnboardingTestFactory.NEW_ZEALAND).getName(), 'NZ label');
    }

    @IsTest
    static void customerRecordTypeIsInactive() {
        Schema.RecordTypeInfo customer = accountRecordTypes().get(OnboardingTestFactory.CUSTOMER);
        Assert.isNotNull(customer, 'Customer is kept (inactive) for existing records, not deleted');
        Assert.isFalse(customer.isActive(), 'Customer is retired');
    }

    /**
     * UI-level retirement: Customer is no longer offered to users. Note: Apex/API DML can still set an inactive
     * record type (verified in esm-dev, KAN-2) — blocking that would need a validation rule (open point in the plan).
     * isAvailable() is false for any inactive record type, so this proves the deactivation; the Onboarding_Manager
     * visible=false entry is verified by the smoke test.
     */
    @IsTest
    static void customerRecordTypeNotAvailable() {
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            Map<String, Schema.RecordTypeInfo> rts = accountRecordTypes();
            Assert.isFalse(rts.get(OnboardingTestFactory.CUSTOMER).isAvailable(), 'Onboarding_Manager users can no longer pick Customer');
            for (String country : OnboardingTestFactory.COUNTRIES) {
                Assert.isTrue(rts.get(country).isAvailable(), country + ' still available');
            }
        }
    }

    @IsTest
    static void partnerAndInternalUnchanged() {
        Map<String, Schema.RecordTypeInfo> rts = accountRecordTypes();
        Assert.isTrue(rts.get(OnboardingTestFactory.PARTNER).isActive(), 'Partner stays active');
        Assert.isTrue(rts.get(LcmNotificationService.INTERNAL_RECORD_TYPE).isActive(), 'Internal stays active');
    }

    @IsTest
    static void onboardingManagerCanCreateEachCountryRecordType() {
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            Map<String, Schema.RecordTypeInfo> rts = accountRecordTypes();
            List<Account> accounts = new List<Account>();
            for (String country : OnboardingTestFactory.COUNTRIES) {
                Assert.isTrue(rts.get(country).isAvailable(), country + ' available through Onboarding_Manager');
                // newSObject(rtId, true) loads the record type's picklist defaults, as the New button does.
                Account acc = (Account) Account.SObjectType.newSObject(rts.get(country).getRecordTypeId(), true);
                acc.Name = 'Acme ' + country;
                accounts.add(acc);
            }
            insert as user accounts;

            Map<Id, Account> saved = new Map<Id, Account>(
                [SELECT RecordType.DeveloperName, Account_Status__c FROM Account WHERE Id IN :accounts WITH SYSTEM_MODE]
            );
            for (Integer i = 0; i < accounts.size(); i++) {
                Account acc = saved.get(accounts[i].Id);
                Assert.areEqual(OnboardingTestFactory.COUNTRIES[i], acc.RecordType.DeveloperName, 'Record type saved');
                Assert.areEqual('New', acc.Account_Status__c, 'Status defaults to New');
            }
        }
    }

    @IsTest
    static void startOnboardingOnCountryAccountCreatesCustomerEquivalentTasks() {
        // Real Onboarding_Task_Template__mdt records (no override): each country gets the former Customer tasks.
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            Map<Id, String> countryById = new Map<Id, String>();
            List<Account> accounts = new List<Account>();
            for (String country : OnboardingTestFactory.COUNTRIES) {
                accounts.add(OnboardingTestFactory.newAccount('Acme ' + country, country, 'New'));
            }
            insert as user accounts;
            for (Integer i = 0; i < accounts.size(); i++) {
                countryById.put(accounts[i].Id, OnboardingTestFactory.COUNTRIES[i]);
            }

            List<Account> updates = new List<Account>();
            for (Account acc : accounts) {
                updates.add(new Account(Id = acc.Id, Account_Status__c = OnboardingService.ACCOUNT_START_ONBOARDING));
            }
            Test.startTest();
            update as user updates;
            Test.stopTest();

            Map<Id, Set<String>> keysByAccount = new Map<Id, Set<String>>();
            for (Onboarding_Task__c t : tasksOf(countryById.keySet())) {
                if (!keysByAccount.containsKey(t.Account__c)) {
                    keysByAccount.put(t.Account__c, new Set<String>());
                }
                keysByAccount.get(t.Account__c).add(t.Template_Key__c);
            }
            for (Id accId : countryById.keySet()) {
                String country = countryById.get(accId);
                Set<String> keys = keysByAccount.get(accId);
                Assert.isNotNull(keys, country + ' account got onboarding tasks');
                Assert.isTrue(keys.contains('Customer_Welcome_Call_' + country), country + ': welcome call task');
                Assert.isTrue(keys.contains('Billing_Account_Setup_' + country), country + ': billing setup task');
                Assert.isTrue(keys.contains('KYC_Verification'), country + ': generic KYC task');
                Assert.isTrue(keys.contains('Contract_Signature'), country + ': generic contract task');
                Assert.isFalse(keys.contains('Customer_Welcome_Call'), country + ': not the retired Customer template');
                Assert.isFalse(keys.contains('Partner_Portal_Access'), country + ': no Partner tasks');
            }
        }
    }

    @IsTest
    static void countryAccountNotListedAsVendor() {
        User lcmUser = OnboardingTestFactory.createStandardUser(
            new List<String>{ 'LCM_User', 'Onboarding_Manager', 'Application_Logger' }
        );
        System.runAs(lcmUser) {
            Account current = OnboardingTestFactory.newAccount('Vendor Current', LcmNotificationService.INTERNAL_RECORD_TYPE, null);
            Account vendor = OnboardingTestFactory.newAccount('Vendor Other', LcmNotificationService.INTERNAL_RECORD_TYPE, null);
            Account country = OnboardingTestFactory.newAccount('Acme AU', OnboardingTestFactory.AUSTRALIA, null);
            insert as user new List<Account>{ current, vendor, country };

            List<Account> result = LcmNotificationController.getInternalAccounts(current.Id);
            Assert.areEqual(1, result.size(), 'Only the other Internal account');
            Assert.areEqual(vendor.Id, result[0].Id, 'Country account is not a vendor');
        }
    }

    @IsTest
    static void bulkInsertAndUpdate200CountryAccounts() {
        OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
        System.runAs(OnboardingTestFactory.createOnboardingUser()) {
            List<Account> accounts = new List<Account>();
            for (Integer i = 0; i < 200; i++) {
                String country = OnboardingTestFactory.COUNTRIES[Math.mod(i, 4)];
                accounts.add(OnboardingTestFactory.newAccount('Bulk ' + i, country, 'New'));
            }
            insert as user accounts;

            List<Account> updates = new List<Account>();
            for (Account acc : accounts) {
                updates.add(new Account(Id = acc.Id, Account_Status__c = OnboardingService.ACCOUNT_START_ONBOARDING));
            }
            Test.startTest();
            update as user updates;
            Test.stopTest();

            // standardTemplates: All_Accounts_Task for every account + Customer_Task for Australia only.
            Assert.areEqual(200 + 50, tasksOf(new Map<Id, Account>(accounts).keySet()).size(), '200 generic + 50 Australia tasks');
            Assert.areEqual(
                200,
                [SELECT COUNT() FROM Account WHERE Id IN :accounts AND Account_Status__c = :OnboardingService.ACCOUNT_START_ONBOARDING WITH SYSTEM_MODE],
                'All 200 accounts in onboarding'
            );
        }
    }
}
