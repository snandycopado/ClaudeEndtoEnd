# <KEY>: <Story title>

|        |                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------- |
| Jira   | <link>                                                                                                  |
| Module | onboarding / lifecycle-management / … (or shared / a framework / an integration). See .claude/CLAUDE.md |
| Branch | feature/<KEY>-<short-name>                                                                              |
| Status | Draft → Approved → Deployed to dev org → PR                                                             |
| Author | Claude (story-analyst)                                                                                  |

## 1. Story Description

**Story:** <As a … I want … so that …, or the Jira text as written>

**Acceptance criteria** (from Jira; mark derived ones "(derived, to confirm)"):

1. …
2. …

**Decisions** (open questions answered before approval):

| #   | Question | Decision |
| --- | -------- | -------- |
| D1  | …        | …        |

## 2. High Level Design

<What the solution is, in plain words, for a reviewer who has not read the code: approach, why this approach,
alternatives rejected.>

- **Components:** <which layers: LWC / Apex service / trigger / Flow / metadata / config>
- **Modules affected:** <module + any shared, framework or integration impact (from impact-analyzer)>
- **Data model:** <new or changed objects, fields, record types; None>
- **Security:** <permission sets updated, sharing and access mode; never profiles>
- **Risks:** <what could go wrong, and known limitations>

## 3. Low Level Design

| Component              | Type        | File                                                                   | New / Modified | Change               |
| ---------------------- | ----------- | ---------------------------------------------------------------------- | -------------- | -------------------- |
| e.g. Account.Region__c | CustomField | force-app/main/default/objects/Account/fields/Region__c.field-meta.xml | New            | Picklist AU/NZ/US/CA |

<Per component, the detail a developer needs to review it: method signatures, the trigger context → handler →
service flow, SOQL and access mode, LWC wire/imperative calls, error handling (AppLogger / ValidationException),
layout and field-level changes. Code snippets only where they make a rule clear.>

**Tests:** not written or run by Claude. The developer reviews the code, runs the tests and adds any they need.
Suggested test cases for the developer:

- …

## 4. Deployment Tracker

| #   | Step                     | Components / action                                    | Who       | Status  | Evidence |
| --- | ------------------------ | ------------------------------------------------------ | --------- | ------- | -------- |
| 1   | Deploy to dev org        | `Type:Name`, …                                         | Claude    | Pending | job id   |
| 2   | Manual step: …           | e.g. Page Layout Assignment, permission set assignment | Admin     | Pending |          |
| 3   | Developer review + tests | run tests, add tests if needed                         | Developer | Pending |          |
| 4   | Pull request             | PR link                                                | Claude    | Pending |          |

**Manual steps** (profiles, layout assignment, default record types, permission set assignments, data):

1. … or None

**Destructive changes** (deleting a class, field, object or other metadata): None, or the list. Each needs the
user's explicit approval first. Hooks may still block some (deleting Apex, destructiveChanges files); those go to an architect.

## Approval

- Plan approved by: … on …
