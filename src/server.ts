import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { loadSeedPack } from './core/data.ts';
import { checkName } from './core/check.ts';
import { generateArtifacts } from './core/artifact.ts';
import { generateSects, sectParts } from './core/sect.ts';
import { generatePills, pillParts } from './core/pill.ts';
import { generateTechniques, techniqueParts } from './core/technique.ts';
import { generateBatch } from './core/generator.ts';
import { openapi } from './openapi.ts';
import type {
  PillKind,
  PillSuffixText,
  Profile,
  TechniqueKind,
  TechniqueSuffixText,
} from './core/types.ts';

const ERAS = ['qinhan', 'weijin', 'tangsong', 'mingqing', 'xianxia'];
const GENDERS = ['male', 'female', 'any'];
const STYLES = ['史实', '写意', '宗教'];
const CLASSES = ['俗人', '雅士'];

export interface ServerOptions {
  port?: number;
  host?: string;
  allowLan?: boolean;
  token?: string;
}

class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function startServer(options: ServerOptions = {}): Server {
  const port = options.port ?? 5178;
  const allowLan = options.allowLan ?? false;
  const token = options.token?.trim() || undefined;
  let host = options.host ?? (allowLan ? '0.0.0.0' : '127.0.0.1');
  if (host === '0.0.0.0' && !allowLan) {
    throw new Error('E_LAN_FORBIDDEN: 绑定 0.0.0.0 需要显式 --allow-lan');
  }
  if (allowLan && !token) {
    throw new Error('E_TOKEN_REQUIRED: --allow-lan 需要同时设置 --token');
  }
  if (allowLan && host === '127.0.0.1') host = '0.0.0.0';

  const pack = loadSeedPack();
  const webIndex = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const webSdk = readFileSync(new URL('../web/minglu-sdk.js', import.meta.url), 'utf8');

