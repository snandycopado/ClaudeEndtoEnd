## <KEY>: <title>

**Story plan:** .claude/docs/stories/<KEY>.md · **Module:** <folder>

### What changed

- …

### Why

<one or two sentences from the story>

### Deployment and review

| Check                            | Result                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Deploy to developer org (job id) | Succeeded, NoTestRun: `0Af…`                                                                                    |
| Code review (sf-code-review)     | No Blockers                                                                                                     |
| Tests                            | Not written or run by Claude. Developer to run them and add any needed (suggested cases in the plan, section 3) |

### Manual steps (from the Deployment Tracker)

1. … or None

### Deploy notes

- Package directories: …
- Post-deploy steps (permission-set assignments, Custom Metadata, data): None / …
- Removals for an architect: None / …

### Reviewer checklist

- [ ] Module CLAUDE.md updated (or not needed)
- [ ] Permission sets cover every new field / object / class
- [ ] No deleted metadata, no destructiveChanges, no profile or dsfs__ changes
- [ ] Verified in the developer org by: …
