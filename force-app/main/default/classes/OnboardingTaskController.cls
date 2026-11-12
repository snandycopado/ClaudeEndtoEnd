/** Apex controller for the onboardingTaskTracker LWC. Runs in user mode: respects the user's CRUD/FLS/sharing. */
public with sharing class OnboardingTaskController {
  private static final String CLASS_NAME = 'OnboardingTaskController';

  @AuraEnabled(cacheable=true)
  public static List<Onboarding_Task__c> getTasks(Id accountId) {
    return [
      SELECT
        Id,
        Name,
        Description__c,
        Order__c,
        Status__c,
        Completed_Date__c,
        Completed_By__r.Name
      FROM Onboarding_Task__c
      WHERE Account__c = :accountId
      WITH USER_MODE
      ORDER BY Order__c ASC NULLS LAST, Name ASC
    ];
  }

  @AuraEnabled
  public static void completeTask(Id taskId) {
    try {
      update as user new Onboarding_Task__c(
        Id = taskId,
        Status__c = OnboardingService.TASK_COMPLETED
      );
    } catch (Exception ex) {
      throw toAuraException(ex, 'completeTask', taskId);
    }
  }

  /** KAN-6: move a completed task back to In Progress. The trigger clears the completion stamp and
   *  OnboardingService.evaluateCompletion moves an onboarding-activated Account back to Start Onboarding. */
  @AuraEnabled
  public static void reopenTask(Id taskId) {
    try {
      update as user new Onboarding_Task__c(
        Id = taskId,
        Status__c = OnboardingService.TASK_IN_PROGRESS
      );
    } catch (Exception ex) {
      throw toAuraException(ex, 'reopenTask', taskId);
    }
  }

  private static AuraHandledException toAuraException(
    Exception ex,
    String method,
    Id taskId
  ) {
    AppLogger.error(ex, CLASS_NAME, method, taskId);
    AppLogger.save();
    String message = ex instanceof DmlException
      ? ((DmlException) ex).getDmlMessage(0)
      : ex.getMessage();
    AuraHandledException auraEx = new AuraHandledException(message);
    auraEx.setMessage(message);
    return auraEx;
  }
}