  const server = createServer(async (req, res) => {
    const started = Date.now();
    setCors(req, res);
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${host}:${port}`}`);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        });
        res.end(webIndex);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/minglu-sdk.js') {
        res.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
          'cache-control': 'no-store',
        });
        res.end(webSdk);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/health') {
        json(res, 200, { ok: true, data: { status: 'ok', pack: `${pack.id}@${pack.version}` } });
        return;
      }

      if (token && !authorized(req, token) && (url.pathname.startsWith('/v1/') || url.pathname === '/openapi.json')) {
        throw new HttpError(401, 'E_UNAUTHORIZED', '需要 Authorization: Bearer <token>');
      }

      if (req.method === 'GET' && url.pathname === '/openapi.json') {
        json(res, 200, openapi);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/profiles') {
        json(res, 200, {
          ok: true,
          data: { eras: ERAS, genders: GENDERS, styles: STYLES, classes: CLASSES },
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/generations') {
        json(res, 200, { ok: true, data: pack.generations });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/packs') {
        json(res, 200, {
          ok: true,
          data: [{ id: pack.id, version: pack.version, license: pack.license }],
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/pack') {
        json(res, 200, {
          ok: true,
          data: pack,
          meta: { pack: `${pack.id}@${pack.version}`, license: pack.license },
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/artifact-parts') {
        json(res, 200, { ok: true, data: pack.artifacts });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/sect-parts') {
        json(res, 200, { ok: true, data: sectParts(pack) });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/pill-parts') {
        json(res, 200, { ok: true, data: pillParts(pack) });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/technique-parts') {
        json(res, 200, { ok: true, data: techniqueParts(pack) });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/techniques') {
        const body = await readJson(req);
        const count = clampCount(body.count, 1, 10_000);
        const techniques = generateTechniques(
          {
            count,
            seed: valueSeed(body.seed),
            kind: (body.kind === undefined ? 'any' : String(body.kind)) as TechniqueKind | 'any',
            suffix: (body.suffix === undefined
              ? 'any'
              : String(body.suffix)) as TechniqueSuffixText | 'any',
          },
          pack,
        );
        json(res, 200, {
          ok: true,
          data: techniques,
          meta: metaFor(pack, count, techniques.length, Date.now() - started),
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/pills') {
        const body = await readJson(req);
        const count = clampCount(body.count, 1, 10_000);
        const pills = generatePills(
          {
            count,
            seed: valueSeed(body.seed),
            kind: (body.kind === undefined ? 'any' : String(body.kind)) as PillKind | 'any',
            suffix: (body.suffix === undefined
              ? 'any'
              : String(body.suffix)) as PillSuffixText | 'any',
            mode: (body.mode === undefined
              ? 'any'
              : String(body.mode)) as 'function' | 'high' | 'poison' | 'any',
          },
          pack,
        );
        json(res, 200, {
          ok: true,
          data: pills,
          meta: metaFor(pack, count, pills.length, Date.now() - started),
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/sects') {
        const body = await readJson(req);
        const count = clampCount(body.count, 1, 10_000);
        const alignment = body.alignment === undefined ? 'any' : String(body.alignment);
        const sects = generateSects(
          {
            count,
            seed: valueSeed(body.seed),
            alignment: alignment as '正道' | '魔道' | '中立' | 'any',
          },
          pack,
        );
        json(res, 200, {
          ok: true,
          data: sects,
          meta: metaFor(pack, count, sects.length, Date.now() - started),
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/artifacts') {
        const body = await readJson(req);
        const count = clampCount(body.count, 1, 10_000);
        const artifacts = generateArtifacts({ count, seed: valueSeed(body.seed) }, pack);
        json(res, 200, {
          ok: true,
          data: artifacts,
          meta: metaFor(pack, count, artifacts.length, Date.now() - started),
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/names') {
        const body = await readJson(req);
        const profile = (body.profile ?? body) as Profile;
        const count = clampCount(body.count ?? profile.count, 0, 1000);
        const people = generateBatch({ ...profile, count }, pack);
        json(res, 200, {
          ok: true,
          data: people,
          meta: metaFor(pack, count, people.length, Date.now() - started),
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/batch') {
        const body = await readJson(req);
        const profile = (body.profile ?? body) as Profile;
        const count = clampCount(body.count ?? profile.count ?? 1000, 0, 100_000);
        const people = generateBatch({ ...profile, count }, pack);
        res.writeHead(200, {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'cache-control': 'no-store',
          'x-accel-buffering': 'no',
        });
        for (const person of people) res.write(`${JSON.stringify(person)}\n`);
        res.end();
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/names/check') {
        const body = await readJson(req);
        const name = String(body.name ?? '');
        json(res, 200, { ok: true, data: checkName(name, pack) });
        return;
      }
      throw new HttpError(404, 'E_NOT_FOUND', 'unknown route');
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (error instanceof HttpError) {
        json(res, error.status, { ok: false, error: { code: error.code, message: error.message } });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const code = message.startsWith('E_') ? message.split(':')[0]!.trim() : 'E_REQUEST_INVALID';
      const cleanMessage =
        message.startsWith('E_') && message.includes(': ')
          ? message.slice(message.indexOf(': ') + 2)
          : message;
      json(res, 400, { ok: false, error: { code, message: cleanMessage } });
    }
  });

  server.listen(port, host, () => {
    console.log(`名箓本地服务：http://${host}:${port}`);
    console.log(`pack: ${pack.id}@${pack.version} (${pack.license})`);
    if (token) console.log('token: 已启用（Authorization: Bearer <token>）');
    console.log('按 Ctrl+C 退出。');
  });
  return server;
}

function metaFor(pack: { id: string; version: string; license: string }, count: number, actual: number, elapsedMs: number) {
  return {
    count: actual,
    requested: count,
    pack: `${pack.id}@${pack.version}`,
    license: pack.license,
    elapsedMs,
    disclaimer: 'Names are fictional and may coincide with real persons.',
  };
}

function clampCount(value: unknown, fallback: number, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.min(max, Math.max(0, number));
}

function valueSeed(value: unknown): number | string | undefined {
  return typeof value === 'number' || typeof value === 'string' ? value : undefined;
}

function authorized(req: IncomingMessage, token: string): boolean {
  const header = req.headers.authorization ?? '';
  if (header === `Bearer ${token}`) return true;
  return req.headers['x-minglu-token'] === token;
}

function setCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (!origin) return;
  try {
    const host = new URL(origin).hostname;
    if (host === '127.0.0.1' || host === 'localhost') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-minglu-token');
    }
  } catch {
    // ignore malformed origin
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new HttpError(413, 'E_LIMIT_EXCEEDED', 'body > 1MB');
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'E_JSON_INVALID', 'body is not valid JSON');
  }
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}
