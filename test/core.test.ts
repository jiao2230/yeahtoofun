import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSeedPack } from '../src/core/data.ts';
import { generate, generateBatch, phoneticIssues, resolveProfile } from '../src/core/generator.ts';
import { generateArtifacts } from '../src/core/artifact.ts';
import { generateSects } from '../src/core/sect.ts';
import { generatePills } from '../src/core/pill.ts';
import { generateTechniques } from '../src/core/technique.ts';
import { slotConflict } from '../src/core/slot.ts';
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

test('sect names are deterministic and follow prefix+suffix', () => {
  const a = generateSects({ count: 12, seed: 42 }, pack);
  const b = generateSects({ count: 12, seed: 42 }, pack);
  assert.deepEqual(a, b);
  for (const sect of a) {
    assert.ok(/^[\u4e00-\u9fa5]{3}$/.test(sect.fullName));
    assert.ok(['宗', '门', '派', '宫', '教'].includes(sect.suffix));
    assert.equal(sect.fullName, sect.prefix + sect.suffix);
  }
});

test('sect alignment filters prefixes and avoids 教 for 正道', () => {
  const sects = generateSects({ count: 30, seed: 9, alignment: '正道' }, pack);
  assert.ok(sects.length > 0);
  for (const sect of sects) {
    assert.equal(sect.alignment, '正道');
    assert.notEqual(sect.suffix, '教');
  }
  for (const sect of generateSects({ count: 200, seed: 11 }, pack)) {
    if (sect.alignment === '正道') assert.notEqual(sect.suffix, '教', sect.fullName);
  }
});

test('sect batch is unique', () => {
  const sects = generateSects({ count: 60, seed: 7 }, pack);
  assert.equal(new Set(sects.map((s) => s.fullName)).size, sects.length);
});

test('sect examples are reproducible from seeds', () => {
  const examples: Array<[number, string]> = [
    [69, '青林宗'],
    [940, '绝意门'],
    [283, '栖霞门'],
    [63, '问剑宗'],
    [731, '衔山派'],
    [347, '赤阳派'],
    [255, '东极宫'],
    [511, '天魔宫'],
    [423, '虺心教'],
  ];
  for (const [seed, expected] of examples) {
    assert.equal(generateSects({ count: 1, seed }, pack)[0]?.fullName, expected);
  }
});

test('pill names are deterministic and follow modifier+core+suffix', () => {
  const a = generatePills({ count: 12, seed: 42 }, pack);
  const b = generatePills({ count: 12, seed: 42 }, pack);
  assert.deepEqual(a, b);
  for (const pill of a) {
    assert.ok(pill.fullName.endsWith(pill.suffix));
    assert.equal(pill.fullName, pill.modifier + pill.core + pill.suffix);
    assert.ok(['丹', '膏', '散', '露'].includes(pill.suffix));
    assert.ok([3, 5].includes(pill.fullName.length), pill.fullName);
  }
});

test('high-grade pills use two modifiers and are marked 高级', () => {
  const pills = generatePills({ count: 12, seed: 42, mode: 'high' }, pack);
  assert.equal(pills.length, 12);
  for (const pill of pills) {
    assert.equal(pill.mode, 'high');
    assert.equal(pill.tier, '高级');
    assert.equal(pill.fullName.length, 5);
    assert.ok(pill.tags.includes('高级'));
  }
});

test('pill kind and suffix filters are respected', () => {
  const pills = generatePills({ count: 20, seed: 9, kind: '疗伤', suffix: '膏' }, pack);
  assert.ok(pills.length > 0);
  for (const pill of pills) {
    assert.equal(pill.kind, '疗伤');
    assert.equal(pill.suffix, '膏');
  }
});

test('pill function mode does not stack functional modifiers', () => {
  const pills = generatePills({ count: 500, seed: 3, mode: 'function' }, pack);
  for (const pill of pills) {
    assert.ok(!(pill.modifier === '凝气' && pill.core === '聚气'), pill.fullName);
    assert.ok(!(pill.modifier === '宁神' && pill.core === '安神'), pill.fullName);
    assert.ok(!(pill.modifier === '凝' && pill.core === '破障'), pill.fullName);
  }
});

