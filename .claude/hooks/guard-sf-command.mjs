#!/usr/bin/env node
/**
 * PreToolUse guard for Bash and PowerShell commands (guardrail layer 3).
 *
 * Receives the tool call as JSON on stdin and inspects every segment of the command, including chained
 * commands (&&, ||, ;, |, newlines) that permission prefix patterns miss.
 * Exit 2 = block (stderr is shown to Claude). Exit 0 = allow.
 *
 * Salesforce CLI:
 *  - destructive commands (org/project/data delete, data update, org login/logout, package uninstall)
 *  - destructive deploy flags (--pre/--post-destructive-changes, --purge-on-delete, destructiveChanges manifests)
 *  - any --target-org / -o not in .claude/allowed-orgs; org-changing commands without an explicit allowed org
 *  - changing the default target org
 *  - deploys of the whole project / force-app / metadata-type folders, of framework components
 *    (see lib/protected-paths.mjs), without an explicit scope, or from manifests outside .claude/docs/stories/manifests/
 *  - anonymous Apex from stdin, or files containing delete / Database.delete / emptyRecycleBin / undelete
 * git: force/mirror/delete push, push to or commit on main|master|develop, reset --hard, clean -f,
 *      branch -D, discarding all changes, git rm of project files
 * Files: rm / Remove-Item / del … of anything inside the Salesforce project or the Claude/CI config.
 *
 * Only the arguments of the command itself are inspected — text inside a commit message or heredoc body
 * passed to another program is not treated as an sf flag.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { deployTargetProblem, isFrameworkMetadata, manifestFrameworkMembers } from './lib/protected-paths.mjs';

const PROTECTED_BRANCHES = new Set(['main', 'master', 'develop']);
const PROTECTED_ROOTS = ['force-app', 'manifest', 'config', 'scripts', '.claude', '.github', 'sfdx-project.json', '.forceignore'];
const STORY_MANIFESTS = '.claude/docs/stories/manifests/';

let input = {};
try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
    process.exit(0); // not our input; never break the session
}
const command = String(input?.tool_input?.command ?? '');
if (!command.trim()) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const cwd = input.cwd || projectDir;

function block(reason) {
    process.stderr.write(
        `BLOCKED by .claude/hooks/guard-sf-command: ${reason}\n` +
            'Do not work around this guard. Explain the block to the user; changes like this need a human.\n'
    );
    process.exit(2);
}

function allowedOrgs() {
    const file = join(projectDir, '.claude', 'allowed-orgs');
    if (!existsSync(file)) return new Set();
    return new Set(
        readFileSync(file, 'utf8')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'))
    );
}

/** Minimal shell-ish tokenizer: respects single/double quotes. */
function tokenize(segment) {
    const tokens = [];
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let m;
    while ((m = re.exec(segment))) tokens.push(m[1] ?? m[2] ?? m[3]);
    return tokens;
}

function flagValues(tokens, names) {
    const values = [];
    tokens.forEach((t, i) => {
        for (const n of names) {
            if (t === n && i + 1 < tokens.length) values.push(tokens[i + 1]);
            else if (t.startsWith(n + '=')) values.push(t.slice(n.length + 1));
        }
    });
    return values;
}

function projectPath(p) {
    const abs = isAbsolute(p) ? p : resolve(cwd, p);
    const rel = relative(projectDir, abs);
    return { abs, rel: rel.replace(/\\/g, '/'), inside: !rel.startsWith('..') && !isAbsolute(rel) };
}

function isProtectedPath(p) {
    const { rel, inside } = projectPath(p);
    if (!inside) return false;
    if (rel === '' || rel === '.') return true;
    return PROTECTED_ROOTS.some((root) => rel === root || rel.startsWith(root + '/'));
}

function currentBranch() {
    try {
        const head = readFileSync(join(projectDir, '.git', 'HEAD'), 'utf8').trim();
        return head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : null;
    } catch {
        return null;
    }
}

/**
 * Split into command segments. Heredoc bodies are data for the receiving program (commit messages, file
 * contents) and are dropped — unless the receiver is a shell, in which case the body IS commands and is kept.
 */
