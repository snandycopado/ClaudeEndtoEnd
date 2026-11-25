#!/usr/bin/env node
/**
 * Phase 1 gate: proves the guard hooks block destructive commands and deploys to other orgs.
 * Run:  node .claude/hooks/tests/run-guard-tests.mjs
 * Feeds each case to the hook exactly as Claude Code does (JSON on stdin) and checks the decision.
 * Assumes .claude/allowed-orgs contains `esm-dev` (CI writes a temporary one).
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const hooksDir = dirname(dirname(fileURLToPath(import.meta.url)));
const projectDir = dirname(dirname(hooksDir));
const tmp = mkdtempSync(join(tmpdir(), 'guard-tests-'));
const deletingApex = join(tmp, 'deleting.apex');
const safeApex = join(tmp, 'safe.apex');
writeFileSync(deletingApex, 'List<Account> a = [SELECT Id FROM Account];\ndelete a;\n');
writeFileSync(safeApex, '// delete in a comment is fine\nSystem.debug([SELECT COUNT() FROM Account]);\n');

// story manifests are read by the hook, so create them in a throw-away folder inside the project path
const manifestDir = join(projectDir, '.claude', 'docs', 'stories', 'manifests');
mkdirSync(manifestDir, { recursive: true });
const goodManifest = join(tmp, 'ONB-999.xml'); // outside the allowed folder on purpose for one case
const pkg = (members) =>
    `<?xml version="1.0"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types>${members}<name>ApexClass</name></types><version>67.0</version></Package>`;
writeFileSync(goodManifest, pkg('<members>OnboardingService</members>'));
const storyManifest = join(manifestDir, '_guard-test-ok.xml');
const frameworkManifest = join(manifestDir, '_guard-test-framework.xml');
writeFileSync(storyManifest, pkg('<members>OnboardingService</members>'));
writeFileSync(frameworkManifest, pkg('<members>OnboardingService</members><members>AppLogger</members>'));

const SF = 'force-app/main/default';
const bash = (command) => ({ tool_name: 'Bash', tool_input: { command }, cwd: projectDir });
const ps = (command) => ({ tool_name: 'PowerShell', tool_input: { command }, cwd: projectDir });
const edit = (rel) => ({ tool_name: 'Edit', tool_input: { file_path: join(projectDir, rel) }, cwd: projectDir });

// [description, hook, input, expected: 'block' | 'allow' | 'ask']
const cases = [
    // --- destructive sf commands
    ['sf org delete', 'sf', bash('sf org delete scratch --target-org esm-dev --no-prompt'), 'block'],
    ['sf project delete source', 'sf', bash('sf project delete source --metadata ApexClass:OnboardingService --target-org esm-dev'), 'block'],
    ['sf data delete record', 'sf', bash('sf data delete record --sobject Account --record-id 001xx --target-org esm-dev'), 'block'],
    ['sf data update record', 'sf', bash('sf data update record --sobject Account --record-id 001xx --values "Name=X" --target-org esm-dev'), 'block'],
    ['sf org login', 'sf', bash('sf org login web --alias prod'), 'block'],
    ['post-destructive-changes deploy', 'sf', bash(`sf project deploy start --source-dir ${SF}/lwc/onboardingTaskTracker --post-destructive-changes manifest/destructiveChanges.xml --target-org esm-dev`), 'block'],
    ['purge-on-delete', 'sf', bash('sf project deploy start --metadata ApexClass:OnboardingService --purge-on-delete --target-org esm-dev'), 'block'],
    // --- prod / other orgs
    ['deploy to another org (prod)', 'sf', bash(`sf project deploy start --source-dir ${SF}/lwc/onboardingTaskTracker --target-org prod`), 'block'],
    ['deploy to trainingdemo via -o', 'sf', bash('sf project deploy start -m ApexClass:OnboardingService -o trainingdemo'), 'block'],
    ['deploy hidden after &&', 'sf', bash('git status && sf project deploy start -m ApexClass:OnboardingService --target-org=agentforce'), 'block'],
    ['deploy hidden in bash heredoc', 'sf', bash('bash <<EOF\nsf project deploy start -m ApexClass:X --target-org prod\nEOF'), 'block'],
    ['deploy without --target-org', 'sf', bash('sf project deploy start --metadata ApexClass:OnboardingService'), 'block'],
    ['PowerShell deploy to other org', 'sf', ps('Set-Location C:\\x; sf project deploy start --metadata ApexClass:OnboardingService --target-org prod'), 'block'],
    ['change default org', 'sf', bash('sf config set target-org=prod'), 'block'],
    // --- deploy scope / framework
    ['deploy whole force-app', 'sf', bash('sf project deploy start --source-dir force-app --target-org esm-dev'), 'block'],
    ['deploy whole project', 'sf', bash('sf project deploy start --source-dir . --target-org esm-dev'), 'block'],
    ['deploy the whole classes folder', 'sf', bash(`sf project deploy start --source-dir ${SF}/classes --target-org esm-dev`), 'block'],
    ['deploy framework class file', 'sf', bash(`sf project deploy start --source-dir ${SF}/classes/TriggerHandler.cls --target-org esm-dev`), 'block'],
    ['deploy framework object folder', 'sf', bash(`sf project deploy start --source-dir ${SF}/objects/Error_Log__c --target-org esm-dev`), 'block'],
    ['deploy framework via --metadata', 'sf', bash('sf project deploy start --metadata ApexClass:AppLogger --target-org esm-dev'), 'block'],
    ['deploy all classes via --metadata', 'sf', bash('sf project deploy start --metadata "ApexClass:*" --target-org esm-dev'), 'block'],
    ['deploy without scope', 'sf', bash('sf project deploy start --target-org esm-dev'), 'block'],
    ['manifest outside story folder', 'sf', bash('sf project deploy start --manifest manifest/package.xml --target-org esm-dev'), 'block'],
    ['manifest in temp folder', 'sf', bash(`sf project deploy start --manifest "${goodManifest}" --target-org esm-dev`), 'block'],
    ['story manifest with framework class', 'sf', bash(`sf project deploy start --manifest "${frameworkManifest}" --target-org esm-dev`), 'block'],
    // --- anonymous Apex
    ['anonymous Apex with delete', 'sf', bash(`sf apex run --file "${deletingApex}" --target-org esm-dev`), 'block'],
    ['anonymous Apex from stdin', 'sf', bash('echo "delete [SELECT Id FROM Account];" | sf apex run --target-org esm-dev'), 'block'],
    // --- git
    ['git push --force', 'sf', bash('git push --force origin feature/x'), 'block'],
    ['git push -f', 'sf', bash('git push -f'), 'block'],
    ['git push to main', 'sf', bash('git push origin main'), 'block'],
    ['git push HEAD:develop', 'sf', bash('git push origin HEAD:develop'), 'block'],
    ['git reset --hard', 'sf', bash('git reset --hard HEAD~1'), 'block'],
    ['git clean -fd', 'sf', bash('git clean -fd'), 'block'],
    ['git rm metadata', 'sf', bash(`git rm ${SF}/classes/OnboardingService.cls`), 'block'],
    // --- file deletion
    ['rm a metadata file', 'sf', bash(`rm ${SF}/classes/LcmNotificationService.cls`), 'block'],
    ['rm -rf force-app', 'sf', bash('rm -rf force-app'), 'block'],
    ['Remove-Item a class', 'sf', ps(`Remove-Item -Force ${SF.replace(/\//g, '\\')}\\classes\\AppLogger.cls`), 'block'],
    ['delete the Claude guards', 'sf', bash('rm .claude/settings.json'), 'block'],
    // --- protected files
    ['edit sfdx-project.json', 'files', edit('sfdx-project.json'), 'block'],
    ['edit .forceignore', 'files', edit('.forceignore'), 'block'],
    ['create a new package folder', 'files', edit('force-app/onboarding/main/default/classes/X.cls'), 'block'],
    ['edit a profile', 'files', edit(`${SF}/profiles/Admin.profile-meta.xml`), 'block'],
    ['edit dsfs__ component', 'files', edit(`${SF}/objects/dsfs__DocuSign_Status__c/fields/x.field-meta.xml`), 'block'],
    ['write destructiveChanges', 'files', edit('manifest/destructiveChanges.xml'), 'block'],
    ['edit .claude/settings.json', 'files', edit('.claude/settings.json'), 'block'],
    ['edit a guard hook', 'files', edit('.claude/hooks/guard-sf-command.mjs'), 'block'],
    ['edit CI workflow', 'files', edit('.github/workflows/pr-validation.yml'), 'block'],
    ['edit TriggerHandler (framework)', 'files', edit(`${SF}/classes/TriggerHandler.cls`), 'ask'],
    ['edit AppLogger (framework)', 'files', edit(`${SF}/classes/AppLogger.cls`), 'ask'],
    ['edit Error_Log__c field (framework)', 'files', edit(`${SF}/objects/Error_Log__c/fields/Message__c.field-meta.xml`), 'ask'],
    ['new Integration framework class', 'files', edit(`${SF}/classes/IntegrationClient.cls`), 'ask'],
    ['edit Account layout (shared)', 'files', edit(`${SF}/layouts/Account-Account Layout.layout-meta.xml`), 'ask'],
    ['edit Account record page (shared)', 'files', edit(`${SF}/flexipages/Account_Record_Page.flexipage-meta.xml`), 'ask'],
    ['edit AccountTriggerHandler (shared)', 'files', edit(`${SF}/classes/AccountTriggerHandler.cls`), 'ask'],
    // --- things that must keep working
    ['commit message mentioning destructiveChanges', 'sf', bash("git commit -q -F - <<'EOF'\nCI: block destructiveChanges and --purge-on-delete\nEOF"), 'allow'],
    ['dry-run deploy of story files', 'sf', bash(`sf project deploy start --dry-run --source-dir ${SF}/classes/OnboardingService.cls --source-dir ${SF}/lwc/onboardingTaskTracker --target-org esm-dev --test-level RunLocalTests`), 'allow'],
    ['deploy module via --metadata', 'sf', ps('sf project deploy start --metadata ApexClass:LcmNotificationService --metadata LightningComponentBundle:lcmVendorNotifier --target-org esm-dev --wait 30'), 'allow'],
    ['deploy story manifest', 'sf', bash(`sf project deploy start --manifest "${storyManifest}" --target-org esm-dev`), 'allow'],
    ['run apex tests', 'sf', bash('sf apex run test --class-names OnboardingServiceTest --target-org esm-dev --result-format human'), 'allow'],
    ['safe anonymous Apex', 'sf', bash(`sf apex run --file "${safeApex}" --target-org esm-dev`), 'allow'],
    ['read-only query', 'sf', bash('sf data query -q "SELECT Id FROM Account" --target-org esm-dev'), 'allow'],
    ['git push feature branch', 'sf', bash('git push -u origin feature/ONB-001-new-field'), 'allow'],
    ['git status / diff', 'sf', bash('git status && git diff --stat'), 'allow'],
    ['delete a scratch file outside the repo', 'sf', bash(`rm -rf "${tmp}/old"`), 'allow'],
    ['edit a module class', 'files', edit(`${SF}/classes/OnboardingService.cls`), 'allow'],
    ['create a module LWC', 'files', edit(`${SF}/lwc/offboardingChecklist/offboardingChecklist.js`), 'allow'],
    ['edit a story plan', 'files', edit('.claude/docs/stories/ONB-001.md'), 'allow'],
    ['edit a module rule', 'files', edit('.claude/rules/modules/onboarding.md'), 'allow']
];

const hooks = { sf: join(hooksDir, 'guard-sf-command.mjs'), files: join(hooksDir, 'guard-protected-files.mjs') };

let failures = 0;
const rows = [];
for (const [name, hook, input, expected] of cases) {
    const res = spawnSync(process.execPath, [hooks[hook]], {
        input: JSON.stringify(input),
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
        encoding: 'utf8'
    });
    let actual = 'allow';
    if (res.status === 2) actual = 'block';
    else if (res.status === 0 && res.stdout.includes('"permissionDecision":"ask"')) actual = 'ask';
    else if (res.status !== 0) actual = `exit ${res.status}: ${res.stderr.split('\n')[0]}`;
    const ok = actual === expected;
    if (!ok) failures++;
    const reason = (res.stderr.split('\n')[0] || '').replace(/^BLOCKED by \.claude\/hooks\/[a-z-]+: /, '');
    rows.push(`${ok ? 'PASS' : 'FAIL'}  ${expected.padEnd(5)} ${actual.padEnd(5)}  ${name}${actual === 'block' ? '  — ' + reason.slice(0, 85) : ''}`);
}

for (const f of [storyManifest, frameworkManifest]) rmSync(f, { force: true });

console.log('RESULT expect got    case');
console.log(rows.join('\n'));
console.log(`\n${cases.length - failures}/${cases.length} passed`);
process.exit(failures ? 1 : 0);
