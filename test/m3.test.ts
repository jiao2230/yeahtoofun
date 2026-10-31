import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openapi } from '../src/openapi.ts';

function walk(node: unknown, visit: (value: Record<string, unknown>) => void): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  const value = node as Record<string, unknown>;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

function resolveRef(root: Record<string, unknown>, ref: string): unknown {
  assert.ok(ref.startsWith('#/'), `only local refs are supported: ${ref}`);
  let current: unknown = root;
  for (const segment of ref.slice(2).split('/')) {
    const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
    assert.ok(current && typeof current === 'object', `unresolved ref: ${ref}`);
    current = (current as Record<string, unknown>)[key];
  }
  assert.ok(current !== undefined, `unresolved ref: ${ref}`);
  return current;
}

test('OpenAPI document is 3.1 and has the M3 routes', () => {
  assert.equal(openapi.openapi, '3.1.0');
  for (const path of ['/v1/names', '/v1/batch', '/v1/pack', '/openapi.json', '/health']) {
    assert.ok(Object.hasOwn(openapi.paths, path), `missing ${path}`);
  }
});

test('every OpenAPI operation has responses', () => {
  for (const [path, item] of Object.entries(openapi.paths)) {
    for (const [method, operation] of Object.entries(item as Record<string, unknown>)) {
      const value = operation as Record<string, unknown>;
      assert.ok(value.responses && typeof value.responses === 'object', `${method} ${path}`);
    }
  }
});

test('all local OpenAPI $ref values resolve', () => {
  walk(openapi, (value) => {
    if (typeof value.$ref === 'string') {
      resolveRef(openapi as unknown as Record<string, unknown>, value.$ref);
    }
  });
});

test('surname and allusion are documented in Profile schema', () => {
  const profile = openapi.components.schemas.Profile;
  assert.ok(profile.properties.surname);
  assert.ok(profile.properties.allusion);
  assert.ok(String(profile.properties.surname.description).includes('汉字'));
});

test('core generator has no runtime network calls', () => {
  for (const file of [
    'src/core/generator.ts',
    'src/core/data.ts',
    'src/core/artifact.ts',
    'src/core/check.ts',
    'src/core/rng.ts',
    'src/core/manifest.ts',
  ]) {
    const source = readFileSync(file, 'utf8');
    assert.ok(!/from ['"]node:https?['"]/.test(source), `${file} imports http`);
    assert.ok(!/\bfetch\s*\(/.test(source), `${file} calls fetch`);
  }
});
