import { loadSeedPack } from './core/data.ts';
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
export { loadSeedPack } from './core/data.ts';
export { generate, generateBatch, resolveProfile } from './core/generator.ts';
export { checkName } from './core/check.ts';
export { generateArtifacts } from './core/artifact.ts';
export { generateSects } from './core/sect.ts';
export { generatePills } from './core/pill.ts';

export interface CreateGeneratorOptions {
  /** 已加载的 pack；省略时读取 MINGLU_PACK（默认 seed）。 */
  pack?: SeedPack;
}

export interface Generator {
  pack: SeedPack;
  generate(profile?: Profile): PersonName;
  generateBatch(profile?: Profile): PersonName[];
  check(name: string): CheckReport;
  artifacts(options?: { count?: number; seed?: number | string }): ArtifactName[];
  sects(options?: SectOptions): SectName[];
  pills(options?: PillOptions): PillName[];
}

/**
 * TypeScript SDK 入口。
 *
 * Node 直接运行 .ts；浏览器使用需先打包。
 * SDK 不读网络，只读本地 pack（或传入已加载的 pack）。
 */
export function createGenerator(options: CreateGeneratorOptions = {}): Generator {
  const pack = options.pack ?? loadSeedPack();
  return {
    pack,
    generate: (profile = {}) => generate(profile, pack),
    generateBatch: (profile = {}) => generateBatch(profile, pack),
    check: (name) => checkName(name, pack),
    artifacts: (artifactOptions = {}) => generateArtifacts(artifactOptions, pack),
    sects: (sectOptions = {}) => generateSects(sectOptions, pack),
    pills: (pillOptions = {}) => generatePills(pillOptions, pack),
  };
}
