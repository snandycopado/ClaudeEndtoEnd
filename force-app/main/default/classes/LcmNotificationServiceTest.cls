@IsTest
private class LcmNotificationServiceTest {
    private static User lcmUser() {
        return OnboardingTestFactory.createStandardUser(
            new List<String>{ 'LCM_User', 'Onboarding_Manager', 'Application_Logger' }
        );
    }

    private static Account vendor(String name, String email) {
        Account acc = OnboardingTestFactory.newAccount(name, LcmNotificationService.INTERNAL_RECORD_TYPE, null);
        acc.Email__c = email;
        return acc;
    }

    private static List<LCM_Notification__c> auditFor(Id accountId) {
        return [
            SELECT Vendor_Account__r.Name, Email__c, Status__c, Notification_Type__c, Comments__c, Error_Message__c
            FROM LCM_Notification__c
            WHERE Account__c = :accountId
            WITH SYSTEM_MODE
            ORDER BY Vendor_Account__r.Name
        ];
    }

    @IsTest
    static void listsOnlyInternalAccountsExceptCurrent() {
        System.runAs(lcmUser()) {
            Account current = vendor('Vendor Current', 'current@example.com');
            Account other = vendor('Vendor Other', 'other@example.com');
            Account customer = OnboardingTestFactory.newAccount('Customer Co', OnboardingTestFactory.CUSTOMER, null);
            insert new List<Account>{ current, other, customer };

            List<Account> result = LcmNotificationController.getInternalAccounts(current.Id);
            Assert.areEqual(1, result.size(), 'Only other Internal accounts');
            Assert.areEqual(other.Id, result[0].Id, 'Excludes current account and non-Internal accounts');
            Assert.areEqual('other@example.com', result[0].Email__c, 'Email returned for display');
        }
    }

    @IsTest
    static void sendsToVendorsWithEmailAndAuditsEveryOutcome() {
        System.runAs(lcmUser()) {
            Account subject = OnboardingTestFactory.newAccount('Acme Corp', OnboardingTestFactory.CUSTOMER, null);
            Account a = vendor('Vendor A', 'a@example.com');
            Account b = vendor('Vendor B', 'b@example.com');
            Account noEmail = vendor('Vendor C', null);
            insert new List<Account>{ subject, a, b, noEmail };

            Test.startTest();
            LcmNotificationService.SendResult result = LcmNotificationController.sendNotification(
                subject.Id,
                new List<Id>{ a.Id, b.Id, noEmail.Id },
                LcmNotificationService.TYPE_NEW_ACCOUNT,
                'Please set up this account'
            );
            Integer emailInvocations = Limits.getEmailInvocations();
            Test.stopTest();

            Assert.areEqual(2, result.sent, 'Two vendors with email');
            Assert.areEqual(1, result.skipped, 'Vendor without email skipped');
            Assert.areEqual(0, result.failed, 'No failures');
            Assert.areEqual(1, result.problems.size(), 'Skip explained');
            Assert.areEqual(1, emailInvocations, 'One bulk sendEmail call');

            List<LCM_Notification__c> audit = auditFor(subject.Id);
            Assert.areEqual(3, audit.size(), 'One audit row per vendor');
            Assert.areEqual(LcmNotificationService.STATUS_SENT, audit[0].Status__c, 'Vendor A sent');
            Assert.areEqual('a@example.com', audit[0].Email__c, 'Address captured');
            Assert.areEqual(LcmNotificationService.STATUS_SENT, audit[1].Status__c, 'Vendor B sent');
            Assert.areEqual(LcmNotificationService.STATUS_SKIPPED, audit[2].Status__c, 'Vendor C skipped');
            Assert.areEqual('Vendor has no email address', audit[2].Error_Message__c, 'Reason captured');
            Assert.areEqual(LcmNotificationService.TYPE_NEW_ACCOUNT, audit[0].Notification_Type__c, 'Type captured');
            Assert.areEqual('Please set up this account', audit[0].Comments__c, 'Comments captured');
        }
    }

