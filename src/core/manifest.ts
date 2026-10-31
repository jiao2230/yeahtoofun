import type { SeedPack } from './types.ts';

export function packManifest(pack: SeedPack): Record<string, string> {
  return { [pack.id]: pack.version };
}
