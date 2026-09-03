import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const artifactPaths = ['contracts', 'frontend/src/api/generated'];

export async function readArtifacts(root, paths = artifactPaths) {
  const files = new Map();
  async function visit(path) {
    let entries;
    try {
      entries = await readdir(join(root, path), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const name = `${path}/${entry.name}`;
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile())
        files.set(name, await readFile(join(root, name)));
      else
        throw new Error(`Generated artifact must be a regular file: ${name}`);
    }
  }
  for (const path of paths) await visit(path);
  return files;
}

export async function checkArtifacts(root, expected) {
  const actual = await readArtifacts(root);
  const tracked = new Set(
    execFileSync('git', ['ls-files', '-z', '--', ...artifactPaths], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean),
  );
  const failures = [];
  const unstaged = new Set(
    execFileSync('git', ['diff', '--name-only', '-z', '--', ...artifactPaths], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean),
  );
  for (const path of new Set([
    ...expected.keys(),
    ...actual.keys(),
    ...tracked,
  ])) {
    if (!expected.has(path)) failures.push(`Unexpected or obsolete: ${path}`);
    else {
      if (!actual.has(path)) failures.push(`Missing: ${path}`);
      else if (!expected.get(path).equals(actual.get(path)))
        failures.push(`Stale or modified: ${path}`);
      else if (unstaged.has(path)) failures.push(`Not staged: ${path}`);
      if (!tracked.has(path)) failures.push(`Untracked: ${path}`);
    }
  }
  return failures;
}
