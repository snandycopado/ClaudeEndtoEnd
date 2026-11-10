---
paths:
  - "**/*Test.cls"
  - "**/*TestFactory.cls"
  - "**/*TestFactory*.cls"
---

# Apex test rules

> Story workflow: Claude does not run tests and writes Apex tests only when a story adds production Apex with no
> test class (CLAUDE.md step 3). The developer runs the tests and adds any needed. When tests are written, these rules apply.

- One test class per class under test: `<Class>Test`, `@IsTest private class`.
- 90%+ coverage on every changed class; the org minimum is 75% but coverage is never the goal — behaviour is.
- Every test method asserts outcomes with `Assert.areEqual/isTrue/isNull/fail` and a message on each assert.
- Required kinds of test for a story:
  1. Happy path.
  2. Bulk: 200 records through the trigger path.
  3. Negative: invalid input → `ValidationException` / `AuraHandledException` with the expected message.
  4. Permission: run as a Standard User **with** the module permission set; where relevant also without it.
- Users: `OnboardingTestFactory.createStandardUser(new List<String>{ '<Module_Permset>', 'Application_Logger' })`
  and `System.runAs(user) { … }`. It lives in OnboardingTestFactory today but is generic — every module uses it.
- Accounts: `OnboardingTestFactory.newAccount(name, OnboardingTestFactory.CUSTOMER, null)` (record type constants CUSTOMER / PARTNER).
- Read results back `WITH SYSTEM_MODE` so the assertion is not affected by the test user's FLS.
- Update records with a fresh sObject (`new X(Id = id, Field = value)`), not one queried with read-only fields.
- Custom Metadata cannot be inserted: set the service's `@TestVisible` override list with records built via
  `JSON.deserialize` (see OnboardingTestFactory.template).
- Platform events, Queueables and future methods run inside `Test.startTest()` / `Test.stopTest()`.
- Never `SeeAllData=true`, never depend on existing org data, never hard-code Ids.
