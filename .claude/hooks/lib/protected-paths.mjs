/**
 * Single source of truth for which Salesforce files are framework-owned or shared.
 * Used by guard-sf-command, guard-protected-files and the sf-deploy skill.
 *
 * The Salesforce project structure is fixed: everything lives in force-app/main/default.
 * Ownership is therefore by FILE NAME, not by folder.
 */
export const SF_ROOT = 'force-app/main/default';

// ---- framework (architect-owned): Trigger, Exception, Integration frameworks
const FRAMEWORK_CLASSES = [
    'TriggerHandler', 'TriggerHandlerTest',
    'AppLogger', 'AppLoggerTest', 'ErrorLogEventSubscriber',
    'ApplicationException', 'ValidationException', 'IntegrationException'
];
const FRAMEWORK_CLASS_PREFIXES = ['Integration']; // future Integration framework: IntegrationClient, IntegrationRequest…
const FRAMEWORK_TRIGGERS = ['ErrorLogEventTrigger'];
const FRAMEWORK_OBJECTS = ['Error_Log__c', 'Error_Log_Event__e', 'Trigger_Setting__mdt', 'Integration_Setting__mdt'];
const FRAMEWORK_PERMSETS = ['Application_Logger', 'Error_Log_Admin', 'Trigger_Bypass'];
const FRAMEWORK_CUSTOM_PERMISSIONS = ['Bypass_All_Triggers'];
const FRAMEWORK_TABS = ['Error_Log__c'];

// ---- shared (used by several modules): Account data model and Account UI
const SHARED_PATTERNS = [
    /^objects\/Account\/Account\.object-meta\.xml$/,
    /^objects\/Account\/recordTypes\//,
    /^objects\/Account\/fields\/(Account_Status__c|Email__c)\.field-meta\.xml$/,
    /^layouts\/Account-/,
    /^flexipages\/Account_Record_Page\./,
    /^pathAssistants\//,
    /^settings\//,
    /^classes\/AccountTriggerHandler\.cls(-meta\.xml)?$/,
    /^triggers\/AccountTrigger\.trigger(-meta\.xml)?$/
];

const isFrameworkClass = (name) =>
    FRAMEWORK_CLASSES.includes(name) || FRAMEWORK_CLASS_PREFIXES.some((p) => name.startsWith(p) && /^[A-Z]/.test(name.slice(p.length)));

/**
 * @param {string} rel path relative to the project root, forward slashes
 * @returns {'framework'|'shared'|null}
 */
export function classify(rel) {
    if (!rel.startsWith(SF_ROOT + '/')) return null;
    const p = rel.slice(SF_ROOT.length + 1);
    let m;
    if ((m = p.match(/^classes\/([A-Za-z0-9_]+)\.cls(-meta\.xml)?$/)) && isFrameworkClass(m[1])) return 'framework';
    if ((m = p.match(/^triggers\/([A-Za-z0-9_]+)\.trigger(-meta\.xml)?$/)) && FRAMEWORK_TRIGGERS.includes(m[1])) return 'framework';
    if ((m = p.match(/^objects\/([A-Za-z0-9_]+)(\/|$)/)) && FRAMEWORK_OBJECTS.includes(m[1])) return 'framework';
    if ((m = p.match(/^permissionsets\/([A-Za-z0-9_]+)\./)) && FRAMEWORK_PERMSETS.includes(m[1])) return 'framework';
    if ((m = p.match(/^customPermissions\/([A-Za-z0-9_]+)\./)) && FRAMEWORK_CUSTOM_PERMISSIONS.includes(m[1])) return 'framework';
    if ((m = p.match(/^tabs\/([A-Za-z0-9_]+)\./)) && FRAMEWORK_TABS.includes(m[1])) return 'framework';
    if (SHARED_PATTERNS.some((re) => re.test(p))) return 'shared';
    return null;
}

/** A deploy target that would sweep in framework components (the project root, force-app, a metadata-type folder that holds framework files, or a framework file/folder). */
export function deployTargetProblem(rel) {
    const clean = rel.replace(/\/+$/, '');
    if (clean === '' || clean === '.' || clean === 'force-app' || clean === 'force-app/main' || clean === SF_ROOT) {
        return 'deploys the whole project; name the story\'s components (--metadata, files, or a story manifest)';
    }
    if (clean.startsWith(SF_ROOT + '/')) {
        const p = clean.slice(SF_ROOT.length + 1);
        if (['classes', 'triggers', 'objects', 'permissionsets', 'customPermissions', 'tabs'].includes(p)) {
            return `deploys every file in ${p}/ including framework components; name the story's files instead`;
        }
        if (classify(clean) === 'framework') return 'is a framework component (architect-owned; deployed after PR review)';
    }
    return null;
}

/** "ApexClass:AppLogger" style names that belong to the frameworks. */
export function isFrameworkMetadata(spec) {
    const [type, rawName = ''] = spec.split(':');
    const name = rawName.split('.')[0];
    switch ((type || '').toLowerCase()) {
        case 'apexclass': return name === '*' || isFrameworkClass(name);
        case 'apextrigger': return name === '*' || FRAMEWORK_TRIGGERS.includes(name);
        case 'customobject': return name === '*' || FRAMEWORK_OBJECTS.includes(name);
        case 'customfield': return FRAMEWORK_OBJECTS.includes(name);
        case 'permissionset': return name === '*' || FRAMEWORK_PERMSETS.includes(name);
        case 'custompermission': return name === '*' || FRAMEWORK_CUSTOM_PERMISSIONS.includes(name);
        case 'customtab': return FRAMEWORK_TABS.includes(name);
        default: return false;
    }
}

/** All member names a package.xml would deploy, checked against the framework lists. */
export function manifestFrameworkMembers(xml) {
    const hits = [];
    for (const typeBlock of xml.match(/<types>[\s\S]*?<\/types>/g) || []) {
        const type = (typeBlock.match(/<name>([^<]+)<\/name>/) || [])[1] || '';
        for (const [, member] of typeBlock.matchAll(/<members>([^<]+)<\/members>/g)) {
            if (isFrameworkMetadata(`${type}:${member.trim()}`)) hits.push(`${type}:${member.trim()}`);
        }
    }
    return hits;
}
