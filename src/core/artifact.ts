import { packManifest } from './manifest.ts';
import { Rng, seedForItem, seedFrom } from './rng.ts';
import type { ArtifactName, ArtifactPack, SeedPack } from './types.ts';

export interface ArtifactOptions {
  count?: number;
  seed?: number | string;
}

export function generateArtifacts(
  options: ArtifactOptions,
  pack: SeedPack,
): ArtifactName[] {
  const count = Math.min(10_000, Math.max(0, Math.trunc(options.count ?? 1)));
  const baseSeed = seedFrom(options.seed);
  const artifacts: ArtifactName[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    let artifact: ArtifactName | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const seed = seedForItem(baseSeed, i + attempt * 1_000_003);
      const candidate = generateOne(seed, pack);
      if (pack.artifacts.blacklist.includes(candidate.name)) continue;
      if (seen.has(candidate.name)) continue;
      artifact = candidate;
      break;
    }
    if (!artifact) {
      const seed = seedForItem(baseSeed, i + 9_000_019);
      artifact = generateOne(seed, pack);
      artifact.warnings.push({ code: 'duplicate_relaxed', message: '多次重掷仍重复，已放宽' });
    }
    seen.add(artifact.name);
    artifacts.push(artifact);
  }
  return artifacts;
}

function generateOne(seed: number, pack: SeedPack): ArtifactName {
  const rng = new Rng(seed);
  const { modifiers, forms } = pack.artifacts;
  const modifier = rng.weightedPick(modifiers, (m) => m.weight);
  const form = rng.weightedPick(forms, (f) => f.weight);
  let name = `${modifier.text}${form.text}`;
  const warnings: ArtifactName['warnings'] = [];

  if (pack.artifacts.blacklist.includes(name)) {
    warnings.push({ code: 'artifact_blacklist', message: '与内置真实/专有法宝名冲突' });
  }

  return {
    schemaVersion: '1.0',
    name,
    modifier: modifier.text,
    modifierKind: modifier.kind,
    form: form.text,
    tags: [modifier.kind, form.text],
    score: Number((0.6 + rng.next() * 0.3).toFixed(4)),
    seed,
    warnings,
    pack: packManifest(pack),
    license: pack.license,
  };
}

export function artifactParts(pack: SeedPack): ArtifactPack {
  return pack.artifacts;
}
