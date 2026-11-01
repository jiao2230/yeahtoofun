import { packManifest } from './manifest.ts';
import { profileHash, Rng, seedForItem, seedFrom } from './rng.ts';
import type {
  BatchMode,
  CharEntry,
  Era,
  GenerationConfig,
  GenerationInfo,
  GivenLength,
  NameChar,
  PersonName,
  Profile,
  ResolvedProfile,
  SeedPack,
  Style,
  Warning,
} from './types.ts';

const ERAS: Era[] = ['qinhan', 'weijin', 'tangsong', 'mingqing', 'xianxia'];
const GENDERS = ['male', 'female', 'any'] as const;
const STYLES: Style[] = ['史实', '写意', '宗教'];
const CLASSES = ['士族', '寒门', '僧道', '江湖', '宫闱', '仙门'] as const;
const INITIALS = [
  'zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
  'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w',
];
const RELIGIOUS_PREFIXES = ['道', '法', '僧'];
const RELIGIOUS_NAME_CHARS = ['道', '僧', '法', '德', '正', '元', '玄', '承', '景'] as const;
const RELIGIOUS_NAME_SET = new Set<string>(RELIGIOUS_NAME_CHARS);
const RELIGIOUS_PATTERN_CHANCE = 0.35;
const MIN_STYLE_CHARS = 12;
const MIN_STYLE_GIVEN = 8;
const ALLUSION_STOP_CHARS = new Set(
  '之兮而其所以不无有为与则乃于乎哉夫何然者也矣可能将欲既亦皆各自相见使令从来上去中外出前后左右大小多少长短高低我尔汝女曰谓云是人十百千万',
);

const SINGLE_RATE: Record<Era, number> = {
  qinhan: 0.55,
  weijin: 0.45,
  tangsong: 0.35,
  mingqing: 0.25,
  xianxia: 0.3,
};

export const DEFAULT_PROFILE: ResolvedProfile = {
  era: 'tangsong',
  gender: 'any',
  style: [],
  class: '寒门',
  givenLength: 'auto',
  generation: null,
  restraint: 0.7,
  seed: 0,
  count: 1,
  mode: 'stable',
};

export function resolveProfile(input: Profile = {}): ResolvedProfile {
  const era = input.era && ERAS.includes(input.era) ? input.era : DEFAULT_PROFILE.era;
  const gender = input.gender && GENDERS.includes(input.gender) ? input.gender : DEFAULT_PROFILE.gender;
  const style = (input.style ?? []).filter((s) => STYLES.includes(s));
  const socialClass = input.class && CLASSES.includes(input.class) ? input.class : DEFAULT_PROFILE.class;
  const givenLength: GivenLength =
    input.givenLength === 1 || input.givenLength === 2 ? input.givenLength : 'auto';
  const mode: BatchMode = input.mode === 'diverse' ? 'diverse' : 'stable';
  const surname = typeof input.surname === 'string' ? input.surname.trim() : undefined;
  if (surname && !/^[\u4e00-\u9fa5]{1,4}$/.test(surname)) {
    throw new Error('E_SURNAME_INVALID: 姓氏只能填 1–4 个汉字，不能含数字/字母/符号');
  }
  return {
    era,
    gender,
    style,
    class: socialClass,
    surname: surname || undefined,
    givenLength,
    allusion:
      input.allusion === 'chuci' ||
      input.allusion === 'shijing' ||
      input.allusion === 'lunyu' ||
      input.allusion === 'all'
        ? input.allusion
        : undefined,
    generation: input.generation ?? null,
    restraint: clamp(input.restraint ?? DEFAULT_PROFILE.restraint, 0, 1),
    seed: input.seed ?? ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0),
    count: normalizeCount(input.count),
    mode,
  };
}

