---
name: pr-description
description: Write the pull request description from the story plan and the branch diff - what changed, test evidence, deploy notes, reviewer checklist. Use when the story is verified in the sandbox and ready for a PR.
---
# PR description

1. Read `.claude/docs/stories/<KEY>.md` (plan, test plan, smoke-test evidence).
2. `git diff <develop|main>...HEAD --stat` and `git log <develop|main>..HEAD --oneline`.
3. Fill `pr-template.md` in this folder. Every section, no placeholders left; "None" where nothing applies.
4. Test evidence must be real output from this branch: deploy job id, tests passed/failed, coverage of the
   changed classes, and the smoke-test result.
5. End the description with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
6. Show the text to the user. Ask before running `git push -u origin <branch>` and
   `gh pr create --base develop --title "<KEY>: <title>" --body-file <file>` (base `main` until develop exists).
