# ADR-0001: Fixed Salesforce structure; all Claude assets in .claude/

- Status: Accepted (2026-11-07). Supersedes the unmerged ESM-001 proposal (module package directories).
- Context: The plan proposed one package directory per module (core/, shared/, modules/…) with a CLAUDE.md in
  each. The project does not allow changes to the Salesforce project structure.
- Decision:
  - The Salesforce project stays standard: all metadata in force-app/main/default, one package directory.
  - Everything Claude-related lives in `.claude/`: CLAUDE.md (project memory), settings, hooks, agents, skills,
    rules, docs (plan, architecture, stories). CI lives in `.github/`. Only `.mcp.json` sits at the root,
    because Claude Code reads it only there.
  - The plan's per-folder CLAUDE.md layers become path-scoped rules in `.claude/rules/` (frameworks/, shared.md,
    modules/, integrations/, experience.md) that load when Claude opens matching files.
  - Module and framework boundaries are expressed by file-name prefixes (Onboarding*, Lcm*/LCM_*, AppLogger,
    TriggerHandler, Integration*…). `.claude/hooks/lib/protected-paths.mjs` is the single list of framework
    and shared components used by the hooks and the deploy helper; CODEOWNERS mirrors it.
- Consequences: Zero change to the Salesforce project. New metadata must use its module prefix, or module
  rules will not load and ownership checks will not apply. Deploys name components (--metadata or a story
  manifest in .claude/docs/stories/manifests/) instead of folders.
