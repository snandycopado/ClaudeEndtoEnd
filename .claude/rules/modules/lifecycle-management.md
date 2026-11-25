---
paths:
  - "force-app/**/Lcm*"
  - "force-app/**/lcm*/**"
  - "force-app/**/*LCM_*"
  - "force-app/**/*LCM_*/**"
  - "force-app/**/objects/Account/fieldSets/LCM_*"
---
# Lifecycle Management (LCM) module (prefix: Lcm / lcm / LCM_)

Let a user inform selected vendors (Internal accounts) by email about a new or changed account.

## Entry points
- **LCM** tab on Account_Record_Page (shared) → LWC `lcmVendorNotifier`: Internal accounts except the
  current one, search, notification type (New Account / Account Update), optional message, Send.
- `LcmNotificationController.getInternalAccounts(accountId)` (cacheable), `sendNotification(accountId,
  vendorIds, notificationType, comments)` → `LcmNotificationService.send`.

## Key objects
- Vendors = Accounts with record type `Internal`; address `Account.Email__c` (both shared).
- Field set `Account.LCM_Notification_Fields` — Account fields in the email, in order (admins edit, no code);
  Record Type and Owner rows always appended.
- `LCM_Notification__c` (LCM-000000) — per vendor per send: Account, Vendor Account, Email, Notification Type,
  Comments, Status (Sent / Skipped / Failed), Error Message. Related list on the Account layout.
- Permission set `LCM_User` (read Account + LCM_Notification__c, edit Email__c, controller, Internal RT).

## Behaviour
- One HTML + text email per vendor, single `Messaging.sendEmail` call; reply-to = sender; input HTML-escaped.
- No email → Skipped; non-Internal / inaccessible selections skipped and counted.
- Max 100 vendors, comments ≤ 1000 chars, type must be one of two values (ValidationException).
- Reads in user mode; audit insert in system mode.
- `reserveSingleEmailCapacity` failure → all Failed "Daily email limit reached" (Developer Edition limit is low).

## Tests
LcmNotificationServiceTest — persona `OnboardingTestFactory.createStandardUser(LCM_User, Onboarding_Manager, Application_Logger)`.
Known gap: LcmNotificationController 74% coverage (unexpected-exception branch untested).
