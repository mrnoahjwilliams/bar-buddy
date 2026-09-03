import { resolve } from 'node:path';
import { defineConfig } from 'orval';

// The pipeline supplies a temporary workspace with the same relative layout.
const workspace = process.env.BAR_BUDDY_API_WORKSPACE;
if (!workspace)
  throw new Error('Use npm run api:generate or npm run api:check.');

export default defineConfig({
  barBuddy: {
    input: '../backend/target/openapi/openapi.json',
    output: {
      target: resolve(workspace, 'generated/bar-buddy.ts'),
      schemas: resolve(workspace, 'generated/models'),
      client: 'react-query',
      httpClient: 'fetch',
      mode: 'split',
      formatter: 'prettier',
      packageJson: './package.json',
      tsconfig: './tsconfig.json',
      baseUrl: '',
      override: {
        mutator: { path: resolve(workspace, 'http.ts'), name: 'apiFetch' },
        fetch: { includeHttpResponseReturnType: false },
        query: { signal: true },
      },
    },
  },
});
