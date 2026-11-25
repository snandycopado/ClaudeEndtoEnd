# Story manifests

Optional `<KEY>.xml` (package.xml format) per story when a deploy needs a precise component list:
`node .claude/skills/sf-deploy/deploy.mjs --manifest .claude/docs/stories/manifests/<KEY>.xml`.
The guard hook only accepts manifests from this folder and refuses any that list framework components.
destructiveChanges files are never created here — removals are done by an architect.
