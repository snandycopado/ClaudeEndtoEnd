#!/usr/bin/env node
/**
 * PreToolUse guard for Edit / Write / MultiEdit / NotebookEdit (guardrail layer 3).
 *
 * Block (exit 2):
 *   - the Salesforce project structure: sfdx-project.json, .forceignore, anything under force-app/ that is
 *     not under force-app/main/default/
 *   - managed-package (dsfs__) components, installedPackages/, profiles, destructiveChanges*.xml
 *   - .claude/settings.json, .claude/hooks/**, .github/**
 * Ask the user:
 *   - framework components (Trigger / Exception / Integration frameworks) — architect-owned
 *   - shared Account metadata (record types, Account_Status__c, Email__c, layout, record page, Path, AccountTrigger)
 * Allow: everything else, including files outside the project (scratchpad, memory).
 */
import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { classify, SF_ROOT } from './lib/protected-paths.mjs';

let input = {};
try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
    process.exit(0);
}
const target = input?.tool_input?.file_path || input?.tool_input?.notebook_path;
if (!target) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const abs = isAbsolute(target) ? target : resolve(projectDir, target);
const relRaw = relative(projectDir, abs);
if (relRaw.startsWith('..') || isAbsolute(relRaw)) process.exit(0); // outside the project
const rel = relRaw.replace(/\\/g, '/');
const lower = rel.toLowerCase();

function block(reason) {
    process.stderr.write(`BLOCKED by .claude/hooks/guard-protected-files: ${rel} — ${reason}\nDo not work around this guard. Explain the block to the user.\n`);
    process.exit(2);
}

function ask(reason) {
    process.stdout.write(
        JSON.stringify({
            hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `${rel}: ${reason}` }
        })
    );
    process.exit(0);
}

if (rel === 'sfdx-project.json' || rel === '.forceignore') block('the Salesforce project structure is fixed and is not changed by Claude.');
if (rel.startsWith('force-app/') && !rel.startsWith(SF_ROOT + '/')) block(`all metadata lives in ${SF_ROOT}/ — the project structure is fixed.`);
if (/(^|[/._])dsfs__/i.test(rel)) block('DocuSign managed-package (dsfs__) metadata is never edited; build extensions in your own components.');
if (lower.includes('/installedpackages/') || lower.startsWith('installedpackages/')) block('installed packages are managed outside this repo.');
if (lower.includes('/profiles/') || lower.endsWith('.profile-meta.xml')) block('profiles are not edited — use permission sets.');
if (/destructivechanges[^/]*\.xml$/i.test(rel)) block('destructiveChanges files are CI-only and created by an architect.');
if (rel === '.claude/settings.json') block('team Claude settings change only through a reviewed PR by a human.');
if (rel.startsWith('.claude/hooks/')) block('guard hooks change only through a reviewed PR by a human.');
if (rel.startsWith('.github/')) block('CI workflows and CODEOWNERS change only through a reviewed PR by a human.');

const owner = classify(rel);
if (owner === 'framework') ask('framework component (architect-owned). Approve only if the story plan includes this framework change.');
if (owner === 'shared') ask('shared Account metadata used by every module. Approve only if the story plan includes it.');

process.exit(0);