test('pill batch is unique', () => {
  const pills = generatePills({ count: 60, seed: 7 }, pack);
  assert.equal(new Set(pills.map((p) => p.fullName)).size, pills.length);
});

test('pill examples are reproducible from seeds', () => {
  const examples: Array<[number, string]> = [
    [219, '续命丹'],
    [1721, '延寿丹'],
    [197, '回春丹'],
    [384, '驻颜露'],
    [558, '益气丹'],
    [32, '破妄丹'],
    [502, '护脉膏'],
    [165, '洗髓丹'],
    [824, '聚气丹'],
    [1461, '归元丹'],
    [108, '通脉散'],
    [6, '祛邪丹'],
    [622, '复生丹'],
    [531, '回阳丹'],
    [20, '定魂丹'],
    [6096, '恒阳固元丹'],
    [1827, '玄玉续气膏'],
    [8060, '太阴凝华露'],
    [15165, '幻月绝情散'],
    [6757, '青木生机丹'],
    [2797, '玄霄龙象丹'],
    [12959, '九天造化丹'],
  ];
  for (const [seed, expected] of examples) {
    assert.equal(generatePills({ count: 1, seed }, pack)[0]?.fullName, expected);
  }
});

test('technique names are deterministic and B-slot empty is not 无', () => {
  const a = generateTechniques({ count: 15, seed: 42 }, pack);
  const b = generateTechniques({ count: 15, seed: 42 }, pack);
  assert.deepEqual(a, b);
  for (const technique of a) {
    assert.equal(technique.fullName, technique.head + (technique.middle ?? '') + technique.suffix);
    if (technique.middle === null) {
      assert.equal(technique.fullName, technique.head + technique.suffix);
      assert.ok(!technique.fullName.includes('无'));
    }
    assert.ok(
      ['诀', '功', '真经', '妙法', '篇', '典', '剑章', '真本', '直指', '灵书', '要义', '神册', '录'].includes(
        technique.suffix,
      ),
    );
  }
});

test('technique kind and suffix filters are respected', () => {
  const techniques = generateTechniques({ count: 20, seed: 9, kind: '动作', suffix: '功' }, pack);
  assert.ok(techniques.length > 0);
  for (const technique of techniques) {
    assert.equal(technique.kind, '动作');
    assert.equal(technique.suffix, '功');
  }
});

test('technique batch is unique', () => {
  const techniques = generateTechniques({ count: 60, seed: 7 }, pack);
  assert.equal(new Set(techniques.map((t) => t.fullName)).size, techniques.length);
});

test('technique examples are reproducible from seeds', () => {
  const examples: Array<[number, string]> = [
    [35966, '青木归元真经'],
    [16, '大镇山诀'],
    [514, '吐纳功'],
  ];
  for (const [seed, expected] of examples) {
    assert.equal(generateTechniques({ count: 1, seed }, pack)[0]?.fullName, expected);
  }
});

test('technique suffixes and middles follow the new vocabulary rules', () => {
  const suffixes = pack.techniques.suffixes.map((item) => item.text);
  for (const suffix of ['剑章', '真本', '直指', '灵书', '要义', '神册', '录']) {
    assert.ok(suffixes.includes(suffix as (typeof suffixes)[number]));
  }
  assert.ok(!suffixes.includes('章' as (typeof suffixes)[number]));
  const middles = pack.techniques.middles.map((item) => item.text);
  for (const middle of ['敕雷', '御霆', '归元', '无相']) assert.ok(middles.includes(middle));
  for (const middle of ['雷法', '剑意']) assert.ok(!middles.includes(middle));
});

