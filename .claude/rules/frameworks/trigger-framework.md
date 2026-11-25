---
paths:
  - "force-app/**/classes/TriggerHandler*"
  - "force-app/**/classes/*TriggerHandler*"
  - "force-app/**/triggers/**"
  - "force-app/**/objects/Trigger_Setting__mdt/**"
  - "force-app/**/customMetadata/Trigger_Setting.*"
  - "force-app/**/customPermissions/Bypass_All_Triggers*"
  - "force-app/**/permissionsets/Trigger_Bypass*"
---
# Trigger framework (architect-owned — edits ask for approval)

`TriggerHandler` (force-app/main/default/classes) — virtual base class every trigger handler extends.
Dispatches to the context method, supports bypass, an org-level switch, a per-user kill switch and a
recursion guard. Unhandled exceptions from a handler are logged via AppLogger and rethrown.

Components: TriggerHandler (+Test), Trigger_Setting__mdt (DeveloperName = handler class, Is_Active__c,
no record = active), custom permission Bypass_All_Triggers + permission set Trigger_Bypass (data loads only).

## Mandatory usage
```apex
trigger OnboardingTaskTrigger on Onboarding_Task__c(before insert, before update, before delete,
        after insert, after update, after delete, after undelete) {
    new OnboardingTaskTriggerHandler().run();
}

public with sharing class OnboardingTaskTriggerHandler extends TriggerHandler {
    protected override void afterUpdate() {
        OnboardingService.evaluateCompletion(accountIds((List<Onboarding_Task__c>) newList, oldMap));
    }
}
```
- In handlers: `newList`, `newMap`, `oldList`, `oldMap` (cast to the concrete type).
- Bypass in code: `TriggerHandler.bypass('AccountTriggerHandler'); … clearBypass(...)` — clear in a `finally`.
- Recursion: `setMaxLoopCount(n)` (per handler per context).
- Switch off without deploy: Trigger_Setting__mdt record `<HandlerName>`, Is Active = false.
- Scaffold: `new-trigger-handler` skill.

## Existing triggers
| Trigger | Handler | Owner |
|---|---|---|
| AccountTrigger | AccountTriggerHandler | shared (calls module services) |
| OnboardingTaskTrigger | OnboardingTaskTriggerHandler | onboarding |
| ErrorLogEventTrigger | none — plain trigger | exception framework |

## Never change
- `run()` order: context check → bypass / permission / metadata → loop count → dispatch.
- Log-and-rethrow in `run()` — modules rely on it instead of their own try/catch.
- Platform-event triggers that write logs must not extend TriggerHandler (loop risk).
