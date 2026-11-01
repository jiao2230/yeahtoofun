import { existsSync, readFileSync } from 'node:fs';
import { validatePack } from './pack.ts';
import type {
  AllusionEntry,
  ArtifactPack,
  CharEntry,
  GenerationPreset,
  GivenEntry,
  PillPack,
  SectPack,
  SeedPack,
  SurnameEntry,
  TechniquePack,
} from './types.ts';

interface PackManifest {
  id: string;
  version: string;
  license: string;
  source: string;
}

const DEFAULT_PACK = (process.env.MINGLU_PACK ?? 'seed').trim() || 'seed';
const PACK_IDS = ['seed', 'core', 'cbdb'];
const cache = new Map<string, SeedPack>();

function dataDir(id: string): URL {
  return id === 'seed'
    ? new URL('../../data/seed/', import.meta.url)
    : new URL(`../../data/packs/${id}/`, import.meta.url);
}

function readJson<T>(name: string, dir: URL): T {
  const url = new URL(name, dir);
  if (!existsSync(url)) {
    throw new Error(
      `E_PACK_MISSING: ${url.pathname}；seed 请用 MINGLU_PACK=seed，真实包请先运行 tools/build_pack.py`,
    );
  }
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

export function loadPack(id = DEFAULT_PACK): SeedPack {
  const packId = id.trim() || 'seed';
  if (!/^[a-z0-9_-]+$/.test(packId)) {
    throw new Error('E_PACK_INVALID: pack id 只能包含小写字母、数字、下划线和连字符');
  }
  const cached = cache.get(packId);
  if (cached) return cached;

  const dir = dataDir(packId);
  const manifest = existsSync(new URL('pack.json', dir))
    ? readJson<PackManifest>('pack.json', dir)
    : null;
  const extra = existsSync(new URL('given-names-extra.json', dir))
    ? readJson<{ xianxia?: GivenEntry[]; 写意?: GivenEntry[]; xianxiaFemale?: GivenEntry[]; writeyiFemale?: GivenEntry[] }>('given-names-extra.json', dir)
    : null;
  const pack: SeedPack = {
    id: manifest?.id ?? packId,
    version: manifest?.version ?? '0.1.0',
    license: manifest?.license ?? 'Apache-2.0',
    source: manifest?.source ?? 'hand-curated seed pack for pipeline validation',
    surnames: readJson<SurnameEntry[]>('surnames.json', dir),
    chars: readJson<CharEntry[]>('chars.json', dir),
    givenNames: readJson<GivenEntry[]>('given-names.json', dir),
    givenNamesByEra: {
      ...(existsSync(new URL('given-names-by-era.json', dir))
        ? readJson<SeedPack['givenNamesByEra']>('given-names-by-era.json', dir)
        : {}),
      ...(extra?.xianxia ? { xianxia: extra.xianxia } : {}),
    },
    givenNamesByStyle: extra?.['写意'] ? { 写意: extra['写意'] } : undefined,
    femaleGivenNamesByEra: {
      ...(existsSync(new URL('female-given-names-by-era.json', dir))
        ? readJson<SeedPack['femaleGivenNamesByEra']>('female-given-names-by-era.json', dir)
        : {}),
      ...(extra?.xianxiaFemale ? { xianxia: extra.xianxiaFemale } : {}),
    },
    femaleGivenNamesByStyle: extra?.writeyiFemale ? { 写意: extra.writeyiFemale } : undefined,
    generations: readJson<GenerationPreset[]>('generations.json', dir),
    allusions: existsSync(new URL('allusions.json', dir))
      ? readJson<Record<string, AllusionEntry[]>>('allusions.json', dir)
      : {},
    artifacts: readJson<ArtifactPack>('artifacts.json', dir),
    sects: readJson<SectPack>('sects.json', dir),
    pills: readJson<PillPack>('pills.json', dir),
    techniques: readJson<TechniquePack>('techniques.json', dir),
    blacklist: readJson<string[]>('blacklist.json', dir),
    famous: readJson<string[]>('famous.json', dir),
    collision: existsSync(new URL('collision.json', dir))
      ? readJson<string[]>('collision.json', dir)
      : [],
  };
  validatePack(pack);
  cache.set(packId, pack);
  return pack;
}

export function loadSeedPack(): SeedPack {
  return loadPack(DEFAULT_PACK);
}

export interface PackInfo {
  id: string;
  version: string;
  license: string;
}

export function availablePacks(): PackInfo[] {
  const out: PackInfo[] = [];
  for (const id of PACK_IDS) {
    try {
      const pack = loadPack(id);
      out.push({ id: pack.id, version: pack.version, license: pack.license });
    } catch {
      // 本地未构建的包不展示
    }
  }
  return out;
}

export function defaultPackId(): string {
  return DEFAULT_PACK;
}
