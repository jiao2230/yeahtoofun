import { packManifest } from './manifest.ts';
import { Rng, seedForItem, seedFrom } from './rng.ts';
import type {
  PillCore,
  PillKind,
  PillModifier,
  PillName,
  PillOptions,
  PillPack,
  PillSuffixText,
  SeedPack,
} from './types.ts';

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10_000;

export function generatePills(options: PillOptions = {}, pack: SeedPack): PillName[] {
  const count = Math.min(MAX_COUNT, Math.max(0, Math.trunc(options.count ?? DEFAULT_COUNT)));
  if (count === 0) return [];
  const kind = options.kind ?? 'any';
  const suffixText = options.suffix ?? 'any';

  const modifiers = pack.pills.modifiers.filter(
    (modifier) => kind === 'any' || modifier.kind === kind,
  );
  const cores = pack.pills.cores.filter((core) => kind === 'any' || core.kind === kind);
  const suffixes = pack.pills.suffixes.filter(
    (suffix) => suffixText === 'any' || suffix.text === suffixText,
  );
  if (modifiers.length === 0) throw new Error(`E_PILL_KIND: 没有「${kind}」修饰词`);
  if (cores.length === 0) throw new Error(`E_PILL_KIND: 没有「${kind}」核心`);
  if (suffixes.length === 0) throw new Error(`E_PILL_SUFFIX: 未知后缀「${suffixText}」`);

  const baseSeed = seedFrom(options.seed);
  const pills: PillName[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    let pill: PillName | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const seed = seedForItem(baseSeed, i + attempt * 1_000_003);
      const candidate = generateOne(seed, pack, modifiers, cores, suffixes);
      if (pack.pills.blacklist.includes(candidate.fullName)) continue;
      if (seen.has(candidate.fullName)) continue;
      pill = candidate;
      break;
    }
    if (!pill) {
      const seed = seedForItem(baseSeed, i + 9_000_019);
      pill = generateOne(seed, pack, modifiers, cores, suffixes);
      pill.warnings.push({ code: 'duplicate_relaxed', message: '多次重掷仍重复，已放宽' });
    }
    seen.add(pill.fullName);
    pills.push(pill);
  }
  return pills;
}

function generateOne(
  seed: number,
  pack: SeedPack,
  modifiers: PillPack['modifiers'],
  cores: PillPack['cores'],
  suffixes: PillPack['suffixes'],
): PillName {
  const rng = new Rng(seed);
  const long = rng.next() < 0.55;
  const modifier = pickWithLength(rng, modifiers, long ? 2 : 1);
  const compatibleCores = cores.filter(
    (core) =>
      modifier.kind === '天地' || core.kind === modifier.kind || core.kind === '通用',
  );
  const targetedCores = modifier.targets?.length
    ? compatibleCores.filter((core) => modifier.targets!.includes(core.text))
    : compatibleCores;
  const core = pickWithLength(
    rng,
    targetedCores.length > 0 ? targetedCores : compatibleCores.length > 0 ? compatibleCores : cores,
    long ? 2 : 1,
  );
  if (modifier.text === core.text) {
    return generateOne(seed ^ 0x9e3779b9, pack, modifiers, cores, suffixes);
  }
  const compatibleSuffixes = suffixes.filter((item) => suffixAllowed(core.kind, item.text));
  const suffix = rng.weightedPick(
    compatibleSuffixes.length > 0 ? compatibleSuffixes : suffixes,
    (item) => {
      let weight = item.weight;
      if (item.preferred.includes(modifier.kind)) weight += 2;
      if (item.preferred.includes(core.kind)) weight += 2;
      if (item.text === '丹') weight += 1;
      return weight;
    },
  );
  const fullName = `${modifier.text}${core.text}${suffix.text}`;
  const warnings: PillName['warnings'] = [];
  if (pack.pills.blacklist.includes(fullName)) {
    warnings.push({ code: 'pill_blacklist', message: '与内置真实/专有丹药名冲突' });
  }
  const kindBonus = modifier.kind === core.kind ? 0.08 : 0;
  const suffixBonus = suffix.preferred.includes(core.kind) ? 0.05 : 0;
  const score = Number(Math.min(1, 0.55 + rng.next() * 0.3 + kindBonus + suffixBonus).toFixed(4));
  const tags = [...new Set([modifier.kind, core.kind, suffix.text])];
  return {
    schemaVersion: '1.0',
    fullName,
    modifier: modifier.text,
    core: core.text,
    suffix: suffix.text,
    kind: core.kind,
    tags,
    description: `以「${modifier.text}」为引，主「${core.text}」，炼为${suffix.text}。`,
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
): T {
  const filtered = items.filter((item) => item.text.length === length);
  if (filtered.length === 0) return rng.weightedPick(items, (item) => item.weight);
  return rng.weightedPick(filtered, (item) => item.weight);
}

function suffixAllowed(kind: PillKind, suffix: PillSuffixText): boolean {
  if (suffix === '丹') return true;
  if (kind === '通用') return true;
  if (kind === '突破') return suffix === '散';
  if (kind === '疗伤') return suffix === '膏' || suffix === '散';
  if (kind === '淬体') return suffix === '膏';
  if (kind === '神魂') return suffix === '散';
  return true;
}

export function pillParts(pack: SeedPack): PillPack {
  return pack.pills;
}

export function pillKinds(pack: SeedPack): PillKind[] {
  return [...new Set(pack.pills.cores.map((core) => core.kind))];
}

export function pillSuffixes(pack: SeedPack): PillSuffixText[] {
  return pack.pills.suffixes.map((suffix) => suffix.text);
}
