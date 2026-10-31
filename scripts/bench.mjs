import { loadSeedPack } from '../src/core/data.ts';
import { generateBatch } from '../src/core/generator.ts';

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? Number(args[index + 1]) : fallback;
};

const iterations = Math.max(1, Math.trunc(value('iterations', 20)));
const count = Math.max(1, Math.trunc(value('count', 1000)));
const seed = value('seed', 1);
const pack = loadSeedPack();

// Warm up caches (type maps, char index) before recording RSS.
generateBatch({ count: 100, seed }, pack);
if (global.gc) global.gc();

const before = process.memoryUsage();
const started = performance.now();
let last = [];
for (let i = 0; i < iterations; i++) {
  last = generateBatch({ count, seed: seed + i }, pack);
}
const elapsed = performance.now() - started;
if (global.gc) global.gc();
const after = process.memoryUsage();

console.log(
  JSON.stringify(
    {
      pack: `${pack.id}@${pack.version}`,
      iterations,
      count,
      total: iterations * count,
      elapsedMs: Math.round(elapsed),
      msPerName: Number((elapsed / (iterations * count)).toFixed(3)),
      uniqueLastBatch: new Set(last.map((p) => p.fullName)).size,
      rssBeforeMB: Number((before.rss / 1024 / 1024).toFixed(1)),
      rssAfterMB: Number((after.rss / 1024 / 1024).toFixed(1)),
      rssGrowthMB: Number(((after.rss - before.rss) / 1024 / 1024).toFixed(1)),
      heapGrowthMB: Number(((after.heapUsed - before.heapUsed) / 1024 / 1024).toFixed(1)),
    },
    null,
    2,
  ),
);
