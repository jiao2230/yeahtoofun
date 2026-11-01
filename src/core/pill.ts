import { packManifest } from './manifest.ts';
import { Rng, seedForItem, seedFrom } from './rng.ts';
import { isBlockedConflict, slotConflict, slotPenalty } from './slot.ts';
import type {
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
const HIGH_GRADE_CHANCE = 0.3;

export function generatePills(options: PillOptions = {}, pack: SeedPack): PillName[] {
  const count = Math.min(MAX_COUNT, Math.max(0, Math.trunc(options.count ?? DEFAULT_COUNT)));
  if (count === 0) return [];
  const kind = options.kind ?? 'any';
  if (kind === '天地') {
    throw new Error('E_PILL_KIND: 天地是修饰词类别，不是功效；可选突破/疗伤/淬体/神魂/通用/毒');
  }
  const suffixText = options.suffix ?? 'any';
  const mode = options.mode ?? 'any';
  if (!['function', 'high', 'poison', 'any'].includes(mode)) {
    throw new Error('E_PILL_MODE: --mode 只支持 function/high/poison/any');
  }
  const poisonMode = mode === 'poison' || kind === '毒';
  const effectiveMode = poisonMode
    ? 'poison'
    : mode === 'any' && kind !== 'any'
      ? 'function'
      : mode;

  const modifiers = pack.pills.modifiers;
  const cores = pack.pills.cores.filter((core) => kind === 'any' || core.kind === kind);
  const suffixes = pack.pills.suffixes.filter(
    (suffix) => suffixText === 'any' || suffix.text === suffixText,
  );
  const highModifiers = pack.pills.highModifiers;
  if (modifiers.length === 0) throw new Error('E_PILL_PACK: 修饰词为空');
  if (!poisonMode && cores.length === 0) throw new Error(`E_PILL_KIND: 没有「${kind}」功效`);
  if (suffixes.length === 0) throw new Error(`E_PILL_SUFFIX: 未知后缀「${suffixText}」`);
  if (highModifiers.length === 0) throw new Error('E_PILL_PACK: 高级修饰词为空');
  if (poisonMode && (pack.pills.poisonHeads.length === 0 || pack.pills.poisonTargets.length === 0)) {
    throw new Error('E_PILL_PACK: 毒丹字表为空');
  }

  const baseSeed = seedFrom(options.seed);
  const pills: PillName[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    let pill: PillName | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const seed = seedForItem(baseSeed, i + attempt * 1_000_003);
      const candidate = generateOne(seed, pack, modifiers, cores, highModifiers, suffixes, effectiveMode);
      if (pack.pills.blacklist.includes(candidate.fullName)) continue;
      if (seen.has(candidate.fullName)) continue;
      pill = candidate;
      break;
    }
    if (!pill) {
      const seed = seedForItem(baseSeed, i + 9_000_019);
      pill = generateOne(seed, pack, modifiers, cores, highModifiers, suffixes, effectiveMode);
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
  highModifiers: PillPack['highModifiers'],
  suffixes: PillPack['suffixes'],
  requestedMode: 'function' | 'high' | 'poison' | 'any',
): PillName {
  const rng = new Rng(seed);
  if (requestedMode === 'poison') {
    return generatePoison(seed, pack, rng, suffixes);
  }
  const high = requestedMode === 'high' || (requestedMode === 'any' && rng.next() < HIGH_GRADE_CHANCE);
  return high
    ? generateHighGrade(seed, pack, rng, modifiers, highModifiers, suffixes)
    : generateFunction(seed, pack, rng, modifiers, cores, suffixes);
}

function generatePoison(
  seed: number,
  pack: SeedPack,
  rng: Rng,
  suffixes: PillPack['suffixes'],
): PillName {
  const head = rng.pick(pack.pills.poisonHeads);
  const target = rng.pick(pack.pills.poisonTargets);
  const core = `${head}${target}`;
  const suffixPool = suffixes.filter((item) => item.text !== core);
  const suffix = rng.weightedPick(suffixPool, (item) => item.weight);
  return {
    schemaVersion: '1.0',
    fullName: `${core}${suffix.text}`,
    mode: 'poison',
    tier: '毒',
    modifier: '',
    core,
    suffix: suffix.text,
    kind: '毒',
    tags: ['毒', '毒丹', suffix.text],
    description: `以「${head}」之性侵「${target}」，炼为毒${suffix.text}。`,
    score: Number((0.6 + rng.next() * 0.3).toFixed(4)),
    seed,
    warnings: [],
    pack: packManifest(pack),
    license: pack.license,
  };
}

function generateFunction(
  seed: number,
  pack: SeedPack,
  rng: Rng,
  modifiers: PillPack['modifiers'],
  cores: PillPack['cores'],
  suffixes: PillPack['suffixes'],
): PillName {
  // 普通丹药：修饰词可以没有；功效必须是核心，不能再拿功能词当前缀。
  // 修饰词只取双字天地意象，避免“玄 + 坚髓”这类单字硬拼。
  const modifierPool = modifiers.filter((item) => item.text.length === 2);
  const modifier: PillModifier =
    rng.next() < 0.65
      ? rng.weightedPick(
          modifierPool.length > 0 ? modifierPool : modifiers,
          (item) => item.weight,
        )
      : { text: '', kind: '天地', weight: 1 };
  let core = rng.weightedPick(cores, (item) => item.weight);
  const coreConflict = slotConflict(modifier.text, core.text);
  if (isBlockedConflict(coreConflict)) {
    const alternatives = cores.filter((item) => !isBlockedConflict(slotConflict(modifier.text, item.text)));
    if (alternatives.length === 0) {
      throw new Error('E_PILL_SLOT_DUPLICATE: 修饰词与功效不能同词或同首字');
    }
    core = rng.weightedPick(alternatives, (item) => item.weight);
  }
  const finalCoreConflict = slotConflict(modifier.text, core.text);
  const forbidden = new Set([modifier.text, core.text]);
  const suffixPool = suffixes.filter(
    (item) => !forbidden.has(item.text) && suffixAllowed(core.kind, item.text),
  );
  if (suffixPool.length === 0) {
    throw new Error('E_PILL_SLOT_DUPLICATE: 没有可用后缀（修饰词/功效不能与后缀同词）');
  }
  const suffix = rng.weightedPick(suffixPool, (item) => weightedSuffix(item, modifier.kind, core.kind));
  const fullName = `${modifier.text}${core.text}${suffix.text}`;
  const tags = [core.kind, modifier.text ? '修饰' : '无修饰', suffix.text];
  return {
    schemaVersion: '1.0',
    fullName,
    mode: 'function',
    tier: '普通',
    modifier: modifier.text,
    core: core.text,
    suffix: suffix.text,
    kind: core.kind,
    tags,
    description: modifier.text
      ? `以「${modifier.text}」为引，主「${core.text}」，炼为${suffix.text}。`
      : `以「${core.text}」为主，炼为${suffix.text}。`,
    score: Number(
      Math.max(
        0,
        0.55 +
          rng.next() * 0.3 +
          compatibilityBonus(modifier.kind, core.kind) -
          slotPenalty(finalCoreConflict),
      ).toFixed(4),
    ),
    seed,
    warnings: [],
    pack: packManifest(pack),
    license: pack.license,
  };
}

function generateHighGrade(
  seed: number,
  pack: SeedPack,
  rng: Rng,
  modifiers: PillPack['modifiers'],
  highModifiers: PillPack['highModifiers'],
  suffixes: PillPack['suffixes'],
): PillName {
  // 高级通用丹药：意象修饰 + 意象修饰 + 丹药类型；不绑定功效。
  const firstPool = modifiers.filter((item) => item.text.length === 2);
  const first = rng.weightedPick(firstPool.length > 0 ? firstPool : modifiers, (item) => item.weight);
  const secondPool = highModifiers.filter(
    (item) => !isBlockedConflict(slotConflict(first.text, item.text)),
  );
  if (secondPool.length === 0) {
    throw new Error('E_PILL_SLOT_DUPLICATE: 没有可用的高级修饰词');
  }
  const second = rng.weightedPick(secondPool, (item) => item.weight);
  const modifierConflict = slotConflict(first.text, second.text);
  const forbidden = new Set([first.text, second.text]);
  const suffixPool = suffixes.filter((item) => !forbidden.has(item.text));
  if (suffixPool.length === 0) throw new Error('E_PILL_SLOT_DUPLICATE: 没有可用后缀');
  const suffix = rng.weightedPick(suffixPool, (item) => item.weight + (item.text === '丹' ? 4 : 0));
  const fullName = `${first.text}${second.text}${suffix.text}`;
  return {
    schemaVersion: '1.0',
    fullName,
    mode: 'high',
    tier: '高级',
    modifier: first.text,
    core: second.text,
    suffix: suffix.text,
    kind: '通用',
    tags: ['高级', '双修饰', suffix.text],
    description: `以「${first.text}」为基，合「${second.text}」，炼为高级${suffix.text}。`,
    score: Number(
      Math.max(0, 0.78 + rng.next() * 0.18 - slotPenalty(modifierConflict)).toFixed(4),
    ),
    seed,
    warnings: [],
    pack: packManifest(pack),
    license: pack.license,
  };
}

function weightedSuffix(
  item: PillPack['suffixes'][number],
  modifierKind: PillKind,
  coreKind: PillKind,
): number {
  let weight = item.weight;
  if (item.preferred.includes(modifierKind)) weight += 2;
  if (item.preferred.includes(coreKind)) weight += 2;
  if (item.text === '丹') weight += 1;
  return weight;
}

function compatibilityBonus(modifierKind: PillKind, coreKind: PillKind): number {
  return modifierKind === coreKind ? 0.08 : 0;
}

function suffixAllowed(kind: PillKind, suffix: PillSuffixText): boolean {
  if (suffix === '丹') return true;
  if (kind === '通用') return suffix === '膏' || suffix === '散' || suffix === '露';
  if (kind === '突破') return suffix === '散';
  if (kind === '疗伤') return suffix === '膏' || suffix === '散' || suffix === '露';
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
