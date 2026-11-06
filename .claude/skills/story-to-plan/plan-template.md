# <KEY>: <Story title>

| | |
|---|---|
| Module | onboarding / lifecycle-management / … (or shared / a framework / an integration) — see .claude/CLAUDE.md |
| Branch | feature/<KEY>-<short-name> |
| Status | Draft → Approved → Built → Verified in sandbox → PR |
| Author | Claude (story-analyst) |

## Story
<As a … I want … so that …>

## Acceptance criteria
1. …
2. …

## Impact
| Change | Type | Folder / file | New or modified |
|---|---|---|---|
| e.g. Account.Region__c | CustomField | force-app/main/default/objects/Account/fields | New |

- Frameworks used: TriggerHandler / AppLogger / ValidationException / Integration framework / none
- Permission sets updated: …
- Other modules affected (from impact-analyzer): None / …
- Layout / record page / Path changes: None / …

## Design
<Short description of the approach: entry point → handler → service → data. Why this approach.>

## Test plan
| Acceptance criterion | Test class.method | Kind (happy / bulk / negative / permission) |
|---|---|---|
| 1 | … | happy |

## Deployment
- Components to deploy (for --metadata or .claude/docs/stories/manifests/<KEY>.xml): …
- Data or configuration steps after deploy (Custom Metadata records, permission-set assignments): …
- Removals needed (done by an architect, not Claude): None / …

## Risks and open questions
- …

## Approval
- Plan approved by: … on …
- Sandbox verification by: … on …
