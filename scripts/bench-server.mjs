import { startServer } from '../src/server.ts';

const port = 5199;
const server = startServer({ port });
const base = `http://127.0.0.1:${port}`;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('server did not start');
}

await waitForServer();
const body = {
  profile: { era: 'song', gender: 'male', class: '士族', style: ['雅正'] },
  count: 1000,
  seed: 42,
};
const response = await fetch(`${base}/v1/names`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const payload = await response.json();
const memory = process.memoryUsage();

console.log(
  JSON.stringify(
    {
      ok: payload.ok,
      count: payload.data?.length,
      rssMB: Number((memory.rss / 1024 / 1024).toFixed(1)),
      heapMB: Number((memory.heapUsed / 1024 / 1024).toFixed(1)),
    },
    null,
    2,
  ),
);
server.close();