const SHELLS = /(^|[\s;&|(])(bash|sh|zsh|dash|ksh|pwsh|powershell|cmd|sf|sfdx)(\.exe)?\s*(-[a-z]+\s*)*<<-?/i;
function segmentsOf(cmd) {
    const lines = cmd.split(/\r?\n/);
    const kept = [];
    for (let i = 0; i < lines.length; i++) {
        kept.push(lines[i]);
        const hd = lines[i].match(/<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/);
        if (hd && !SHELLS.test(lines[i])) {
            const end = hd[1];
            while (i + 1 < lines.length && lines[i + 1].trim() !== end) i++;
            i++; // skip terminator
        }
    }
    return kept
        .join('\n')
        .split(/&&|\|\||;|\||\r?\n/)
        .map((s) => s.trim().replace(/^[&(]+\s*/, '').replace(/^\$\(/, ''))
        .filter(Boolean);
}

const allowed = allowedOrgs();

for (const segment of segmentsOf(command)) {
    const tokens = tokenize(segment);
    while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift(); // FOO=bar cmd
    if (tokens.length === 0) continue;
    let exe = tokens[0].replace(/\\/g, '/').split('/').pop().toLowerCase();
    let args = tokens.slice(1);
    if (exe === 'npx' && args[0] && /^@salesforce\/cli/.test(args[0])) {
        exe = 'sf';
        args = args.slice(1);
    }
    exe = exe.replace(/\.(cmd|exe|ps1)$/, '');

    // ------------------------------------------------ Salesforce CLI
    if (exe === 'sf' || exe === 'sfdx') {
        const words = args.filter((a) => !a.startsWith('-'));
        const sub = words.slice(0, 3).join(' ').toLowerCase();
        const has = (prefix) => sub === prefix || sub.startsWith(prefix + ' ') || sub.startsWith(prefix + ':');

        if (args.some((a) => /^--(pre|post)-destructive-changes(=|$)|^--purge-on-delete$/i.test(a) || /destructivechanges/i.test(a))) {
            block('destructive deploy flags or destructiveChanges manifests are CI-only (a separate, manually triggered release job).');
        }

        const denied = [
            'org delete', 'org logout', 'org login', 'project delete', 'data delete', 'data update',
            'package uninstall', 'force:org:delete', 'force:source:delete', 'force:data:record:delete',
            'force:data:record:update', 'force:auth', 'auth'
        ];
        for (const d of denied) if (has(d)) block(`"sf ${d}" is not allowed from Claude.`);

        const targets = flagValues(args, ['--target-org', '-o', '--targetusername', '-u']);
        for (const t of targets) {
            if (!allowed.has(t)) block(`target org "${t}" is not in .claude/allowed-orgs (allowed: ${[...allowed].join(', ') || 'none'}).`);
        }

        if (has('config set') || has('config unset')) {
            const setsOrg = args.find((a) => /^target-org(=|$)/.test(a));
            if (setsOrg) {
                const value = setsOrg.includes('=') ? setsOrg.split('=')[1] : args[args.indexOf(setsOrg) + 1];
                if (has('config unset') || !allowed.has(value)) block('changing the default target-org to a non-allowed org is not allowed.');
            }
        }

        const isApexTest = has('apex run test');
        const orgChanging =
            has('project deploy') || has('apex run') || has('org assign') || has('package install') ||
            /^data (create|import|upsert|bulk|record)/.test(sub) || has('force:source:deploy') ||
            has('force:mdapi:deploy') || has('force:apex:execute');
        if (orgChanging && !isApexTest && targets.length === 0) {
            block('org-changing sf commands must name an allowed org explicitly with --target-org <alias>.');
        }

        if (has('project deploy start') || has('project deploy validate') || has('force:source:deploy')) {
            const sourceDirs = flagValues(args, ['--source-dir', '-d', '--sourcepath', '-p']);
            const manifests = flagValues(args, ['--manifest', '-x']);
            const metadata = flagValues(args, ['--metadata', '-m']);
            if (sourceDirs.length + manifests.length + metadata.length === 0) {
                block('a deploy must state its scope with --source-dir <files>, --metadata or --manifest.');
            }
            for (const dir of sourceDirs) {
                const { rel, inside } = projectPath(dir);
                const problem = inside ? deployTargetProblem(rel) : 'is outside the project';
                if (problem) block(`deploy target "${dir}" ${problem}.`);
            }
            for (const spec of metadata) {
                if (isFrameworkMetadata(spec)) block(`"${spec}" is a framework component (architect-owned; deployed after PR review).`);
            }
            for (const m of manifests) {
                const { rel, inside, abs } = projectPath(m);
                if (!inside || !rel.startsWith(STORY_MANIFESTS)) block(`manifest "${m}" is outside ${STORY_MANIFESTS} — deploy only the story's own manifest.`);
                let xml = '';
                try {
                    xml = readFileSync(abs, 'utf8');
                } catch {
                    block(`cannot read manifest "${m}" to check it.`);
                }
                const hits = manifestFrameworkMembers(xml);
                if (hits.length) block(`manifest "${m}" includes framework components: ${hits.join(', ')}.`);
            }
        }

        if (has('apex run') && !isApexTest) {
            const files = flagValues(args, ['--file', '-f']);
            if (files.length === 0) block('anonymous Apex must come from a reviewed file (--file), not stdin.');
            for (const f of files) {
                let body = '';
                try {
                    body = readFileSync(projectPath(f).abs, 'utf8');
                } catch {
                    block(`cannot read anonymous Apex file "${f}" to check it.`);
                }
                const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
                if (/\bdelete\s|Database\.delete|emptyRecycleBin|\bundelete\b|Database\.purge/i.test(code)) {
                    block(`anonymous Apex "${f}" deletes data (delete / Database.delete / emptyRecycleBin). Not allowed.`);
                }
            }
        }
        continue;
    }

    // ------------------------------------------------ git
    if (exe === 'git') {
        const a = [...args];
        while (a.length && (a[0] === '-c' || a[0] === '-C')) a.splice(0, 2);
        const verb = (a[0] || '').toLowerCase();
        const rest = a.slice(1);
        const branch = currentBranch();

        if (verb === 'push') {
            if (rest.some((t) => /^(--force|-f|--force-with-lease.*|--mirror|--delete|-d|--prune)$/.test(t) || /^\+/.test(t))) {
                block('force / mirror / delete pushes are not allowed.');
            }
            const refspecs = rest.filter((t) => !t.startsWith('-')).slice(1); // after the remote
            for (const ref of refspecs) {
                if (ref.startsWith(':')) block('deleting a remote branch is not allowed.');
                const dest = (ref.includes(':') ? ref.split(':').pop() : ref).replace(/^refs\/heads\//, '');
                if (PROTECTED_BRANCHES.has(dest)) block(`pushing to "${dest}" is not allowed — push a feature branch and open a PR.`);
            }
            if (refspecs.length === 0 && branch && PROTECTED_BRANCHES.has(branch)) {
                block(`you are on "${branch}"; push a feature branch and open a PR instead.`);
            }
        }
        if (verb === 'commit' && branch && PROTECTED_BRANCHES.has(branch)) {
            block(`committing directly on "${branch}" is not allowed — create feature/<KEY>-short-name first.`);
        }
        if (verb === 'reset' && rest.includes('--hard')) block('git reset --hard discards work and is not allowed.');
        if (verb === 'clean' && rest.some((t) => /^-[a-z]*f/i.test(t))) block('git clean -f deletes files and is not allowed.');
        if (verb === 'branch' && rest.some((t) => t === '-D' || t === '--delete' || t === '-d')) {
            const names = rest.filter((t) => !t.startsWith('-'));
            if (rest.includes('-D') || names.some((n) => PROTECTED_BRANCHES.has(n))) block('force-deleting branches is not allowed.');
        }
        if ((verb === 'checkout' || verb === 'restore') && rest.includes('--') && rest.includes('.')) {
            block('discarding all working-tree changes is not allowed.');
        }
        if (verb === 'rm' && rest.filter((t) => !t.startsWith('-')).some(isProtectedPath)) {
            block('deleting project files is not allowed — write the removal into the story plan for an architect.');
        }
        continue;
    }

    // ------------------------------------------------ file deletion
    const deleters = new Set(['rm', 'rmdir', 'del', 'erase', 'rd', 'remove-item', 'ri', 'unlink', 'shred']);
    if (deleters.has(exe)) {
        const paths = args.filter((t) => !t.startsWith('-') && !/^\/[a-z]$/i.test(t));
        if (paths.some(isProtectedPath)) {
            block('deleting files in the Salesforce project or Claude/CI config is not allowed — removals go into the story plan for an architect.');
        }
        const recursive = args.some((t) => /^-[a-z]*r/i.test(t) || /^-recurse$/i.test(t) || /^\/s$/i.test(t));
        if (recursive && paths.some((p) => projectPath(p).inside)) block('recursive deletes inside the project are not allowed.');
    }
}

process.exit(0);