export function generateOne(
  input: Profile,
  pack: SeedPack,
  index = 0,
  seedOverride?: number,
): PersonName {
  const profile = resolveProfile(input);
  const baseSeed = seedFrom(profile.seed);
  const seed = seedOverride ?? seedForItem(baseSeed, index);
  const rng = new Rng(seed);
  const warnings: Warning[] = [];

  const generation = resolveGeneration(profile, pack, warnings);
  const generationChar = generation?.char;
  const surname = pickSurname(profile, pack, rng, generationChar);
  if (generation && surname.text.includes(generation.char)) {
    throw new Error('E_GENERATION_CONFLICT: 字辈字与姓氏冲突，请换姓或换字辈');
  }
  const given = pickGiven(profile, pack, rng, generation, warnings, surname);

  const givenText = given.map((c) => c.text).join('');
  const fullName = surname.text + givenText;
  const allusion = pack.allusions[givenText]?.[0];

  if (pack.blacklist.includes(fullName)) {
    warnings.push({ code: 'blacklist', message: '命中黑名单词；建议重新生成' });
  }
  if (pack.famous.includes(fullName)) {
    warnings.push({ code: 'famous_collision', message: '与内置历史名人重名' });
  }

  const styleTags = Array.from(new Set(given.flatMap((c) => findChar(pack, c.text)?.styles ?? [])));
  const pattern =
    profile.class === '僧道' &&
    given.length === 2 &&
    RELIGIOUS_PREFIXES.includes(given[0]!.text)
      ? 'religious-prefix'
      : undefined;
  const score = scoreName(pack, given, rng, surname, profile);

  return {
    schemaVersion: '1.0',
    fullName,
    surname,
    given,
    generation,
    pattern,
    allusion,
    styleTags,
    era: profile.era,
    gender: profile.gender,
    class: profile.class,
    score,
    warnings,
    seed,
    profileHash: profileHash({
      era: profile.era,
      gender: profile.gender,
      style: profile.style,
      class: profile.class,
      surname: profile.surname,
      givenLength: profile.givenLength,
      allusion: profile.allusion,
      generation: profile.generation,
      restraint: profile.restraint,
    }),
    pack: packManifest(pack),
    license: pack.license,
    provenance: [`${pack.id}@${pack.version}`],
  };
}

export function generate(input: Profile, pack: SeedPack): PersonName {
  return generateOne(input, pack, 0);
}

export function generateBatch(input: Profile, pack: SeedPack): PersonName[] {
  const profile = resolveProfile(input);
  const count = profile.count;
  const baseSeed = seedFrom(profile.seed);
  const results: PersonName[] = [];
  const seen = new Set<string>();
  const surnameCount = new Map<string, number>();
  const firstCount = new Map<string, number>();
  const lastCount = new Map<string, number>();
  const maxSurname = Math.max(2, Math.floor(count * 0.12));
  const maxFirst = Math.max(2, Math.floor(count * 0.1));
  const maxLast = Math.max(2, Math.floor(count * 0.08));

  for (let i = 0; i < count; i++) {
    let person: PersonName | null = null;
    const mmrPool: PersonName[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      const salt = attempt === 0 ? i : i + attempt * 1_000_003;
      const candidate = generateOne(input, pack, salt);
      if (seen.has(candidate.fullName)) continue;
      if (profile.mode === 'diverse' && count >= 20) {
        const s = candidate.surname.text;
        const f = candidate.given[0]?.text ?? '';
        const l = candidate.given[candidate.given.length - 1]?.text ?? '';
        const genFirst = candidate.generation?.position === 'first';
        const genLast = candidate.generation?.position === 'second';
        if ((surnameCount.get(s) ?? 0) >= maxSurname) continue;
        if (!genFirst && (firstCount.get(f) ?? 0) >= maxFirst) continue;
        if (!genLast && (lastCount.get(l) ?? 0) >= maxLast) continue;
        mmrPool.push(candidate);
        if (mmrPool.length >= 4) break;
        continue;
      }
      person = candidate;
      break;
    }
    if (!person && mmrPool.length > 0) {
      person = pickByMmr(mmrPool, results);
    }
    if (!person) {
      person = generateOne(input, pack, i + 9_000_019);
      person.warnings.push({ code: 'duplicate_relaxed', message: '多次重掷仍重复，已放宽' });
      if (profile.mode === 'diverse' && count >= 20) {
        person.warnings.push({ code: 'quota_relaxed', message: '配额重掷 8 次仍未满足，已放宽' });
      }
    }
    seen.add(person.fullName);
    surnameCount.set(person.surname.text, (surnameCount.get(person.surname.text) ?? 0) + 1);
    const f = person.given[0]?.text ?? '';
    const l = person.given[person.given.length - 1]?.text ?? '';
    if (person.generation?.position !== 'first') {
      firstCount.set(f, (firstCount.get(f) ?? 0) + 1);
    }
    if (person.generation?.position !== 'second') {
      lastCount.set(l, (lastCount.get(l) ?? 0) + 1);
    }
    results.push(person);
  }
  return results;
}

