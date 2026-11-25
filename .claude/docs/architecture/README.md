# Architecture

- [Data model](data-model.md) — objects, relationships and which module owns them.
- Decisions (ADRs):
  - [ADR-0001 Fixed Salesforce structure; Claude assets in .claude/](adr/0001-claude-folder-fixed-sf-structure.md)
  - [ADR-0002 Logging through a Publish-Immediately platform event](adr/0002-applogger-platform-event.md)
  - [ADR-0003 Explicit access mode on API 67](adr/0003-explicit-access-mode-api-67.md)

## Logical layers (all in force-app/main/default, separated by file-name prefix)
```
exception framework  ←  trigger framework  ←  shared Account model  ←  modules (Onboarding, LCM, …) / integrations
 (AppLogger, *Exception)   (TriggerHandler)     (record types, status,     modules never call each other except
                                                 layout, AccountTrigger)    through the shared Account trigger
```
Known exception: `AccountTriggerHandler` (shared) calls `OnboardingService` — the Account trigger is the
orchestration point for module logic on Account. New modules add their call there.

## Request flow — onboarding
```
User sets Account_Status__c = Start Onboarding (Path / edit)
  → AccountTrigger → AccountTriggerHandler.afterUpdate
    → OnboardingService.startOnboarding → insert Onboarding_Task__c (from Onboarding_Task_Template__mdt)
        → OnboardingEmailQueueable (owner email per task)
User ticks a task in onboardingTaskTracker
  → OnboardingTaskController.completeTask → OnboardingTaskTrigger → OnboardingTaskTriggerHandler
    → OnboardingService.evaluateCompletion → Account_Status__c = Active when all tasks Completed
```

## Request flow — LCM
```
User opens LCM tab → lcmVendorNotifier → LcmNotificationController.getInternalAccounts (Internal record type)
User selects vendors + Send → LcmNotificationService.send
  → one email per vendor (LCM_Notification_Fields field set) → LCM_Notification__c audit rows
```
