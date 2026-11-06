/** Account trigger logic. Starts onboarding when Account_Status__c becomes "Start Onboarding". */
public with sharing class AccountTriggerHandler extends TriggerHandler {
    protected override void afterInsert() {
        OnboardingService.startOnboarding(enteringOnboarding((List<Account>) newList, null));
    }

    protected override void afterUpdate() {
        OnboardingService.startOnboarding(enteringOnboarding((List<Account>) newList, oldMap));
    }

    @TestVisible
    private static Set<Id> enteringOnboarding(List<Account> accounts, Map<Id, SObject> oldMap) {
        Set<Id> ids = new Set<Id>();
        for (Account acc : accounts) {
            Account old = oldMap == null ? null : (Account) oldMap.get(acc.Id);
            Boolean isStart = acc.Account_Status__c == OnboardingService.ACCOUNT_START_ONBOARDING;
            Boolean wasStart = old != null && old.Account_Status__c == OnboardingService.ACCOUNT_START_ONBOARDING;
            if (isStart && !wasStart) {
                ids.add(acc.Id);
            }
        }
        return ids;
    }
}
