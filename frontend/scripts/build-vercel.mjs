import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { deploymentConfig } from './deployment-config.mjs';

const config = deploymentConfig(process.env.BACKEND_ORIGIN);
const output = new URL('../.vercel/output/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('../dist/', import.meta.url), new URL('static/', output), {
  recursive: true,
});
await writeFile(
  new URL('config.json', output),
  JSON.stringify(config, null, 2) + '\n',
);
console.log('Vercel static output and same-origin API routing prepared.');
