import { checkName } from './core/check.ts';
import { generateArtifacts } from './core/artifact.ts';
import { generateSects } from './core/sect.ts';
import { generatePills } from './core/pill.ts';
import { generate, generateBatch } from './core/generator.ts';
import type {
  ArtifactName,
  CheckReport,
  PersonName,
  PillName,
  PillOptions,
  Profile,
  SectName,
  SectOptions,
  SeedPack,
} from './core/types.ts';

export type * from './core/types.ts';

declare const fetch: (
  input: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface BrowserGenerator {
  pack: SeedPack;
  generate(profile?: Profile): PersonName;
  generateBatch(profile?: Profile): PersonName[];
  check(name: string): CheckReport;
  artifacts(options?: { count?: number; seed?: number | string }): ArtifactName[];
  sects(options?: SectOptions): SectName[];
  pills(options?: PillOptions): PillName[];
}

/** Browser SDK：不读文件、不发网络请求，只使用传入的 pack。 */
export function createGenerator(pack: SeedPack): BrowserGenerator {
  if (!pack || !pack.id || !Array.isArray(pack.chars)) {
    throw new Error('E_PACK_INVALID: 需要传入已加载的 pack 对象');
  }
  return {
    pack,
    generate: (profile = {}) => generate(profile, pack),
    generateBatch: (profile = {}) => generateBatch(profile, pack),
    check: (name) => checkName(name, pack),
    artifacts: (options = {}) => generateArtifacts(options, pack),
    sects: (options = {}) => generateSects(options, pack),
    pills: (options = {}) => generatePills(options, pack),
  };
}

/** 从静态文件或 API 读取 pack；适用于浏览器静态部署。 */
export async function loadPack(url: string, headers: Record<string, string> = {}): Promise<SeedPack> {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`E_PACK_FETCH: HTTP ${response.status}`);
  const payload = (await response.json()) as SeedPack | { data?: SeedPack };
  return (payload as { data?: SeedPack }).data ?? (payload as SeedPack);
}
