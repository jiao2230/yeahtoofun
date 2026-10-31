import { packManifest } from './manifest.ts';
import { Rng, seedForItem, seedFrom } from './rng.ts';
import { isBlockedConflict, slotConflict, slotPenalty } from './slot.ts';
import type {
  TechniqueHead,
  TechniqueKind,
  TechniqueName,
  TechniqueOptions,
  TechniquePack,
  TechniqueSuffixText,
  SeedPack,
} from './types.ts';

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10_000;

const DEGREE_MIDDLES = new Set([
  '镇山', '归元', '凝神', '养气', '淬体', '通脉', '守一',
  '还虚', '合道', '周天', '玄关', '紫府', '结丹', '化婴',
  '敕雷', '御霆', '聚灵', '养魂', '炼魄', '无相',
]);

const DEGREE_ONE_MIDDLES = new Set([
  '镇山', '周天', '玄关', '紫府', '敕雷', '御霆', '归元', '无相',
]);

export function generateTechniques(
  options: TechniqueOptions = {},
  pack: SeedPack,
): TechniqueName[] {
  const count = Math.min(MAX_COUNT, Math.max(0, Math.trunc(options.count ?? DEFAULT_COUNT)));
  if (count === 0) return [];
  const kind = options.kind ?? 'any';
  const suffixText = options.suffix ?? 'any';
  const heads = pack.techniques.heads.filter((head) => kind === 'any' || head.kind === kind);
  const suffixes = pack.techniques.suffixes.filter(
    (suffix) => suffixText === 'any' || suffix.text === suffixText,
  );
  if (heads.length === 0) throw new Error(`E_TECHNIQUE_KIND: 没有「${kind}」起手词`);
  if (suffixes.length === 0) throw new Error(`E_TECHNIQUE_SUFFIX: 未知后缀「${suffixText}」`);

  const baseSeed = seedFrom(options.seed);
  const techniques: TechniqueName[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    let technique: TechniqueName | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const seed = seedForItem(baseSeed, i + attempt * 1_000_003);
      const candidate = generateOne(seed, pack, heads, suffixes);
      if (pack.techniques.blacklist.includes(candidate.fullName)) continue;
      if (seen.has(candidate.fullName)) continue;
      technique = candidate;
      break;
    }
    if (!technique) {
      const seed = seedForItem(baseSeed, i + 9_000_019);
      technique = generateOne(seed, pack, heads, suffixes);
      technique.warnings.push({ code: 'duplicate_relaxed', message: '多次重掷仍重复，已放宽' });
    }
    seen.add(technique.fullName);
    techniques.push(technique);
  }
  return techniques;
}

function generateOne(
  seed: number,
  pack: SeedPack,
  heads: TechniquePack['heads'],
  suffixes: TechniquePack['suffixes'],
): TechniqueName {
  const rng = new Rng(seed);
  const template = rng.next();
  const long = template < 0.4;
  const mid = !long && template < 0.7;
  let headLength = mid ? 1 : 2;
  let headPool = mid ? heads.filter((head) => head.kind === '程度') : heads;
  if (headPool.length === 0) {
    headPool = heads;
    headLength = 2;
  }
  const head = pickWithLength(rng, headPool, headLength, headLength === 2 ? 1 : 2);
  const degreeSet =
    head.kind === '程度'
      ? head.text.length === 1
        ? DEGREE_ONE_MIDDLES
        : DEGREE_MIDDLES
      : null;
  const middlePool =
    degreeSet === null
      ? pack.techniques.middles
      : pack.techniques.middles.filter((item) => degreeSet.has(item.text));
  const middleCandidates = middlePool.filter(
    (item) => !isBlockedConflict(slotConflict(head.text, item.text)),
  );
  const middle =
    long || mid
      ? pickWithLength(
          rng,
          middleCandidates.length > 0
            ? middleCandidates
            : pack.techniques.middles.filter(
                (item) => !isBlockedConflict(slotConflict(head.text, item.text)),
              ),
          2,
          2,
        ).text
      : null;
  const middleConflict = slotConflict(head.text, middle);
  const forbidden = new Set([head.text, ...(middle ? [middle] : [])]);
  const suffixPool = suffixes.filter((item) => {
    if (forbidden.has(item.text)) return false;
    if (head.kind === '程度' && head.text.length === 1) {
      return item.text === '诀' || item.text === '功' || item.text === '真经';
    }
    return true;
  });
  if (suffixPool.length === 0) {
    throw new Error('E_TECHNIQUE_SLOT_DUPLICATE: 没有可用后缀（起手/中段不能与后缀同词）');
  }
  const suffix = rng.weightedPick(suffixPool, (item) => {
    let weight = item.weight;
    if (middle === null) weight += item.text === '功' || item.text === '诀' ? 4 : 0;
    if (head.kind === '程度') weight += item.text === '诀' || item.text === '功' ? 2 : 0;
    if (middle !== null) weight += 1;
    return weight;
  });
  const fullName = `${head.text}${middle ?? ''}${suffix.text}`;
  const warnings: TechniqueName['warnings'] = [];
  if (pack.techniques.blacklist.includes(fullName)) {
    warnings.push({ code: 'technique_blacklist', message: '与内置真实/专有功名冲突' });
  }
  const emptyBonus = middle === null && suffix.text === '功' ? 0.05 : 0;
  const score = Number(
    Math.max(0, 0.55 + rng.next() * 0.3 + emptyBonus - slotPenalty(middleConflict)).toFixed(4),
  );
  const tags = [head.kind, middle === null ? '空槽' : '双段', suffix.text];
  const middleText = middle ? `中段「${middle}」` : '中段为空（不生成「无」）';
  return {
    schemaVersion: '1.0',
    fullName,
    head: head.text,
    middle,
    suffix: suffix.text,
    kind: head.kind,
    tags,
    description: `以「${head.text}」起手，${middleText}，收于「${suffix.text}」。`,
    score,
    seed,
    warnings,
    pack: packManifest(pack),
    license: pack.license,
  };
}

function pickWithLength<T extends { text: string; weight: number }>(
  rng: Rng,
  items: T[],
  length: number,
  fallbackLength: number,
): T {
  const exact = items.filter((item) => item.text.length === length);
  if (exact.length > 0) return rng.weightedPick(exact, (item) => item.weight);
  const fallback = items.filter((item) => item.text.length === fallbackLength);
  return rng.weightedPick(fallback.length > 0 ? fallback : items, (item) => item.weight);
}

export function techniqueParts(pack: SeedPack): TechniquePack {
  return pack.techniques;
}

export function techniqueKinds(pack: SeedPack): TechniqueKind[] {
  return [...new Set(pack.techniques.heads.map((head) => head.kind))];
}

export function techniqueSuffixes(pack: SeedPack): TechniqueSuffixText[] {
  return pack.techniques.suffixes.map((suffix) => suffix.text);
}
