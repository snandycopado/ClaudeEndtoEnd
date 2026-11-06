/**
 * Onboarding_Task__c trigger logic.
 *  - before: stamps Completed_Date__c / Completed_By__c when a task becomes Completed (clears them otherwise)
 *  - after:  re-evaluates whether the parent Account can become Active
 */
public with sharing class OnboardingTaskTriggerHandler extends TriggerHandler {
    protected override void beforeInsert() {
        stampCompletion((List<Onboarding_Task__c>) newList, null);
    }

    protected override void beforeUpdate() {
        stampCompletion((List<Onboarding_Task__c>) newList, oldMap);
    }

    protected override void afterInsert() {
        OnboardingService.evaluateCompletion(accountIds((List<Onboarding_Task__c>) newList, null));
    }

    protected override void afterUpdate() {
        OnboardingService.evaluateCompletion(accountIds((List<Onboarding_Task__c>) newList, oldMap));
    }

    protected override void afterDelete() {
        // Deleting the last open task can complete onboarding.
        OnboardingService.evaluateCompletion(accountIds((List<Onboarding_Task__c>) oldList, null));
    }

    protected override void afterUndelete() {
        OnboardingService.evaluateCompletion(accountIds((List<Onboarding_Task__c>) newList, null));
    }

    private static void stampCompletion(List<Onboarding_Task__c> tasks, Map<Id, SObject> oldMap) {
        for (Onboarding_Task__c task : tasks) {
            Onboarding_Task__c old = oldMap == null ? null : (Onboarding_Task__c) oldMap.get(task.Id);
            Boolean isCompleted = task.Status__c == OnboardingService.TASK_COMPLETED;
            Boolean wasCompleted = old != null && old.Status__c == OnboardingService.TASK_COMPLETED;

            if (isCompleted && !wasCompleted) {
                task.Completed_Date__c = System.now();
                task.Completed_By__c = UserInfo.getUserId();
            } else if (!isCompleted) {
                task.Completed_Date__c = null;
                task.Completed_By__c = null;
            }
        }
    }

    /** Parent accounts of the given tasks; on update only where Status__c changed. */
    private static Set<Id> accountIds(List<Onboarding_Task__c> tasks, Map<Id, SObject> oldMap) {
        Set<Id> ids = new Set<Id>();
        for (Onboarding_Task__c task : tasks) {
            Onboarding_Task__c old = oldMap == null ? null : (Onboarding_Task__c) oldMap.get(task.Id);
            if (old == null || old.Status__c != task.Status__c) {
                ids.add(task.Account__c);
            }
        }
        return ids;
    }
}