    @IsTest
    static void nonInternalSelectionIsSkipped() {
        System.runAs(lcmUser()) {
            Account subject = OnboardingTestFactory.newAccount('Acme Corp', OnboardingTestFactory.CUSTOMER, null);
            Account notVendor = OnboardingTestFactory.newAccount('Customer Co', OnboardingTestFactory.CUSTOMER, null);
            Account a = vendor('Vendor A', 'a@example.com');
            insert new List<Account>{ subject, notVendor, a };

            LcmNotificationService.SendResult result = LcmNotificationService.send(
                subject.Id,
                new List<Id>{ a.Id, notVendor.Id, subject.Id },
                LcmNotificationService.TYPE_ACCOUNT_UPDATE,
                null
            );
            Assert.areEqual(1, result.sent, 'Vendor A sent');
            Assert.areEqual(2, result.skipped, 'Customer account and the subject itself are not vendors');
            Assert.areEqual(1, auditFor(subject.Id).size(), 'Only real vendors are audited');
        }
    }

    @IsTest
    static void validationErrorsReachTheUserUnchanged() {
        System.runAs(lcmUser()) {
            Account subject = OnboardingTestFactory.newAccount('Acme Corp', OnboardingTestFactory.CUSTOMER, null);
            Account a = vendor('Vendor A', 'a@example.com');
            insert new List<Account>{ subject, a };

            Map<String, List<Object>> cases = new Map<String, List<Object>>{
                'Select at least one vendor' => new List<Object>{ subject.Id, new List<Id>(), LcmNotificationService.TYPE_NEW_ACCOUNT, null },
                'Notification type must be' => new List<Object>{ subject.Id, new List<Id>{ a.Id }, 'Bogus', null },
                'An account is required' => new List<Object>{ null, new List<Id>{ a.Id }, LcmNotificationService.TYPE_NEW_ACCOUNT, null },
                'Comments can be at most' => new List<Object>{ subject.Id, new List<Id>{ a.Id }, LcmNotificationService.TYPE_NEW_ACCOUNT, 'x'.repeat(1001) }
            };
            for (String expected : cases.keySet()) {
                List<Object> args = cases.get(expected);
                try {
                    LcmNotificationController.sendNotification((Id) args[0], (List<Id>) args[1], (String) args[2], (String) args[3]);
                    Assert.fail('Expected validation error: ' + expected);
                } catch (AuraHandledException ex) {
                    Assert.isTrue(ex.getMessage().startsWith(expected), expected + ' vs ' + ex.getMessage());
                }
            }
            Integer tooMany = LcmNotificationService.MAX_VENDORS + 1;
            List<Id> ids = new List<Id>();
            for (Integer i = 0; i < tooMany; i++) {
                ids.add(a.Id);
            }
            try {
                LcmNotificationService.send(subject.Id, ids, LcmNotificationService.TYPE_NEW_ACCOUNT, null);
                Assert.fail('Too many vendors must fail');
            } catch (ValidationException ex) {
                Assert.isTrue(ex.getMessage().contains('at most'), ex.getMessage());
            }
        }
        Assert.areEqual(0, [SELECT COUNT() FROM Error_Log__c WITH SYSTEM_MODE], 'Validation errors are not logged as errors');
    }

    @IsTest
    static void emailBodyContainsDetailsAndEscapesInput() {
        System.runAs(lcmUser()) {
            Account subject = OnboardingTestFactory.newAccount('Acme <Corp>', OnboardingTestFactory.CUSTOMER, null);
            subject.Industry = 'Banking';
            subject.Phone = '555-0100';
            insert subject;

            Account loaded = LcmNotificationService.loadAccount(subject.Id);
            List<LcmNotificationService.FieldRow> rows = LcmNotificationService.detailRows(loaded);
            String html = LcmNotificationService.buildHtmlBody(loaded, rows, LcmNotificationService.TYPE_ACCOUNT_UPDATE, '<script>alert(1)</script>');
            String text = LcmNotificationService.buildTextBody(loaded, rows, LcmNotificationService.TYPE_NEW_ACCOUNT, 'Line 1');

            Assert.isTrue(html.contains('Acme &lt;Corp&gt;'), 'Account name escaped');
            Assert.isFalse(html.contains('<script>'), 'Comments escaped');
            Assert.isTrue(html.contains('Banking'), 'Field set values included');
            Assert.isTrue(html.contains('An account has been updated'), 'Update wording');
            Assert.isTrue(text.contains('A new account has been created'), 'New account wording');
            Assert.isTrue(text.contains('Account Owner: '), 'Owner row');
            Assert.isFalse(LcmNotificationService.notificationFields().isEmpty(), 'Field set is deployed and readable');
        }
    }
}
