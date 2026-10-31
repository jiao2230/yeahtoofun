import { packManifest } from './manifest.ts';
import { Rng, seedForItem, seedFrom } from './rng.ts';
import type {
  SectAlignment,
  SectName,
  SectOptions,
  SectPack,
  SeedPack,
} from './types.ts';

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10_000;

export function generateSects(options: SectOptions = {}, pack: SeedPack): SectName[] {
  const count = Math.min(MAX_COUNT, Math.max(0, Math.trunc(options.count ?? DEFAULT_COUNT)));
  if (count === 0) return [];
  const alignment = options.alignment ?? 'any';
  const prefixes =
    alignment === 'any'
      ? pack.sects.prefixes
      : pack.sects.prefixes.filter((prefix) => prefix.alignment === alignment);
  if (prefixes.length === 0) {
    throw new Error(`E_SECT_ALIGNMENT: 没有「${alignment}」阵营的前缀`);
  }
  const suffixes = pack.sects.suffixes.filter(
    (suffix) => !(alignment === '正道' && suffix.text === '教'),
  );
  if (suffixes.length === 0) throw new Error('E_SECT_PACK: 宗门后缀为空');

  const baseSeed = seedFrom(options.seed);
  const sects: SectName[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    let sect: SectName | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const seed = seedForItem(baseSeed, i + attempt * 1_000_003);
      const candidate = generateOne(seed, pack, prefixes, suffixes);
      if (pack.sects.blacklist.includes(candidate.fullName)) continue;
      if (seen.has(candidate.fullName)) continue;
      sect = candidate;
      break;
    }
    if (!sect) {
      const seed = seedForItem(baseSeed, i + 9_000_019);
      sect = generateOne(seed, pack, prefixes, suffixes);
      sect.warnings.push({ code: 'duplicate_relaxed', message: '多次重掷仍重复，已放宽' });
    }
    seen.add(sect.fullName);
    sects.push(sect);
  }
  return sects;
}

function generateOne(
  seed: number,
  pack: SeedPack,
  prefixes: SectPack['prefixes'],
  suffixes: SectPack['suffixes'],
): SectName {
  const rng = new Rng(seed);
  const prefix = rng.weightedPick(prefixes, (item) => item.weight);
  const suffix = rng.weightedPick(suffixes, (item) => {
    let weight = item.weight;
    if (item.alignment === prefix.alignment) weight += 2;
    if (item.text === '教' && prefix.alignment === '魔道') weight += 2;
    if (item.text === '宗' && prefix.alignment === '正道') weight += 1;
    return weight;
  });
  const fullName = `${prefix.text}${suffix.text}`;
  const warnings: SectName['warnings'] = [];
  if (pack.sects.blacklist.includes(fullName)) {
    warnings.push({ code: 'sect_blacklist', message: '与内置真实/专有宗门名冲突' });
  }
  const alignmentBonus = prefix.alignment === suffix.alignment ? 0.08 : 0;
  const cultBonus = suffix.text === '教' && prefix.alignment === '魔道' ? 0.05 : 0;
  const score = Number(Math.min(1, 0.55 + rng.next() * 0.3 + alignmentBonus + cultBonus).toFixed(4));
  const tags = [...new Set([prefix.alignment, prefix.tone, ...prefix.tags])];
  const note = prefix.note ? `${prefix.note}。` : '';
  return {
    schemaVersion: '1.0',
    fullName,
    prefix: prefix.text,
    suffix: suffix.text,
    alignment: prefix.alignment,
    tone: prefix.tone,
    tags,
    description: `${fullName}：${prefix.alignment}势力，气质${prefix.tone}。${note}`,
    score,
    seed,
    warnings,
    pack: packManifest(pack),
    license: pack.license,
  };
}

export function sectParts(pack: SeedPack): SectPack {
  return pack.sects;
}

export function sectAlignments(pack: SeedPack): SectAlignment[] {
  return [...new Set(pack.sects.prefixes.map((prefix) => prefix.alignment))];
}
