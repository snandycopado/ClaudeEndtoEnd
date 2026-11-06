---
name: story-to-plan
description: Turn a user story (e.g. "Implement ONB-012") into an impact plan at .claude/docs/stories/<KEY>.md using the fixed template, then STOP for human approval. Use at the start of every story, before writing code.
---
# Story to impact plan

1. Get the story key, title, description and acceptance criteria. If the user only gave a key and no MCP
   tracker is configured, ask them to paste the story.
2. Delegate the analysis to the `story-analyst` subagent (and `impact-analyzer` if shared Account metadata, a framework or an
   integration is touched). Give it the story text.
3. Write the result to `.claude/docs/stories/<KEY>.md` using `plan-template.md` in this folder. Keep every section;
   write "None" rather than deleting one.
4. Branch name goes in the plan: `feature/<KEY>-<short-kebab-name>`.
5. STOP. Show the plan summary (files to change, risks, open questions) and ask:
   "Approve this plan?" Do not create the branch or edit any metadata until the user approves.
6. After approval, record it in the plan's Approval section (who/when) and continue with the build.
