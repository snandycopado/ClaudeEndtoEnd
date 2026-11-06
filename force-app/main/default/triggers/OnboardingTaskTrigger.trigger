trigger OnboardingTaskTrigger on Onboarding_Task__c(
    before insert,
    before update,
    before delete,
    after insert,
    after update,
    after delete,
    after undelete
) {
    new OnboardingTaskTriggerHandler().run();
}
