import { existsSync, readFileSync } from 'node:fs';
import type {
  AllusionEntry,
  ArtifactPack,
  CharEntry,
  GenerationPreset,
  GivenEntry,
  SectPack,
  SeedPack,
  SurnameEntry,
} from './types.ts';

interface PackManifest {
  id: string;
  version: string;
  license: string;
  source: string;
}

const PACK_NAME = (process.env.MINGLU_PACK ?? 'seed').trim() || 'seed';
const DATA_DIR =
  PACK_NAME === 'seed'
    ? new URL('../../data/seed/', import.meta.url)
    : new URL(`../../data/packs/${PACK_NAME}/`, import.meta.url);

function readJson<T>(name: string): T {
  const url = new URL(name, DATA_DIR);
  if (!existsSync(url)) {
    throw new Error(
      `E_PACK_MISSING: ${url.pathname}；seed 请用 MINGLU_PACK=seed，真实包请先运行 tools/build_pack.py`,
    );
  }
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

let cached: SeedPack | null = null;

export function loadSeedPack(): SeedPack {
  if (cached) return cached;
  const manifest = existsSync(new URL('pack.json', DATA_DIR))
    ? readJson<PackManifest>('pack.json')
    : null;
  cached = {
    id: manifest?.id ?? 'seed',
    version: manifest?.version ?? '0.1.0',
    license: manifest?.license ?? 'Apache-2.0',
    source: manifest?.source ?? 'hand-curated seed pack for pipeline validation',
    surnames: readJson<SurnameEntry[]>('surnames.json'),
    chars: readJson<CharEntry[]>('chars.json'),
    givenNames: readJson<GivenEntry[]>('given-names.json'),
    generations: readJson<GenerationPreset[]>('generations.json'),
    allusions: existsSync(new URL('allusions.json', DATA_DIR))
      ? readJson<Record<string, AllusionEntry[]>>('allusions.json')
      : {},
    artifacts: readJson<ArtifactPack>('artifacts.json'),
    sects: readJson<SectPack>('sects.json'),
    blacklist: readJson<string[]>('blacklist.json'),
    famous: readJson<string[]>('famous.json'),
    collision: existsSync(new URL('collision.json', DATA_DIR))
      ? readJson<string[]>('collision.json')
      : [],
  };
  return cached as SeedPack;
}
