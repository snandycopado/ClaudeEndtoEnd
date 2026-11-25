@IsTest
private class OnboardingTaskControllerTest {
  private static Account startOnboarding() {
    Account acc = OnboardingTestFactory.newAccount(
      'Acme',
      OnboardingTestFactory.AUSTRALIA,
      OnboardingService.ACCOUNT_START_ONBOARDING
    );
    insert acc;
    return acc;
  }

  @IsTest
  static void getTasksReturnsOrderedTasks() {
    OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
    System.runAs(OnboardingTestFactory.createOnboardingUser()) {
      Account acc = startOnboarding();
      List<Onboarding_Task__c> tasks = OnboardingTaskController.getTasks(
        acc.Id
      );
      Assert.areEqual(2, tasks.size(), 'Two matching tasks');
      Assert.areEqual(10, tasks[0].Order__c, 'Ordered by Order__c');
      Assert.areEqual(20, tasks[1].Order__c, 'Ordered by Order__c');
    }
  }

  /** KAN-3: the tracker links each task to its record page, so getTasks must return Id and Name for the user. */
  @IsTest
  static void getTasksReturnsIdAndNameForOnboardingManager() {
    OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
    System.runAs(OnboardingTestFactory.createStandardUser(
      new List<String>{ 'Onboarding_Manager', 'Application_Logger' }
    )) {
      Account acc = startOnboarding();
      List<Onboarding_Task__c> tasks = OnboardingTaskController.getTasks(
        acc.Id
      );
      Assert.areEqual(2, tasks.size(), 'Generic + Australia customer task');
      Map<Id, Onboarding_Task__c> readable = new Map<Id, Onboarding_Task__c>(
        [
          SELECT Id, Name
          FROM Onboarding_Task__c
          WHERE Account__c = :acc.Id
          WITH USER_MODE
        ]
      );
      for (Onboarding_Task__c t : tasks) {
        Assert.isNotNull(t.Id, 'Id needed for the record link');
        Assert.isTrue(String.isNotBlank(t.Name), 'Name is the link text');
        Assert.isTrue(
          readable.containsKey(t.Id),
          'User can open the task record: ' + t.Name
        );
      }
      Assert.areEqual(
        'All Accounts Task',
        tasks[0].Name,
        'Name from the template label'
      );
    }
  }

  @IsTest
  static void completeTaskMarksCompletedAndActivatesWhenLast() {
    OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
    System.runAs(OnboardingTestFactory.createOnboardingUser()) {
      Account acc = startOnboarding();
      for (Onboarding_Task__c t : OnboardingTaskController.getTasks(acc.Id)) {
        OnboardingTaskController.completeTask(t.Id);
      }
      for (Onboarding_Task__c t : OnboardingTaskController.getTasks(acc.Id)) {
        Assert.areEqual(
          OnboardingService.TASK_COMPLETED,
          t.Status__c,
          'Task completed'
        );
        Assert.isNotNull(t.Completed_Date__c, 'Completed date stamped');
      }
      Account reloaded = [
        SELECT Account_Status__c
        FROM Account
        WHERE Id = :acc.Id
        WITH SYSTEM_MODE
      ];
      Assert.areEqual(
        OnboardingService.ACCOUNT_ACTIVE,
        reloaded.Account_Status__c,
        'Account activated'
      );
    }
  }

  @IsTest
  static void completeTaskFailureIsLoggedAndSurfaced() {
    OnboardingService.templateOverride = OnboardingTestFactory.standardTemplates();
    Id deletedTaskId;
    System.runAs(OnboardingTestFactory.createOnboardingUser()) {
      Account acc = startOnboarding();
      Onboarding_Task__c task = OnboardingTaskController.getTasks(acc.Id)[0];
      deletedTaskId = task.Id;
      delete task;

      Test.startTest();
      try {
        OnboardingTaskController.completeTask(deletedTaskId);
        Assert.fail('Completing a deleted task must fail');
      } catch (AuraHandledException ex) {
        Assert.isTrue(
          String.isNotBlank(ex.getMessage()),
          'Readable message for the LWC'
        );
      }
      Test.stopTest();
    }
    List<Error_Log__c> logs = [
      SELECT Source_Class__c, Record_Id__c
      FROM Error_Log__c
      WHERE Source_Class__c = 'OnboardingTaskController'
      WITH SYSTEM_MODE
    ];
    Assert.areEqual(1, logs.size(), 'Failure logged');
    Assert.areEqual(
      String.valueOf(deletedTaskId),
      logs[0].Record_Id__c,
      'Task id on the log'
    );
  }
}
