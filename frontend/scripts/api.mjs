import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  artifactPaths,
  checkArtifacts,
  readArtifacts,
} from './api-artifacts.mjs';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(frontend, '..');
const mode = process.argv[2];
if (!['generate', 'check'].includes(mode))
  throw new Error('Usage: node scripts/api.mjs <generate|check>');

const workspace = await mkdtemp(join(tmpdir(), 'bar-buddy-api-'));
try {
  const contract = join(root, 'backend/target/openapi/openapi.json');
  await rm(contract, { force: true });
  execFileSync(
    './mvnw',
    [
      '--batch-mode',
      '--no-transfer-progress',
      '-Dit.test=OpenApiGenerationIT',
      'clean',
      'verify',
    ],
    { cwd: join(root, 'backend'), stdio: 'inherit' },
  );
  // Copy only the adapter needed by Orval to preserve generated relative imports.
  const apiWorkspace = join(workspace, 'frontend/src/api');
  await mkdir(apiWorkspace, { recursive: true });
  await cp(join(frontend, 'src/api/http.ts'), join(apiWorkspace, 'http.ts'));
  await cp(
    join(frontend, '.prettierrc.json'),
    join(apiWorkspace, '.prettierrc.json'),
  );
  execFileSync(
    join(frontend, 'node_modules/.bin/orval'),
    ['--config', 'orval.config.ts'],
    {
      cwd: frontend,
      stdio: 'inherit',
      env: { ...process.env, BAR_BUDDY_API_WORKSPACE: apiWorkspace },
    },
  );
  await mkdir(join(workspace, 'contracts'), { recursive: true });
  await cp(contract, join(workspace, 'contracts/openapi.json'));
  const expected = await readArtifacts(workspace);
  if (!expected.has('frontend/src/api/generated/bar-buddy.ts'))
    throw new Error('Orval did not produce its client artifact.');

  if (mode === 'check') {
    const failures = await checkArtifacts(root, expected);
    if (failures.length) {
      throw new Error(
        `API artifact drift:\n${failures.join('\n')}\nRun npm run api:generate, review and stage the artifacts.`,
      );
    }
    console.log('API contract and client match generation and are tracked.');
  } else {
    // Replace only the generated trees, and only after both generators succeed.
    for (const path of artifactPaths)
      await rm(join(root, path), { recursive: true, force: true });
    for (const [path, contents] of expected) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), contents);
    }
    console.log(
      'Generated contracts/openapi.json and frontend/src/api/generated/.',
    );
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
