import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkArtifacts } from './api-artifacts.mjs';

test('drift detection covers content, missing files and Git tracking without repairing files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'bar-buddy-drift-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const contract = 'contracts/openapi.json';
  const client = 'frontend/src/api/generated/bar-buddy.ts';
  const expected = new Map([
    [contract, Buffer.from('{"paths":{}}\n')],
    [client, Buffer.from('export {};\n')],
  ]);
  for (const [path, content] of expected) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  const git = (...args) => execFileSync('git', args, { cwd: root });
  git('init', '--quiet');
  assert.deepEqual(await checkArtifacts(root, expected), [
    `Untracked: ${contract}`,
    `Untracked: ${client}`,
  ]);
  git('add', '.');
  assert.deepEqual(await checkArtifacts(root, expected), []);

  await writeFile(join(root, client), '// hand edit\n');
  assert.deepEqual(await checkArtifacts(root, expected), [
    `Stale or modified: ${client}`,
  ]);
  git('add', client);
  assert.deepEqual(await checkArtifacts(root, expected), [
    `Stale or modified: ${client}`,
  ]);
  await writeFile(join(root, client), expected.get(client));
  assert.deepEqual(await checkArtifacts(root, expected), [
    `Not staged: ${client}`,
  ]);
  git('add', client);

  await rm(join(root, contract));
  assert.deepEqual(await checkArtifacts(root, expected), [
    `Missing: ${contract}`,
  ]);
  await writeFile(join(root, contract), expected.get(contract));

  const changedContract = new Map(expected).set(
    contract,
    Buffer.from('{"paths":{"/new":{}}}'),
  );
  assert.deepEqual(await checkArtifacts(root, changedContract), [
    `Stale or modified: ${contract}`,
  ]);
  const removedOperation = new Map(expected);
  removedOperation.delete(client);
  assert.deepEqual(await checkArtifacts(root, removedOperation), [
    `Unexpected or obsolete: ${client}`,
  ]);

  const stray = 'frontend/src/api/generated/stray.ts';
  await writeFile(join(root, stray), '// unexpected\n');
  assert.deepEqual(await checkArtifacts(root, expected), [
    `Unexpected or obsolete: ${stray}`,
  ]);
  await writeFile(join(root, '.gitignore'), 'stray.ts\n');
  assert.deepEqual(await checkArtifacts(root, expected), [
    `Unexpected or obsolete: ${stray}`,
  ]);
  await rm(join(root, stray));
  await symlink(join(root, client), join(root, stray));
  await assert.rejects(
    checkArtifacts(root, expected),
    /must be a regular file/,
  );
});
