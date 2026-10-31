import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const platformPackage = `@esbuild/${process.platform}-${process.arch}`;
const binary = process.platform === 'win32' ? 'esbuild.exe' : 'esbuild';
const candidates = [
  resolve(`node_modules/${platformPackage}/${binary}`),
  resolve(`node_modules/${platformPackage}/bin/${binary}`),
  resolve(`../xiuxian/node_modules/${platformPackage}/${binary}`),
  resolve(`../xiuxian/node_modules/${platformPackage}/bin/${binary}`),
];
const bin = candidates.find((path) => existsSync(path));
if (!bin) {
  console.error('esbuild binary not found. Run: npm install --no-save esbuild');
  process.exit(1);
}

const result = spawnSync(
  bin,
  [
    'src/browser.ts',
    '--bundle',
    '--format=esm',
    '--platform=browser',
    '--target=es2022',
    '--outfile=web/minglu-sdk.js',
    '--log-level=info',
  ],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
