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
| Record types `Customer`, `Partner`, `Internal` | Internal = vendor accounts | onboarding (templates by RT), LCM (vendors) |
| `Account_Status__c` (New, Start Onboarding, Active, Inactive) | Lifecycle status on the Path | onboarding |
| `Email__c` | Account email; vendor notification address | LCM |
| AccountTrigger → AccountTriggerHandler | Calls module services (OnboardingService.startOnboarding) | onboarding |
| layouts/Account-Account Layout | Onboarding section, Email, related lists Onboarding Tasks + LCM Notifications | all |
| flexipages/Account_Record_Page | Org default desktop page: Path, onboardingTaskTracker, tabs Details / LCM | all |
| pathAssistants (Master, Customer, Partner, Internal) + settings/PathAssistant | Path on Account_Status__c | all |
| objects/Account/Account.object-meta.xml | 54 actionOverrides; View (Large) → Account_Record_Page | all |

Module-specific Account metadata belongs to the module even though it sits under objects/Account/:
`Onboarding_*` fields → onboarding; field set `LCM_Notification_Fields` → LCM.

## Rules
- Edit in place — never regenerate the layout, record page or Account.object-meta.xml.
- A new module's Account logic = one context-method call in AccountTriggerHandler → the module's service.
  Never a second Account trigger.
- FlexiPage facets: unique names (`Facet-esm-<module>-<name>`), no `<mode>` on facets.
- New record type: add Account_Status__c values, a PathAssistant, and visibility in the modules' permission sets.
- State/Country picklists are on: full valid country names.
