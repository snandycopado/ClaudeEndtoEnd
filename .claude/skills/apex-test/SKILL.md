---
name: apex-test
description: Write or extend an Apex test class in this repo's pattern - OnboardingTestFactory personas, 200-record bulk, negative and permission tests, SYSTEM_MODE assertions. Use when creating or fixing Apex tests.
---
# Apex test pattern

1. Read `.claude/rules/test.md`.
2. Start from `test-template.cls` in this folder; rename `<Subject>` / `<Module_Permset>`.
3. One method per behaviour: `<behaviour>_<condition>` style names are fine, e.g. `completingAllTasksActivatesAccount`.
4. Always include, for each acceptance criterion: happy path, bulk (200), negative, permission.
5. Run only your class while iterating:
   `sf apex run test --class-names <Subject>Test --target-org <alias> --result-format human --code-coverage --wait 20`
6. Before deploy, the sf-deploy skill runs RunLocalTests for everything.

For tests written independently of the implementation, delegate to the `apex-test-writer` subagent.
