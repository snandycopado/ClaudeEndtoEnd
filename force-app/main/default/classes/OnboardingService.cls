/**
 * Onboarding module business logic.
 *
 *  - startOnboarding: when an Account enters "Start Onboarding", create one Onboarding_Task__c
 *    per active Onboarding_Task_Template__mdt that matches the account's record type
 *    (blank Account_Record_Type__c = all accounts). Tasks that already exist for a template
 *    are not created again, so restarting onboarding is safe.
 *  - evaluateCompletion: when every task on an account in "Start Onboarding" is Completed,
 *    set the account to "Active". When a task on an account that onboarding activated
 *    (Onboarding_Completed_Date__c set) is reopened, set it back to "Start Onboarding" (KAN-6).
 *
 * Runs without sharing: onboarding is system automation and must complete regardless of the
 * acting user's access to the parent Account (e.g. a user who can complete a task but not edit
 * the account). Callers are trigger handlers only.
 */
public without sharing class OnboardingService {
  public static final String ACCOUNT_START_ONBOARDING = 'Start Onboarding';
  public static final String ACCOUNT_ACTIVE = 'Active';
  public static final String TASK_NOT_STARTED = 'Not Started';
  public static final String TASK_IN_PROGRESS = 'In Progress';
  public static final String TASK_COMPLETED = 'Completed';

  private static final String CLASS_NAME = 'OnboardingService';

  /** Test seam: lets unit tests run against a known template set instead of org metadata. */
  @TestVisible
  private static List<Onboarding_Task_Template__mdt> templateOverride;

  // ------------------------------------------------------------------ start

  public static void startOnboarding(Set<Id> accountIds) {
    if (accountIds == null || accountIds.isEmpty()) {
      return;
    }
    List<Onboarding_Task_Template__mdt> templates = activeTemplates();
    List<Onboarding_Task__c> tasksToCreate = new List<Onboarding_Task__c>();

    for (Account acc : [
      SELECT Id, RecordTypeId, (SELECT Template_Key__c FROM Onboarding_Tasks__r)
      FROM Account
      WHERE Id IN :accountIds
      WITH SYSTEM_MODE
    ]) {
      Set<String> existingKeys = new Set<String>();
      for (Onboarding_Task__c existing : acc.Onboarding_Tasks__r) {
        existingKeys.add(existing.Template_Key__c);
      }

      String recordTypeName = recordTypeDeveloperName(acc.RecordTypeId);
      Integer matched = 0;
      for (Onboarding_Task_Template__mdt template : templates) {
        if (!appliesTo(template, recordTypeName)) {
          continue;
        }
        matched++;
        if (!existingKeys.contains(template.DeveloperName)) {
          tasksToCreate.add(newTask(acc.Id, template));
        }
      }

      if (matched == 0) {
        AppLogger.log(
          AppLogger.Severity.WARN,
          'No active onboarding templates match record type ' +
          (recordTypeName ?? '(none)'),
          CLASS_NAME,
          'startOnboarding',
          acc.Id
        );
      }
    }

    if (!tasksToCreate.isEmpty()) {
      Database.insert(tasksToCreate, AccessLevel.SYSTEM_MODE);
      OnboardingEmailQueueable.enqueue(tasksToCreate);
    }
    // Covers restarts where every task already exists and is complete.
    evaluateCompletion(accountIds);
    AppLogger.save();
  }

  // ------------------------------------------------------------------ completion

  public static void evaluateCompletion(Set<Id> accountIds) {
    if (accountIds == null || accountIds.isEmpty()) {
      return;
    }
    List<Account> changes = new List<Account>();
    for (Account acc : [
      SELECT
        Id,
        Account_Status__c,
        Onboarding_Completed_Date__c,
        (SELECT Status__c FROM Onboarding_Tasks__r)
      FROM Account
      WHERE
        Id IN :accountIds
        AND Account_Status__c IN (:ACCOUNT_START_ONBOARDING, :ACCOUNT_ACTIVE)
      WITH SYSTEM_MODE
    ]) {
      Boolean hasTasks = !acc.Onboarding_Tasks__r.isEmpty();
      Boolean done = hasTasks && allCompleted(acc.Onboarding_Tasks__r);
      if (acc.Account_Status__c == ACCOUNT_START_ONBOARDING && done) {
        changes.add(
          new Account(
            Id = acc.Id,
            Account_Status__c = ACCOUNT_ACTIVE,
            Onboarding_Completed_Date__c = System.now()
          )
        );
      } else if (
        acc.Account_Status__c == ACCOUNT_ACTIVE &&
        hasTasks &&
        !done &&
        acc.Onboarding_Completed_Date__c != null
      ) {
        // KAN-6: an open task exists (reopened, added or undeleted) on an account that onboarding had activated
        // -> onboarding is open again. Only accounts activated by onboarding (completed date set) move back;
        // other Active accounts are untouched. No tasks at all (all deleted) -> no change, so startOnboarding
        // never recreates and re-emails the whole task set.
        changes.add(
          new Account(
            Id = acc.Id,
            Account_Status__c = ACCOUNT_START_ONBOARDING,
            Onboarding_Completed_Date__c = null
          )
        );
      }
    }
    if (!changes.isEmpty()) {
      Database.update(changes, AccessLevel.SYSTEM_MODE);
    }
  }

  // ------------------------------------------------------------------ helpers

  private static List<Onboarding_Task_Template__mdt> activeTemplates() {
    List<Onboarding_Task_Template__mdt> source = templateOverride != null
      ? templateOverride
      : Onboarding_Task_Template__mdt.getAll().values();

    List<Onboarding_Task_Template__mdt> active = new List<Onboarding_Task_Template__mdt>();
    for (Onboarding_Task_Template__mdt template : source) {
      if (template.Is_Active__c) {
        active.add(template);
      }
    }
    return active;
  }

  @TestVisible
  private static Boolean appliesTo(
    Onboarding_Task_Template__mdt template,
    String recordTypeName
  ) {
    return String.isBlank(template.Account_Record_Type__c) ||
      template.Account_Record_Type__c.trim().equalsIgnoreCase(recordTypeName);
  }

  private static String recordTypeDeveloperName(Id recordTypeId) {
    if (recordTypeId == null) {
      return null;
    }
    Schema.RecordTypeInfo info = Schema.SObjectType.Account.getRecordTypeInfosById()
      .get(recordTypeId);
    return info?.getDeveloperName();
  }

  private static Onboarding_Task__c newTask(
    Id accountId,
    Onboarding_Task_Template__mdt template
  ) {
    return new Onboarding_Task__c(
      Account__c = accountId,
      Name = template.MasterLabel.abbreviate(80),
      Description__c = template.Task_Description__c,
      Order__c = template.Order__c,
      Status__c = String.isBlank(template.Status__c)
        ? TASK_NOT_STARTED
        : template.Status__c,
      Email_Template_Name__c = template.Email_Template_Name__c,
      Template_Key__c = template.DeveloperName
    );
  }

  private static Boolean allCompleted(List<Onboarding_Task__c> tasks) {
    for (Onboarding_Task__c task : tasks) {
      if (task.Status__c != TASK_COMPLETED) {
        return false;
      }
    }
    return true;
  }
}