function pickByMmr(candidates: PersonName[], selected: PersonName[]): PersonName {
  let best = candidates[0]!;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const maxSimilarity = selected.reduce(
      (max, existing) => Math.max(max, similarity(candidate, existing)),
      0,
    );
    const score = candidate.score - 0.15 * maxSimilarity;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function similarity(a: PersonName, b: PersonName): number {
  const ac = new Set(Array.from(a.given.map((c) => c.text).join('')));
  const bc = new Set(Array.from(b.given.map((c) => c.text).join('')));
  const union = new Set([...ac, ...bc]);
  let overlap = 0;
  for (const ch of ac) if (bc.has(ch)) overlap++;
  const jaccard = union.size === 0 ? 0 : overlap / union.size;
  const sameSurname = a.surname.text === b.surname.text ? 0.3 : 0;
  const sameFirst = a.given[0]?.text === b.given[0]?.text ? 0.2 : 0;
  const sameLast =
    a.given[a.given.length - 1]?.text === b.given[b.given.length - 1]?.text ? 0.2 : 0;
  const sameTone =
    a.given.map((c) => c.tone).join('') === b.given.map((c) => c.tone).join('') ? 0.1 : 0;
  return jaccard * 0.2 + sameSurname + sameFirst + sameLast + sameTone;
}

function resolveGeneration(
  profile: ResolvedProfile,
  pack: SeedPack,
  warnings: Warning[],
): GenerationInfo | null {
  const config = profile.generation;
  if (!config) return null;
  if (config.applyTo && config.applyTo !== 'all' && config.applyTo !== profile.gender) {
    return null;
  }

  const preset = config.preset ? pack.generations.find((g) => g.id === config.preset) : undefined;
  if (config.preset && !preset) {
    throw new Error(`E_GENERATION_INVALID: unknown preset "${config.preset}"`);
  }
  const poem = normalizePoem(config.poem ?? preset?.chars ?? '');
  if (poem.length < 2 || poem.length > 40) {
    throw new Error('E_GENERATION_INVALID: 字辈诗需为 2–40 个汉字');
  }
  const index = config.index ?? 1;
  if (!Number.isInteger(index) || index < 1 || index > poem.length) {
    throw new Error(`E_GENERATION_INDEX: index ${index} 越界（1..${poem.length}）`);
  }
  if (profile.givenLength === 1) {
    throw new Error('E_GENERATION_CONFLICT: 字辈模式强制双字名');
  }
  const position = config.position ?? preset?.position ?? 'first';
  const char = poem[index - 1]!;

  if (!pack.chars.some((c) => c.char === char)) {
    warnings.push({
      code: 'generation_char_outside_table',
      message: `字辈字「${char}」不在种子字表内，按用户输入放行`,
    });
  }
  if (preset?.id === 'ming-imperial' && profile.gender === 'female') {
    warnings.push({
      code: 'historical_gender_mismatch',
      message: '明皇室字辈通常用于男性；需要严格历史用法时设 applyTo=male',
    });
  }
  if (preset?.id === 'ming-imperial' && profile.era !== 'mingqing' && profile.era !== 'xianxia') {
    warnings.push({
      code: 'era_mismatch',
      message: '明皇室字辈与所选时代不一致；仅提示，不阻断',
    });
  }

  return {
    char,
    index,
    preset: preset?.id,
    poem: config.poem ? poem : undefined,
    position,
  };
}

function normalizePoem(raw: string): string {
  return raw.replace(/[^\u4e00-\u9fa5]/g, '');
}

function pickSurname(
  profile: ResolvedProfile,
  pack: SeedPack,
  rng: Rng,
  generationChar?: string,
): NameChar {
  if (profile.surname) {
    const known = pack.surnames.find((s) => s.text === profile.surname);
    return {
      text: profile.surname,
      pinyin: known?.pinyin ?? '',
      tone: 0,
      sources: ['user'],
    };
  }
  let candidates = pack.surnames;
  for (let attempt = 0; attempt < 6; attempt++) {
    const picked = rng.weightedPick(candidates, (s) => s.weight);
    if (!generationChar || !picked.text.includes(generationChar)) {
      return { text: picked.text, pinyin: picked.pinyin, tone: 0, sources: [`${pack.id}:surname`] };
    }
  }
  const fallback = pack.surnames.find((s) => !generationChar || !s.text.includes(generationChar));
  const picked = fallback ?? pack.surnames[0]!;
  return { text: picked.text, pinyin: picked.pinyin, tone: 0, sources: [`${pack.id}:surname`] };
}

function pickGiven(
  profile: ResolvedProfile,
  pack: SeedPack,
  rng: Rng,
  generation: GenerationInfo | null,
  warnings: Warning[],
  surname: NameChar,
): NameChar[] {
  for (let attempt = 0; attempt < 4; attempt++) {
    const chars = pickGivenOnce(profile, pack, rng, generation, warnings, surname);
    const issues = phoneticIssues(surname, chars);
    if (issues.length === 0 || attempt === 3) {
      if (issues.length > 0) {
        warnings.push({
          code: 'phonetic_relaxed',
          message: `音形冲突（${issues.join('/')}）重掷 4 次仍存在，已放宽`,
        });
      }
      return chars;
    }
  }
  return pickGivenOnce(profile, pack, rng, generation, warnings, surname);
}

function pickReligiousGiven(
  profile: ResolvedProfile,
  pack: SeedPack,
  rng: Rng,
  surname: NameChar,
  surnameChars: Set<string>,
  wantSingle: boolean,
): NameChar[] | null {
  const available = RELIGIOUS_NAME_CHARS.filter(
    (ch) =>
      Boolean(findChar(pack, ch)) &&
      !surnameChars.has(ch) &&
      (profile.gender !== 'female' || ch !== '僧'),
  );
  if (available.length === 0) return null;
  if (wantSingle) {
    return [toNameChar(pack, rng.pick(available), [])];
  }

  const religious = rng.pick(available);
  const exactGender = pack.chars.filter(
    (c) =>
      c.char !== religious &&
      !RELIGIOUS_NAME_SET.has(c.char) &&
      !surnameChars.has(c.char) &&
      c.gender === profile.gender,
  );
  const neutral = pack.chars.filter(
    (c) =>
      c.char !== religious &&
      !RELIGIOUS_NAME_SET.has(c.char) &&
      !surnameChars.has(c.char) &&
      c.gender === 'neutral',
  );
  const companionPool =
    profile.gender === 'any'
      ? pack.chars.filter(
          (c) => c.char !== religious && !RELIGIOUS_NAME_SET.has(c.char) && !surnameChars.has(c.char),
        )
      : exactGender.length > 0
        ? exactGender
        : neutral;
  if (companionPool.length === 0) return null;

  const sampled = sampleSubset(companionPool, rng, 96);
  const scored = sampled.map((entry) => ({
    item: entry.char,
    score: scoreGiven(pack, surname, plainChars(pack, entry.char), profile),
  }));
  const companion = sampleTopK(scored, rng, 24);
  const chars = rng.next() < 0.5 ? [religious, companion] : [companion, religious];
  return chars.map((ch) => toNameChar(pack, ch, []));
}

function pickGivenOnce(
  profile: ResolvedProfile,
  pack: SeedPack,
  rng: Rng,
  generation: GenerationInfo | null,
  warnings: Warning[],
  surname: NameChar,
): NameChar[] {
  const surnameText = surname.text;
  const surnameChars = new Set(Array.from(surnameText));
  const wantSingle =
    profile.givenLength === 1 ||
    (profile.givenLength === 'auto' && rng.next() < SINGLE_RATE[profile.era]);

  if (generation) {
    const pair = findPairWithGeneration(pack, generation, profile, rng, surname);
    if (pair && !Array.from(pair).some((c) => surnameChars.has(c))) {
      return pair.split('').map((c) => toNameChar(pack, c, warnings));
    }
    const other = pickOtherChar(pack, profile, rng, surname, generation.char, surnameChars);
    const chars =
      generation.position === 'first' ? [generation.char, other] : [other, generation.char];
    return chars.map((c) => toNameChar(pack, c, warnings));
  }

  if (
    profile.style.includes('宗教')
  ) {
    const religious = pickReligiousGiven(profile, pack, rng, surname, surnameChars, wantSingle);
    if (religious) return religious;
  }

  if (
    profile.allusion &&
    profile.givenLength !== 1
  ) {
    let pool = pack.givenNames.filter((entry) => {
      if (entry.text.length !== 2) return false;
      const hits = pack.allusions[entry.text];
      if (!hits?.length) return false;
      if (
        profile.allusion !== 'all' &&
        !hits.some((hit) => hit.corpus === profile.allusion)
      ) {
        return false;
      }
      if (entry.text[0] === entry.text[1]) return false;
      if (Array.from(entry.text).some((c) => ALLUSION_STOP_CHARS.has(c))) return false;
      if (Array.from(entry.text).some((c) => surnameChars.has(c))) return false;
      if (profile.gender === 'any') return true;
      return entry.text.split('').every((c) => {
        const meta = findChar(pack, c);
        return !meta || meta.gender === 'neutral' || meta.gender === profile.gender;
      });
    });
    if (profile.style.length > 0) {
      const styled = pool.filter((entry) =>
        Array.from(entry.text).some((c) =>
          findChar(pack, c)?.styles.some((s) => profile.style.includes(s)),
        ),
      );
      if (styled.length >= MIN_STYLE_GIVEN) pool = styled;
    }
    if (pool.length > 0) {
      const sampled = sampleSubset(pool, rng, 128);
      const scored = sampled.map((entry) => ({
        item: entry.text,
        score: scoreGiven(pack, surname, plainChars(pack, entry.text), profile),
      }));
      return sampleTopK(scored, rng, 24)
        .split('')
        .map((c) => toNameChar(pack, c, warnings));
    }
  }

  if (
    profile.class === '僧道' &&
    profile.givenLength !== 1 &&
    rng.next() < RELIGIOUS_PATTERN_CHANCE
  ) {
    const prefixes = RELIGIOUS_PREFIXES.filter((ch) => Boolean(findChar(pack, ch)));
    if (prefixes.length > 0) {
      const prefix = rng.pick(prefixes);
      const other = pickOtherChar(pack, profile, rng, surname, prefix, surnameChars);
      return [prefix, other].map((c) => toNameChar(pack, c, warnings));
    }
  }

  if (wantSingle) {
    const char = pickOtherChar(pack, profile, rng, surname, undefined, surnameChars);
    return [toNameChar(pack, char, warnings)];
  }

  let pool = pack.givenNames.filter((entry) => {
    if (entry.text[0] === entry.text[1]) return false;
    if (Array.from(entry.text).some((c) => surnameChars.has(c))) return false;
    if (profile.gender === 'any') return true;
    return entry.text.split('').every((c) => {
      const meta = findChar(pack, c);
      return !meta || meta.gender === 'neutral' || meta.gender === profile.gender;
    });
  });
  if (profile.style.length > 0) {
    const styled = pool.filter((entry) =>
      Array.from(entry.text).some((c) =>
        findChar(pack, c)?.styles.some((s) => profile.style.includes(s)),
      ),
    );
    if (styled.length > 0) pool = styled;
  }
  if (pool.length > 0) {
    const sampled = sampleSubset(pool, rng, 128);
    const scored = sampled.map((entry) => ({
      item: entry.text,
      score: scoreGiven(pack, surname, plainChars(pack, entry.text), profile),
    }));
    return sampleTopK(scored, rng, 24)
      .split('')
      .map((c) => toNameChar(pack, c, warnings));
  }
  const a = pickOtherChar(pack, profile, rng, surname, undefined, surnameChars);
  const b = pickOtherChar(pack, profile, rng, surname, a, surnameChars);
  return [a, b].map((c) => toNameChar(pack, c, warnings));
}

function findPairWithGeneration(
  pack: SeedPack,
  generation: GenerationInfo,
  profile: ResolvedProfile,
  rng: Rng,
  surname: NameChar,
): string | undefined {
  const pos = generation.position === 'first' ? 0 : 1;
  const pool = pack.givenNames.filter((entry) => {
    if (entry.text.length !== 2 || entry.text[pos] !== generation.char) return false;
    if (profile.gender === 'any') return true;
    const meta = findChar(pack, entry.text[1 - pos]!);
    return !meta || meta.gender === 'neutral' || meta.gender === profile.gender;
  });
  if (pool.length === 0) return undefined;
  const sampled = sampleSubset(pool, rng, 128);
  const scored = sampled.map((entry) => ({
    item: entry.text,
    score: scoreGiven(pack, surname, plainChars(pack, entry.text), profile),
  }));
  return sampleTopK(scored, rng, 24);
}

function pickOtherChar(
  pack: SeedPack,
  profile: ResolvedProfile,
  rng: Rng,
  surname: NameChar,
  avoid?: string,
  surnameChars: Set<string> = new Set(),
): string {
  const base = pack.chars.filter((c) => {
    if (c.char === avoid) return false;
    if (surnameChars.has(c.char)) return false;
    if (profile.gender !== 'any' && c.gender !== 'neutral' && c.gender !== profile.gender) return false;
    return true;
  });
  const styled =
    profile.style.length > 0
      ? base.filter((c) => c.styles.some((s) => profile.style.includes(s)))
      : [];
  const fallback = pack.chars.filter((c) => c.char !== avoid && !surnameChars.has(c.char));
  const source =
    profile.style.length > 0
      ? styled.length >= MIN_STYLE_CHARS
        ? styled
        : base.length > 0
          ? base
          : fallback
      : base.length > 0
        ? base
        : fallback;
  const sampled = sampleSubset(source, rng, 96);
  const scored = sampled.map((c) => ({
    item: c.char,
    score: scoreGiven(pack, surname, plainChars(pack, c.char), profile),
  }));
  return sampleTopK(scored, rng, 24);
}

function toNameChar(pack: SeedPack, char: string, warnings: Warning[]): NameChar {
  const meta = findChar(pack, char);
  if (!meta) {
    warnings.push({
      code: 'char_outside_table',
      message: `字符「${char}」不在种子字表内`,
    });
    return { text: char, pinyin: '', tone: 0 };
  }
  return {
    text: meta.char,
    pinyin: meta.pinyin,
    tone: meta.tone,
    meaning: meta.meaning,
    sources: [`${pack.id}:char`],
  };
}

const charIndexCache = new WeakMap<SeedPack, Map<string, CharEntry>>();

function findChar(pack: SeedPack, char: string): CharEntry | undefined {
  let index = charIndexCache.get(pack);
  if (!index) {
    index = new Map(pack.chars.map((c) => [c.char, c]));
    charIndexCache.set(pack, index);
  }
  return index.get(char);
}

function splitPinyin(pinyin: string): { initial: string; final: string } | null {
  const text = pinyin.toLowerCase().replace(/[^a-zü]/g, '').replace(/ü/g, 'v');
  if (!text) return null;
  const initial = INITIALS.find((candidate) => text.startsWith(candidate)) ?? '';
  return { initial, final: text.slice(initial.length) };
}

export function phoneticIssues(surname: NameChar, given: NameChar[]): string[] {
  const issues: string[] = [];
  if (given.length === 2) {
    const [a, b] = given;
    if (a.tone === 3 && b.tone === 3) issues.push('double_third');
    if (a.tone > 0 && a.tone === b.tone) issues.push('same_tone');
    const pa = splitPinyin(a.pinyin);
    const pb = splitPinyin(b.pinyin);
    if (pa && pb) {
      if (pa.initial && pa.initial === pb.initial) issues.push('same_initial');
      if (pa.final && pa.final === pb.final) issues.push('same_final');
    }
  }
  const first = given[0];
  if (!first) return Array.from(new Set(issues));
  const ps = splitPinyin(surname.pinyin);
  const pf = splitPinyin(first.pinyin);
  if (ps && pf) {
    if (ps.initial && ps.initial === pf.initial) issues.push('surname_same_initial');
    if (ps.final && ps.final === pf.final) issues.push('surname_same_final');
  }
  return Array.from(new Set(issues));
}

function plainChars(pack: SeedPack, text: string): NameChar[] {
  return Array.from(text).map((ch) => {
    const meta = findChar(pack, ch);
    return meta
      ? { text: meta.char, pinyin: meta.pinyin, tone: meta.tone, meaning: meta.meaning }
      : { text: ch, pinyin: '', tone: 0 };
  });
}

function scoreGiven(
  pack: SeedPack,
  surname: NameChar,
  given: NameChar[],
  profile: ResolvedProfile,
): number {
  const metas = given
    .map((c) => findChar(pack, c.text))
    .filter((c): c is CharEntry => Boolean(c));
  const weight = metas.reduce((sum, c) => sum + c.weight, 0);
  const base = 0.55 + Math.min(0.3, weight / 300);
  const styleHits = metas.reduce(
    (sum, c) => sum + (c.styles.some((tag) => profile.style.includes(tag)) ? 1 : 0),
    0,
  );
  const genderHits =
    profile.gender === 'any'
      ? 0
      : metas.filter((c) => c.gender === 'neutral' || c.gender === profile.gender).length /
        Math.max(1, metas.length);
  const issues = phoneticIssues(surname, given).length;
  const strokes = metas.reduce((sum, c) => sum + (c.strokes ?? 0), 0);
  const givenText = given.map((c) => c.text).join('');
  const allusionBonus = pack.allusions[givenText]?.length ? 0.05 : 0;
  const strokePenalty = strokes > 40 ? 0.1 : 0;
  const radicalKey = (value: string | undefined) => value?.split('.')[0]?.replace(/'/g, '');
  const radicalPenalty =
    metas.length === 2 &&
    radicalKey(metas[0]!.radical) &&
    radicalKey(metas[0]!.radical) === radicalKey(metas[1]!.radical)
      ? 0.08
      : 0;
  return Number(
    (base + styleHits * 0.02 + genderHits * 0.01 + allusionBonus - issues * 0.03 - strokePenalty - radicalPenalty).toFixed(4),
  );
}

interface Scored<T> {
  item: T;
  score: number;
}

function sampleSubset<T>(items: T[], rng: Rng, limit: number): T[] {
  if (items.length <= limit) return items;
  const copy = items.slice();
  for (let i = 0; i < limit; i++) {
    const j = i + Math.floor(rng.next() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, limit);
}

function sampleTopK<T>(scored: Scored<T>[], rng: Rng, k: number, temperature = 0.8): T {
  const top = scored.slice().sort((a, b) => b.score - a.score).slice(0, k);
  const max = top[0]!.score;
  const weights = top.map((entry) => Math.exp((entry.score - max) / temperature));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = rng.next() * total;
  for (let i = 0; i < top.length; i++) {
    cursor -= weights[i]!;
    if (cursor <= 0) return top[i]!.item;
  }
  return top[top.length - 1]!.item;
}

function scoreName(
  pack: SeedPack,
  given: NameChar[],
  rng: Rng,
  surname: NameChar,
  profile: ResolvedProfile,
): number {
  return Number((scoreGiven(pack, surname, given, profile) + rng.next() * 0.05).toFixed(4));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeCount(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(100_000, Math.max(0, Math.trunc(value!)));
}
