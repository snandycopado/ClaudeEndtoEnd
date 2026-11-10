---
name: new-trigger-handler
description: Scaffold a trigger, a TriggerHandler subclass and its test for an object on the trigger framework. Use when an object needs its first Apex trigger logic.
---
# New trigger + handler

1. Check the object has no trigger yet: `Glob force-app/**/triggers/<Object>Trigger.trigger`. If one exists
   (e.g. AccountTrigger — shared), add a context method to its existing handler that calls your module's
   service — never a second trigger on the same object.
2. Copy from `templates/` into force-app/main/default (the structure is fixed) and replace `__Object__`
   (API name, e.g. `Offboarding_Task__c`) and `__Name__` (class-safe name with the module prefix, e.g. `OffboardingTask`):
   - `__Name__Trigger.trigger` + `-meta.xml` → `force-app/main/default/triggers/`
   - `__Name__TriggerHandler.cls` + `-meta.xml` → `force-app/main/default/classes/`
   - `__Name__TriggerHandlerTest.cls` + `-meta.xml` → `force-app/main/default/classes/`
3. Business logic goes in a `<Module>Service`, not in the handler.
4. Document in the module rule file (`.claude/rules/modules/<module>.md`) that a `Trigger_Setting__mdt`
   record named `<Name>TriggerHandler` with Is Active = false turns it off without a deploy.
