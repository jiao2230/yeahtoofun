import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSeedPack } from '../src/core/data.ts';
import { generate, generateBatch, phoneticIssues, resolveProfile } from '../src/core/generator.ts';
import { generateArtifacts } from '../src/core/artifact.ts';
import { generateSects } from '../src/core/sect.ts';
import { generatePills } from '../src/core/pill.ts';
import { generateTechniques } from '../src/core/technique.ts';
import { slotConflict } from '../src/core/slot.ts';
import { checkName, splitSurname } from '../src/core/check.ts';
import { createGenerator } from '../src/sdk.ts';
import { validatePack } from '../src/core/pack.ts';

const pack = loadSeedPack();

test('same seed produces the same name', () => {
  const a = generate({ era: 'tangsong', gender: 'male', seed: 42 }, pack);
  const b = generate({ era: 'tangsong', gender: 'male', seed: 42 }, pack);
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
    era: 'mingqing',
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

test('given-name phonetic conflicts are filtered in batch', () => {
  const people = generateBatch({ count: 200, seed: 5 }, pack);
  const empty = { text: '', pinyin: '', tone: 0 };
  const bad = people.filter((p) => phoneticIssues(empty, p.given).length > 0);
  assert.ok(bad.length <= 10, `${bad.length}/200 names still have given-name phonetic conflicts`);
});

test('style profile yields matching style tags', () => {
  const people = generateBatch({ count: 20, style: ['写意'], seed: 3 }, pack);
  const matched = people.filter((p) => p.styleTags.includes('写意')).length;
  assert.ok(matched >= 15, `only ${matched}/20 names carry 写意`);
});

test('sparse style pools do not collapse to a few chars', () => {
  const styles = ['史实', '写意', '宗教'] as const;
  for (const gender of ['male', 'female', 'any'] as const) {
    for (const style of styles) {
      const people = generateBatch({ count: 40, gender, style: [style], seed: 7 }, pack);
      const chars = new Set(people.flatMap((p) => p.given.map((c) => c.text)));
      assert.ok(chars.size >= 8, `${gender}/${style} only used ${chars.size} chars`);
    }
  }
});

test('religious style uses gender-specific pools and keeps imagery separate', () => {
  const male = new Set('道僧法德正元玄承景宗真之弘修悟子智贤纯中');
  const female = new Set('慧静妙徽宁清云灵仙贞元瑶慈素如');
  const allReligious = new Set([...male, ...female]);
  const byChar = new Map(pack.chars.map((c) => [c.char, c]));
  for (const gender of ['male', 'female'] as const) {
    const expected = gender === 'male' ? male : female;
    const people = generateBatch({ count: 60, gender, style: ['宗教'], seed: 12 }, pack);
    for (const person of people) {
      assert.ok(person.given.some((c) => expected.has(c.text)), person.fullName);
      for (const c of person.given) {
        if (allReligious.has(c.text)) continue;
        const meta = byChar.get(c.text);
        assert.ok(!meta || meta.gender === 'neutral' || meta.gender === gender, person.fullName);
      }
    }
  }
});

test('俗人 class uses colloquial name patterns and gender-appropriate tails', () => {
  const locked = resolveProfile({
    class: '俗人',
    era: 'xianxia',
    style: ['宗教'],
    generation: { preset: 'generic-a', index: 3 },
  });
  assert.equal(locked.era, 'tangsong');
  assert.deepEqual(locked.style, []);
  assert.equal(locked.generation, null);
  const maleTails = new Set('郎毛柱根锁蛋狗牛马白良生石虎长保龙旺存安宝福贵财喜来有铁顺'.split(''));
  const femaleTails = new Set('娘丫花兰秀英桃杏菊春满玉枝桂莲爱妹娣妞娃白宝福贵喜来有'.split(''));
  const numerals = new Set('大小二三四五六七八九十'.split(''));
  const people = generateBatch({ class: '俗人', count: 200, seed: 4 }, pack);
  for (const person of people) {
    assert.equal(person.pattern, 'colloquial');
    for (const c of person.given) {
      assert.ok(numerals.has(c.text) || maleTails.has(c.text) || femaleTails.has(c.text), person.fullName);
    }
    if (person.gender === 'female') {
      for (const c of person.given) assert.ok(!['郎', '蛋', '狗', '牛', '马', '铁'].includes(c.text), person.fullName);
    }
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
  assert.equal(checkName('彭真', pack).valid, false);
  assert.equal(checkName('吴道子', pack).valid, false);
  assert.ok(checkName('苏轼', pack).warnings.some((w) => w.code === 'famous_collision'));
});

test('blacklist names are excluded from generation, not only warned', () => {
  const seed = generate({ surname: '彭', givenLength: 1, seed: 0 }, pack);
  const blockedPack = { ...pack, blacklist: [...pack.blacklist, seed.fullName] };
  const generated = generate({ surname: '彭', givenLength: 1, seed: 0 }, blockedPack);
  assert.notEqual(generated.fullName, seed.fullName);
  assert.ok(!generated.warnings.some((w) => w.code === 'blacklist'));
  assert.equal(checkName('刘叔季', pack).valid, false);
  const rankPairs = new Set(['伯仲', '伯叔', '伯季', '仲伯', '仲叔', '仲季', '叔伯', '叔仲', '叔季', '季伯', '季仲', '季叔']);
  for (const person of generateBatch({ count: 200, seed: 8 }, pack)) {
    assert.ok(!rankPairs.has(person.given.map((c) => c.text).join('')), person.fullName);
  }
});

test('era-specific given-name pools override the global pool', () => {
  const eraNames = pack.givenNames.slice(0, 50);
  const eraPack = {
    ...pack,
    givenNames: [],
    givenNamesByEra: { tangsong: eraNames },
  };
  const people = generateBatch({ era: 'tangsong', givenLength: 2, count: 20, seed: 3 }, eraPack);
  assert.ok(people.length > 0);
  for (const person of people) {
    assert.ok(eraNames.some((entry) => entry.text === person.given.map((c) => c.text).join('')), person.fullName);
  }
});

test('female era pools take priority for female profiles', () => {
  const femaleNames = pack.givenNames.slice(0, 50);
  const femalePack = {
    ...pack,
    givenNames: [],
    femaleGivenNamesByEra: { mingqing: femaleNames },
  };
  const people = generateBatch({ era: 'mingqing', gender: 'female', givenLength: 2, count: 20, seed: 3 }, femalePack);
  assert.ok(people.length > 0);
  for (const person of people) {
    assert.ok(femaleNames.some((entry) => entry.text === person.given.map((c) => c.text).join('')), person.fullName);
  }
});

test('long Manchu/Mongolian surnames are split and accepted', () => {
  const longSurname = { text: '爱新觉罗', pinyin: '', weight: 1, compound: true };
  const longerSurname = { text: '博尔济吉特', pinyin: '', weight: 1, compound: true };
  const longPack = { ...pack, surnames: [...pack.surnames, longSurname, longerSurname] };
  assert.equal(splitSurname('爱新觉罗子正', longPack), '爱新觉罗');
  assert.equal(splitSurname('博尔济吉特子正', longPack), '博尔济吉特');
  assert.equal(checkName('爱新觉罗子正', longPack).valid, true);
  assert.equal(checkName('博尔济吉特子正', longPack).valid, true);
  const person = generate({ surname: '爱新觉罗', givenLength: 2, seed: 3 }, longPack);
  assert.ok(person.fullName.startsWith('爱新觉罗'));
  assert.equal(person.given.length, 2);
});

test('zhouyi and zhuangzi allusions are selectable', () => {
  const allusions = {
    ...pack.allusions,
    潜龙: [{ corpus: 'zhouyi' as const, source: '周易·乾·乾', line: '初九：潜龙勿用。' }],
    天池: [
      { corpus: 'chuci' as const, source: '楚辞·九思·疾世', line: '濿沧海兮东游，沐盥浴兮天池。' },
      { corpus: 'zhuangzi' as const, source: '庄子·内篇·逍遥游', line: '南冥者，天池也。' },
    ],
  };
  const namedPack = {
    ...pack,
    givenNames: [{ text: '潜龙', weight: 1 }, { text: '天池', weight: 1 }],
    allusions,
  };
  const zhouyi = generateBatch({ allusion: 'zhouyi', count: 1, seed: 3 }, namedPack);
  for (const person of zhouyi) {
    assert.equal(person.allusion?.corpus, 'zhouyi');
    assert.ok(person.allusion?.source.includes('周易'));
  }
  const zhuangzi = generateBatch({ allusion: 'zhuangzi', count: 1, seed: 3 }, namedPack);
  for (const person of zhuangzi) {
    assert.equal(person.allusion?.corpus, 'zhuangzi');
    assert.ok(person.allusion?.source.includes('庄子'));
  }
});

test('tangshi and songci allusions are selectable', () => {
  const allusions = {
    ...pack.allusions,
    明月: [{ corpus: 'tangshi' as const, source: '唐诗·静夜思', line: '举头望明月，低头思故乡。' }],
    回首: [{ corpus: 'songci' as const, source: '宋词·青玉案·元夕', line: '蓦然回首，那人却在，灯火阑珊处。' }],
  };
  const namedPack = {
    ...pack,
    givenNames: [{ text: '明月', weight: 1 }, { text: '回首', weight: 1 }],
    allusions,
  };
  const tangshi = generateBatch({ allusion: 'tangshi', count: 1, seed: 3 }, namedPack);
  assert.equal(tangshi[0]?.allusion?.corpus, 'tangshi');
  assert.ok(tangshi[0]?.allusion?.source.includes('唐诗'));
  const songci = generateBatch({ allusion: 'songci', count: 1, seed: 3 }, namedPack);
  assert.equal(songci[0]?.allusion?.corpus, 'songci');
  assert.ok(songci[0]?.allusion?.source.includes('宋词'));
});

test('xianxia does not generate long historical surnames', () => {
  const longPack = {
    ...pack,
    surnames: [...pack.surnames, { text: '爱新觉罗', pinyin: 'ai', weight: 1000, compound: true }],
  };
  const people = generateBatch({ era: 'xianxia', count: 50, seed: 7 }, longPack);
  assert.ok(people.length > 0);
  for (const person of people) {
    assert.ok(person.surname.text.length <= 2, person.fullName);
  }
});

test('era-tagged surnames stay out of earlier and xianxia pools', () => {
  const taggedPack = {
    ...pack,
    surnames: [
      ...pack.surnames.map((entry) => ({ ...entry, eras: ['tangsong' as const] })),
      { text: '爱新觉罗', pinyin: 'ai', weight: 1000, compound: true, eras: ['mingqing' as const] },
      { text: '富察', pinyin: 'fu', weight: 1000, compound: true, eras: ['mingqing' as const] },
    ],
  };
  for (const era of ['tangsong', 'xianxia'] as const) {
    const people = generateBatch({ era, count: 30, seed: 7 }, taggedPack);
    assert.ok(people.every((person) => !person.fullName.includes('爱新觉罗') && !person.fullName.includes('富察')));
  }
});

test('placeholder surnames are never generated', () => {
  const placeholderPack = {
    ...pack,
    surnames: [...pack.surnames, { text: '某', pinyin: 'mou', weight: 100000, compound: false }],
  };
  const people = generateBatch({ count: 50, seed: 9 }, placeholderPack);
  assert.ok(people.length > 0);
  assert.ok(people.every((person) => person.surname.text !== '某'));
  assert.throws(() => generate({ surname: '某', seed: 1 }, placeholderPack), /E_SURNAME_INVALID/);
});

test('single-character names do not use standalone prefixes', () => {
  const people = generateBatch({ era: 'tangsong', gender: 'female', givenLength: 1, count: 60, seed: 5 }, pack);
  assert.ok(people.length > 0);
  for (const person of people) {
    assert.equal(person.given.length, 1);
    assert.ok(!['小', '阿', '老', '儿', '氏', '某', '娘', '姑', '丫', '妞', '娃', '妹', '娣'].includes(person.given[0]!.text), person.fullName);
  }
});

test('elegant names exclude colloquial chars', () => {
  const people = generateBatch({ class: '雅士', count: 80, seed: 13 }, pack);
  assert.ok(people.length > 0);
  for (const person of people) {
    const given = person.given.map((c) => c.text).join('');
    assert.ok(!/[大小丫娘郎]/.test(given), person.fullName);
  }
});

test('weak religious single names and 房中 are excluded', () => {
  const people = generateBatch({ gender: 'male', style: ['宗教'], givenLength: 1, count: 60, seed: 21 }, pack);
  assert.ok(people.length > 0);
  for (const person of people) {
    assert.ok(!['中', '子', '之'].includes(person.given[0]!.text), person.fullName);
  }
  assert.equal(checkName('房中', pack).valid, false);
});

test('xianxia and writeyi use supplemented double-name pools', () => {
  const xianxia = generateBatch({ era: 'xianxia', givenLength: 2, count: 20, seed: 8 }, pack);
  const writeyi = generateBatch({ style: ['写意'], givenLength: 2, count: 20, seed: 8 }, pack);
  const xianxiaPool = new Set((pack.givenNamesByEra?.xianxia ?? []).map((entry) => entry.text));
  const writeyiPool = new Set((pack.givenNamesByStyle?.['写意'] ?? []).map((entry) => entry.text));
  assert.ok(xianxia.length > 0 && writeyi.length > 0);
  for (const person of xianxia) {
    assert.ok(xianxiaPool.has(person.given.map((c) => c.text).join('')), person.fullName);
  }
  for (const person of writeyi) {
    assert.ok(writeyiPool.has(person.given.map((c) => c.text).join('')), person.fullName);
  }
});

test('female xianxia/writeyi pools use supplemented names', () => {
  const people = generateBatch(
    { era: 'xianxia', style: ['写意'], gender: 'female', givenLength: 2, count: 30, seed: 8 },
    pack,
  );
  const allowed = new Set((pack.femaleGivenNamesByStyle?.['写意'] ?? []).map((entry) => entry.text));
  assert.ok(people.length > 0 && allowed.size >= 5);
  for (const person of people) {
    assert.ok(allowed.has(person.given.map((c) => c.text).join('')), person.fullName);
  }
});

test('female allusion pool can use name-level female entries', () => {
  const femaleNames = ['静姝', '清婉', '婉清', '姝宁', '娴雅'];
  const allusions = Object.fromEntries(
    femaleNames.map((name) => [
      name,
      [{ corpus: 'shijing' as const, source: '诗经·邶风·静女', line: '静女其姝，俟我于城隅。' }],
    ]),
  );
  const femalePack = {
    ...pack,
    givenNames: [],
    femaleGivenNamesByStyle: {
      写意: femaleNames.map((text) => ({ text, weight: 1, gender: 'female' as const })),
    },
    allusions,
  };
  const people = generateBatch(
    { era: 'xianxia', style: ['写意'], gender: 'female', allusion: 'shijing', givenLength: 2, count: 5, seed: 8 },
    femalePack,
  );
  assert.ok(people.length > 0);
  for (const person of people) {
    assert.ok(femaleNames.includes(person.given.map((c) => c.text).join('')), person.fullName);
    assert.ok(person.allusion?.source.includes('诗经'), person.fullName);
  }
});

test('removed romantic female names are never generated', () => {
  const removed = new Set(['西楼', '闲愁', '阑珊', '黄花', '归路', '藕花', '鸥鹭', '寒蝉', '长亭', '晓风']);
  for (const allusion of [undefined, 'all'] as const) {
    const people = generateBatch(
      { era: 'xianxia', style: ['写意'], gender: 'female', count: 80, seed: 8, ...(allusion ? { allusion } : {}) },
      pack,
    );
    for (const person of people) {
      assert.ok(!removed.has(person.given.map((c) => c.text).join('')), person.fullName);
    }
  }
});

test('pack validator rejects a malformed pack', () => {
  assert.throws(() => validatePack({ ...pack, givenNames: [] }), /E_PACK_INVALID/);
  assert.throws(
    () => validatePack({ ...pack, surnames: [{ ...pack.surnames[0]!, text: '某' }] }),
    /E_PACK_INVALID/,
  );
});

test('defaults are resolved', () => {
  const profile = resolveProfile({});
  assert.equal(profile.era, 'tangsong');
  assert.equal(profile.class, '雅士');
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
    [86, '青林宗'],
    [450, '绝意门'],
    [607, '栖霞门'],
    [1432, '问剑宗'],
    [1709, '衔山派'],
    [190, '赤阳派'],
    [388, '东极宫'],
    [589, '天魔宫'],
    [182, '虺心教'],
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

test('poison pills use poison mode and poison word combinations', () => {
  const pills = generatePills({ count: 60, seed: 42, mode: 'poison' }, pack);
  assert.equal(pills.length, 60);
  for (const pill of pills) {
    assert.equal(pill.mode, 'poison');
    assert.equal(pill.tier, '毒');
    assert.equal(pill.kind, '毒');
    assert.equal(pill.modifier, '');
    assert.equal(pill.fullName, pill.core + pill.suffix);
    assert.equal(pill.fullName.length, 3);
    assert.equal(pill.core.length, 2);
    assert.ok(pack.pills.poisonHeads.includes(pill.core[0]!));
    assert.ok(pack.pills.poisonTargets.includes(pill.core[1]!));
    assert.ok(['丹', '膏', '散', '露'].includes(pill.suffix));
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
    [121, '续命丹'],
    [161, '延寿丹'],
    [2220, '回春丹'],
    [654, '驻颜露'],
    [1166, '益气丹'],
    [371, '破妄丹'],
    [465, '护脉膏'],
    [98, '洗髓丹'],
    [342, '聚气丹'],
    [1035, '归元丹'],
    [925, '通脉散'],
    [326, '祛邪丹'],
    [386, '复生丹'],
    [387, '回阳丹'],
    [28, '定魂丹'],
    [28872, '恒阳固元丹'],
    [80, '玄玉续气膏'],
    [18895, '太阴凝华露'],
    [11089, '幻月绝情散'],
    [8496, '青木生机丹'],
    [27612, '玄霄龙象丹'],
    [11874, '九天造化丹'],
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
    [76, '吐纳功'],
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
  assert.ok(pack.artifacts.blacklist.length >= 1);
  assert.ok(pack.sects.blacklist.length >= 9);
  assert.ok(pack.pills.blacklist.length >= 11);
  assert.ok(pack.techniques.blacklist.length >= 3);

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
