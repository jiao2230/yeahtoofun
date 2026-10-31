import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const candidates = [
  resolve('node_modules/typescript/bin/tsc'),
  resolve('../xiuxian/node_modules/typescript/bin/tsc'),
];
const tsc = candidates.find((path) => existsSync(path));
if (!tsc) {
  console.error('TypeScript not found. Run: npm install --no-save typescript');
  process.exit(1);
}
const result = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--noEmit'], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
