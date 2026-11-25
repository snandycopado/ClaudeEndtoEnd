# Review checklist

Severity: **Blocker** = must not deploy. **Major** = fix in this PR. **Minor** = note.

## Apex
- [ ] Blocker: SOQL/DML/callout/publish/sendEmail inside a loop.
- [ ] Blocker: SOQL/DML without an explicit access mode on API 67 (USER_MODE for user actions, SYSTEM_MODE for automation).
- [ ] Blocker: exception swallowed (`catch {}` or only `System.debug`); errors not logged via AppLogger.
- [ ] Blocker: trigger with logic in it, or a second trigger on the same object.
- [ ] Blocker: hard-coded Ids, endpoints, credentials; callout outside the Integration framework.
- [ ] Blocker: dynamic SOQL built from input without binds.
- [ ] Major: `without sharing` without a reason in the class header.
- [ ] Major: magic strings for picklist values instead of service constants.
- [ ] Major: Custom Metadata switch/mapping hard-coded in Apex instead.
- [ ] Minor: class header comment missing or out of date.

## Tests
- [ ] Blocker: changed class below 90% coverage, or a test without assertions.
- [ ] Blocker: `SeeAllData=true` or dependence on existing org data.
- [ ] Major: no 200-record bulk test for trigger paths.
- [ ] Major: no negative test for each validation rule / ValidationException.
- [ ] Major: no `System.runAs` Standard User + module permission set test.
- [ ] Minor: assert without a message.

## LWC
- [ ] Blocker: user input rendered as HTML; `lwc:dom="manual"` with untrusted content.
- [ ] Major: Apex used where LDS would do; `cacheable=true` on a method that writes.
- [ ] Major: errors not shown to the user (no toast / error state); `console.log` left in.
- [ ] Major: no loading / empty / error states.
- [ ] Minor: no Jest test for a new component.

## Flow
- [ ] Blocker: record-triggered flow duplicating TriggerHandler logic on the same object.
- [ ] Major: missing entry criteria; DML/Apex elements without fault paths.
- [ ] Minor: elements without descriptions.

## Metadata and security
- [ ] Blocker: deleted metadata files, destructiveChanges, profile edits, dsfs__ edits.
- [ ] Blocker: new field/object/record type/LWC-facing class not in the module permission set.
- [ ] Major: permission set grants Modify All / View All without a reason.
- [ ] Major: every new object/field has a description.
- [ ] Major: shared Account metadata regenerated instead of edited in place (check actionOverrides, layout sections).

## Documentation
- [ ] Major: module rule file (.claude/rules/modules/<module>.md) not updated when entry points, objects or gotchas changed.
- [ ] Minor: .claude/docs/stories/<KEY>.md not updated with what was actually built.