test('slot similarity catches shared leading chars', () => {
  assert.equal(slotConflict('紫极', '紫霄'), 'prefix');
  assert.equal(slotConflict('太上', '太初'), 'prefix');
  assert.equal(slotConflict('玄阴', '玄关'), 'prefix');
  assert.equal(slotConflict('青木', '木灵'), 'overlap');
  assert.equal(slotConflict('青木', '生机'), null);
});

test('high-grade pills avoid shared-leading modifier pairs', () => {
  const highPack = JSON.parse(JSON.stringify(pack)) as typeof pack;
  highPack.pills.modifiers.push({ text: '紫极', kind: '天地', weight: 1000 });
  highPack.pills.highModifiers.push({ text: '紫霄', weight: 1000 });
  for (const pill of generatePills({ count: 300, seed: 1, mode: 'high' }, highPack)) {
    assert.notEqual(slotConflict(pill.modifier, pill.core), 'prefix');
  }
});

test('degree techniques do not pair 极/至/大 with 洗髓', () => {
  const techniques = generateTechniques({ count: 300, seed: 3, kind: '程度' }, pack);
  for (const technique of techniques) {
    assert.notEqual(technique.middle, '洗髓');
    assert.ok(!['极', '至'].includes(technique.head));
  }
});

test('pill and technique never repeat a slot word as suffix', () => {
  const pillPack = JSON.parse(JSON.stringify(pack)) as typeof pack;
  pillPack.pills.modifiers.push({ text: '丹', kind: '通用', weight: 1000 });
  pillPack.pills.cores.push({ text: '丹', kind: '通用', weight: 1000 });
  pillPack.pills.highModifiers.push({ text: '丹', weight: 1000 });
  for (const pill of generatePills({ count: 300, seed: 1 }, pillPack)) {
    assert.notEqual(pill.modifier, pill.suffix);
    assert.notEqual(pill.core, pill.suffix);
  }

  const techniquePack = JSON.parse(JSON.stringify(pack)) as typeof pack;
  techniquePack.techniques.heads.push({ text: '真经', kind: '动作', weight: 1000 });
  for (const technique of generateTechniques({ count: 300, seed: 1 }, techniquePack)) {
    assert.notEqual(technique.head, technique.suffix);
    if (technique.middle !== null) assert.notEqual(technique.middle, technique.suffix);
  }
});

test('extension blacklists are populated and enforced', () => {
  assert.ok(pack.artifacts.blacklist.length >= 30);
  assert.ok(pack.sects.blacklist.length >= 40);
  assert.ok(pack.pills.blacklist.length >= 20);
  assert.ok(pack.techniques.blacklist.length >= 40);

  for (const artifact of generateArtifacts({ count: 60, seed: 1 }, pack)) {
    assert.ok(!pack.artifacts.blacklist.includes(artifact.name), artifact.name);
  }
  for (const sect of generateSects({ count: 60, seed: 1 }, pack)) {
    assert.ok(!pack.sects.blacklist.includes(sect.fullName), sect.fullName);
  }
  for (const pill of generatePills({ count: 60, seed: 1 }, pack)) {
    assert.ok(!pack.pills.blacklist.includes(pill.fullName), pill.fullName);
  }
  for (const technique of generateTechniques({ count: 60, seed: 1 }, pack)) {
    assert.ok(!pack.techniques.blacklist.includes(technique.fullName), technique.fullName);
  }
});

test('SDK createGenerator exposes the core API', () => {
  const sdk = createGenerator({ pack });
  const person = sdk.generate({ seed: 42 });
  assert.equal(person.fullName.length >= 2, true);
  assert.equal('courtesy' in person, false);
  assert.equal(sdk.check('范统').valid, false);
  assert.ok(sdk.artifacts({ count: 1, seed: 1 })[0]?.name);
  assert.ok(sdk.sects({ count: 1, seed: 1 })[0]?.fullName);
  assert.ok(sdk.pills({ count: 1, seed: 1 })[0]?.fullName);
  assert.ok(sdk.techniques({ count: 1, seed: 1 })[0]?.fullName);
});
