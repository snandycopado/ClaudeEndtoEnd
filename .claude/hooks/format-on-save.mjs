#!/usr/bin/env node
/**
 * PostToolUse: format the edited file with the project's Prettier (+ prettier-plugin-apex).
 * Never blocks and never fails the session: if Prettier is not installed (run `npm install`) it does nothing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const FORMATTABLE = new Set(['.cls', '.trigger', '.js', '.html', '.css', '.json', '.md', '.yml', '.yaml', '.xml']);

try {
    const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    const target = input?.tool_input?.file_path;
    if (!target) process.exit(0);

    const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    const abs = isAbsolute(target) ? target : resolve(projectDir, target);
    const rel = relative(projectDir, abs);
    if (rel.startsWith('..') || isAbsolute(rel)) process.exit(0);
    if (!FORMATTABLE.has(extname(abs).toLowerCase())) process.exit(0);

    const bin = join(projectDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prettier.cmd' : 'prettier');
    if (!existsSync(bin)) process.exit(0);

    spawnSync(bin, ['--write', '--log-level', 'warn', abs], { cwd: projectDir, shell: process.platform === 'win32', stdio: 'ignore', timeout: 20000 });
} catch {
    // formatting is best-effort
}
process.exit(0);
