import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSeedPack } from '../src/core/data.ts';
import { generate, generateBatch, phoneticIssues, resolveProfile } from '../src/core/generator.ts';
import { generateArtifacts } from '../src/core/artifact.ts';
import { checkName } from '../src/core/check.ts';
import { createGenerator } from '../src/sdk.ts';

const pack = loadSeedPack();

test('same seed produces the same name', () => {
  const a = generate({ era: 'song', gender: 'male', seed: 42 }, pack);
  const b = generate({ era: 'song', gender: 'male', seed: 42 }, pack);
  assert.deepEqual(a, b);
});

test('output has no 号/artName field', () => {
  const person = generate({ seed: 1 }, pack);
  assert.equal('artName' in person, false);
  assert.equal(person.generation, null);
});

test('no courtesy/字 field is emitted', () => {
  const person = generate({ seed: 9 }, pack);
  assert.equal('courtesy' in person, false);
  assert.equal('zi' in person, false);
});

test('Ming imperial generation index 8 is 翊', () => {
  const person = generate({
    surname: '沈',
    generation: { preset: 'ming-imperial', index: 8, position: 'first' },
    seed: 3,
  }, pack);
  assert.equal(person.generation?.char, '翊');
  assert.equal(person.given[0]?.text, '翊');
  assert.equal(person.fullName.slice(0, 2), '沈翊');
});

test('generation index out of range throws', () => {
  assert.throws(() => generate({
    generation: { preset: 'generic-a', index: 99 },
    seed: 1,
  }, pack), /E_GENERATION_INDEX/);
});

test('generation can be placed second', () => {
  const person = generate({
    surname: '沈',
    generation: { preset: 'generic-a', index: 3, position: 'second' },
    seed: 4,
  }, pack);
  assert.equal(person.generation?.char, '承');
  assert.equal(person.given[1]?.text, '承');
});

test('generation applyTo mismatch skips 字辈', () => {
  const person = generate({
    gender: 'male',
    generation: { preset: 'generic-a', index: 3, applyTo: 'female' },
    seed: 4,
  }, pack);
  assert.equal(person.generation, null);
});

test('empty batch returns empty array', () => {
  assert.deepEqual(generateBatch({ count: 0, seed: 1 }, pack), []);
});

test('generation forces two-character given name', () => {
  assert.throws(() => generate({
    givenLength: 1,
    generation: { preset: 'generic-a', index: 1 },
    seed: 1,
  }, pack), /E_GENERATION_CONFLICT/);
});

test('batch produces unique names', () => {
  const people = generateBatch({ count: 50, seed: 11 }, pack);
  const names = people.map((p) => p.fullName);
  assert.equal(new Set(names).size, names.length);
});

test('phonetic conflicts are filtered in batch', () => {
  const people = generateBatch({ count: 200, seed: 5 }, pack);
  const bad = people.filter((p) => phoneticIssues(p.surname, p.given).length > 0);
  assert.ok(bad.length <= 10, `${bad.length}/200 names still have phonetic conflicts`);
});

test('style profile yields matching style tags', () => {
  const people = generateBatch({ count: 20, style: ['清冷'], seed: 3 }, pack);
  const matched = people.filter((p) => p.styleTags.includes('清冷')).length;
  assert.ok(matched >= 15, `only ${matched}/20 names carry 清冷`);
});

test('僧道 class uses 道/法/僧 prefix pattern', () => {
  const people = generateBatch({ class: '僧道', count: 100, seed: 3 }, pack);
  const religious = people.filter((p) => p.pattern === 'religious-prefix');
  if (pack.chars.some((c) => ['道', '法', '僧'].includes(c.char))) {
    assert.ok(religious.length > 0, 'no religious-prefix names generated');
  }
  for (const person of religious) {
    assert.ok(['道', '法', '僧'].includes(person.given[0]!.text));
  }
});

test('radical/stroke penalties are active when Unihan data exists', () => {
  if (!pack.chars.some((c) => c.strokes)) return;
  const byChar = new Map(pack.chars.map((c) => [c.char, c]));
  const people = generateBatch({ count: 200, seed: 5 }, pack);
  for (const person of people) {
    if (person.given.length !== 2) continue;
    const a = byChar.get(person.given[0]!.text);
    const b = byChar.get(person.given[1]!.text);
    if (!a || !b) continue;
    const key = (value: string | undefined) => value?.split('.')[0]?.replace(/'/g, '');
    assert.ok(!(key(a.radical) && key(a.radical) === key(b.radical)), person.fullName);
    assert.ok((a.strokes ?? 0) + (b.strokes ?? 0) <= 40, person.fullName);
  }
});

test('chuci profile only emits sourced allusions', () => {
  if (Object.keys(pack.allusions).length === 0) return;
  const people = generateBatch({ allusion: 'chuci', count: 10, seed: 9 }, pack);
  assert.ok(people.length > 0);
  for (const person of people) {
    assert.ok(person.allusion?.source.includes('楚辞'), person.fullName);
  }
});

test('surname input only accepts Han characters', () => {
  for (const bad of ['沈1', 'A沈', '沈!', '沈 清']) {
    assert.throws(() => generate({ surname: bad }, pack), /E_SURNAME_INVALID/);
  }
  assert.equal(generate({ surname: ' 沈 ' }, pack).surname.text, '沈');
});

test('check catches blacklist and famous collision', () => {
  assert.equal(checkName('范统', pack).valid, false);
  assert.ok(checkName('苏轼', pack).warnings.some((w) => w.code === 'famous_collision'));
});

test('defaults are resolved', () => {
  const profile = resolveProfile({});
  assert.equal(profile.era, 'song');
  assert.equal(profile.mode, 'stable');
  assert.equal(profile.generation, null);
});

test('artifact generator is deterministic and has no grade', () => {
  const a = generateArtifacts({ count: 1, seed: 42 }, pack)[0]!;
  const b = generateArtifacts({ count: 1, seed: 42 }, pack)[0]!;
  assert.deepEqual(a, b);
  assert.equal('grade' in a, false);
  assert.equal('品阶' in a, false);
});

test('artifact examples are constructible from the seed parts', () => {
  const modifiers = new Set(pack.artifacts.modifiers.map((m) => m.text));
  const forms = new Set(pack.artifacts.forms.map((f) => f.text));
  for (const [modifier, form] of [
    ['神意', '珠'],
    ['铁', '剑'],
    ['赤焰', '刀'],
    ['万魂', '幡'],
    ['翻天', '印'],
    ['澄明', '镜'],
  ]) {
    assert.ok(modifiers.has(modifier), `missing modifier ${modifier}`);
    assert.ok(forms.has(form), `missing form ${form}`);
  }
});

test('artifact batch is unique', () => {
  const artifacts = generateArtifacts({ count: 50, seed: 7 }, pack);
  assert.equal(new Set(artifacts.map((a) => a.name)).size, artifacts.length);
});

test('SDK createGenerator exposes the core API', () => {
  const sdk = createGenerator({ pack });
  const person = sdk.generate({ seed: 42 });
  assert.equal(person.fullName.length >= 2, true);
  assert.equal('courtesy' in person, false);
  assert.equal(sdk.check('范统').valid, false);
  assert.ok(sdk.artifacts({ count: 1, seed: 1 })[0]?.name);
});
