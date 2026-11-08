---
paths:
  - "force-app/**/objects/Account/**"
  - "force-app/**/layouts/Account-*"
  - "force-app/**/flexipages/Account_Record_Page*"
  - "force-app/**/pathAssistants/**"
  - "force-app/**/settings/**"
  - "force-app/**/classes/AccountTrigger*"
  - "force-app/**/triggers/AccountTrigger*"
---
# Shared Account data model (used by every module — edits ask for approval)

| Item | Purpose | Used by |
|---|---|---|
| Record types `Australia`, `New_Zealand`, `United_States`, `Canada` (customer accounts, KAN-2), `Partner`, `Internal` | Internal = vendor accounts. `Customer` is retired by KAN-2 (inactive; existing records only) | onboarding (templates by RT), LCM (vendors) |
| `Account_Status__c` (New, Start Onboarding, Active, Inactive) | Lifecycle status on the Path | onboarding |
| `Email__c` | Account email; vendor notification address | LCM |
| AccountTrigger → AccountTriggerHandler | Calls module services (OnboardingService.startOnboarding) | onboarding |
| layouts/Account-Account Layout | Onboarding section, Email, related lists Onboarding Tasks + LCM Notifications. Used by Partner, Internal, Customer | all |
| layouts/Account-{Australia, New Zealand, United States, Canada} Account Layout | One per country record type; identical copies of Account Layout for now (KAN-2). Assignment is per profile — manual admin step, never via profile metadata | all |
| flexipages/Account_Record_Page | Org default desktop page: Path, onboardingTaskTracker, tabs Details / LCM | all |
| pathAssistants (Master, Customer, Partner, Internal, Australia, New_Zealand, United_States, Canada) + settings/PathAssistant | Path on Account_Status__c (one per record type) | all |
| objects/Account/Account.object-meta.xml | 54 actionOverrides; View (Large) → Account_Record_Page | all |

Module-specific Account metadata belongs to the module even though it sits under objects/Account/:
`Onboarding_*` fields → onboarding; field set `LCM_Notification_Fields` → LCM.

## Rules
- Edit in place — never regenerate the layout, record page or Account.object-meta.xml.
- A new module's Account logic = one context-method call in AccountTriggerHandler → the module's service.
  Never a second Account trigger.
- FlexiPage facets: unique names (`Facet-esm-<module>-<name>`), no `<mode>` on facets.
- New record type: add Account_Status__c values, a PathAssistant, and visibility in the modules' permission sets.
  Deploy the record types (and permission set) before Apex tests that use them: a check-only deploy that creates
  a record type does not make it usable for test users in the same validation (KAN-2).
- Layout ↔ record type assignment and default record type live on profiles → manual admin step, recorded in the story plan.
- State/Country picklists are on: full valid country names.
