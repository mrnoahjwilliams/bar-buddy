import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentConfig } from './deployment-config.mjs';

test('deployment refuses missing, insecure, or credential-bearing backend settings', () => {
  for (const origin of [
    undefined,
    '',
    'http://api.example.com',
    'https://user:secret@api.example.com',
    'https://api.example.com/path',
    'https://api.example.com?key=secret',
    'https://api.example.com/#fragment',
  ]) {
    assert.throws(() => deploymentConfig(origin), /BACKEND_ORIGIN/);
  }
});

test('private API routes terminate before filesystem and deep-link fallback', () => {
  const { routes } = deploymentConfig('https://api.example.com/');
  const apiIndex = routes.findIndex((route) =>
    route.dest?.startsWith('https:'),
  );
  const api = routes[apiIndex];
  for (const path of ['/api', '/api/v1/me', '/api/v1/inventory']) {
    const match = new RegExp(`^${api.src}$`).exec(path);
    assert.ok(match);
    assert.equal(
      api.dest.replace('$1', match[1] ?? ''),
      `https://api.example.com${path}`,
    );
  }
  assert.equal(api.continue, undefined);
  assert.equal(api.headers['Cache-Control'], 'private, no-store');
  assert.equal(api.headers['CDN-Cache-Control'], 'no-store');
  assert.ok(
    apiIndex < routes.findIndex((route) => route.handle === 'filesystem'),
  );
  const fallback = routes.at(-1);
  assert.equal(fallback.dest, '/index.html');
  assert.deepEqual(fallback.methods, ['GET', 'HEAD']);
});
