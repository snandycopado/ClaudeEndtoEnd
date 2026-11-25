#!/usr/bin/env node
/**
 * Guarded deploy — only to the alias in .claude/allowed-orgs, and only the story's own components
 * (never the whole project, never framework components).
 *
 * Default (fast, the story workflow): one deploy with --test-level NoTestRun. The developer runs the tests.
 * The allowed org is a developer org/sandbox; NoTestRun is not allowed in production, which this script never targets.
 *
 *   node .claude/skills/sf-deploy/deploy.mjs --metadata ApexClass:OnboardingService --metadata LightningComponentBundle:onboardingTaskTracker
 *   node .claude/skills/sf-deploy/deploy.mjs --source-dir force-app/main/default/classes/OnboardingService.cls
 *   node .claude/skills/sf-deploy/deploy.mjs --manifest .claude/docs/stories/manifests/ONB-012.xml
 *   options (developer use):
 *     --validate        dry run first, deploy only if it passes
 *     --dry-run-only    dry run, no deploy (implies --validate)
 *     --tests A,B       RunSpecifiedTests;  --local-tests  RunLocalTests  (default: NoTestRun)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deployTargetProblem, isFrameworkMetadata, manifestFrameworkMembers } from '../../hooks/lib/protected-paths.mjs';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const argv = process.argv.slice(2);
const sourceDirs = [];
const metadata = [];
const manifests = [];
let tests = null;
let localTests = false;
let validate = false;
let dryRunOnly = false;

function fail(msg) {
    console.error(`sf-deploy: ${msg}`);
    process.exit(1);
}

for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source-dir') sourceDirs.push(argv[++i]);
    else if (a === '--metadata') metadata.push(argv[++i]);
    else if (a === '--manifest') manifests.push(argv[++i]);
    else if (a === '--tests') tests = argv[++i];
    else if (a === '--local-tests') localTests = true;
    else if (a === '--validate') validate = true;
    else if (a === '--dry-run-only') dryRunOnly = validate = true;
    else fail(`unknown argument ${a}`);
}

const allowFile = join(projectDir, '.claude', 'allowed-orgs');
if (!existsSync(allowFile)) fail('.claude/allowed-orgs is missing — create it with your developer org alias.');
const alias = readFileSync(allowFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
if (!alias) fail('.claude/allowed-orgs has no alias.');
if (sourceDirs.length + metadata.length + manifests.length === 0) fail('name the story\'s components: --metadata, --source-dir <file/folder> or --manifest.');

for (const dir of sourceDirs) {
    const rel = relative(projectDir, resolve(projectDir, dir)).replace(/\\/g, '/');
    if (rel.startsWith('..')) fail(`"${dir}" is outside the project.`);
    const problem = deployTargetProblem(rel);
    if (problem) fail(`"${dir}" ${problem}.`);
}
for (const spec of metadata) if (isFrameworkMetadata(spec)) fail(`"${spec}" is a framework component — deployed by an architect after PR review.`);
for (const m of manifests) {
    const rel = relative(projectDir, resolve(projectDir, m)).replace(/\\/g, '/');
    if (!rel.startsWith('.claude/docs/stories/manifests/')) fail(`manifest "${m}" must be in .claude/docs/stories/manifests/.`);
    const hits = manifestFrameworkMembers(readFileSync(resolve(projectDir, m), 'utf8'));
    if (hits.length) fail(`manifest "${m}" includes framework components: ${hits.join(', ')}.`);
}

function deploy(dryRun) {
    const args = ['project', 'deploy', 'start', '--target-org', alias, '--wait', '30', '--json'];
    sourceDirs.forEach((d) => args.push('--source-dir', d));
    metadata.forEach((m) => args.push('--metadata', m));
    manifests.forEach((m) => args.push('--manifest', m));
    if (tests) args.push('--test-level', 'RunSpecifiedTests', '--tests', ...tests.split(','));
    else if (localTests) args.push('--test-level', 'RunLocalTests');
    else args.push('--test-level', 'NoTestRun');
    if (dryRun) args.push('--dry-run');

    console.log(`\n> sf ${args.join(' ')}`);
    const quoted = args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
    const res = spawnSync('sf', process.platform === 'win32' ? quoted : args, {
        cwd: projectDir,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        maxBuffer: 64 * 1024 * 1024
    });
    let json;
    try {
        json = JSON.parse(res.stdout);
    } catch {
        console.error(res.stdout || res.stderr);
        fail('could not parse sf output.');
    }
    const r = json.result || {};
    const d = r.details || {};
    console.log(
        `${dryRun ? 'DRY RUN' : 'DEPLOY'}: ${r.status ?? json.message}  components ${r.numberComponentsDeployed ?? 0}/${r.numberComponentsTotal ?? 0}` +
            `  tests ${r.numberTestsCompleted ?? 0} passed, ${r.numberTestErrors ?? 0} failed  (job ${r.id ?? '-'})`
    );
    [].concat(d.componentFailures || []).forEach((f) => console.log(`  COMPONENT ${f.componentType} ${f.fullName}: ${f.problem}`));
    [].concat(d.runTestResult?.failures || []).forEach((f) => console.log(`  TEST ${f.name}.${f.methodName}: ${f.message}`));
    return r.status === 'Succeeded';
}

if (validate && !deploy(true)) fail('dry run failed — nothing was deployed. Use the deploy-validator subagent with the job id above.');
if (dryRunOnly) process.exit(0);
if (!deploy(false)) fail('deploy failed. Use the deploy-validator subagent with the job id above.');
console.log(`\nDeployed to ${alias}.`);
