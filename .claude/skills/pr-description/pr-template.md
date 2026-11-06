## <KEY>: <title>

**Story plan:** .claude/docs/stories/<KEY>.md · **Module:** <folder>

### What changed
- …

### Why
<one or two sentences from the story>

### Test evidence
| Check | Result |
|---|---|
| Deploy to developer org (job id) | Succeeded — `0Af…` |
| Apex tests (RunLocalTests) | N passed, 0 failed |
| Coverage of changed classes | ClassA 95%, ClassB 92% |
| Code review (sf-code-review) | No Blockers |
| Smoke test in org | <what was done and the observed result> |

### Deploy notes
- Package directories: …
- Post-deploy steps (permission-set assignments, Custom Metadata, data): None / …
- Removals for an architect: None / …

### Reviewer checklist
- [ ] Module CLAUDE.md updated (or not needed)
- [ ] Permission sets cover every new field / object / class
- [ ] No deleted metadata, no destructiveChanges, no profile or dsfs__ changes
- [ ] Verified in the developer org by: …
