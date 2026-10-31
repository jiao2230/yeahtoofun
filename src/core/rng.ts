const MASK64 = (1n << 64n) - 1n;
const GOLDEN = 0x9e3779b97f4a7c15n;

export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function seedFrom(input: number | string | undefined): number {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Math.trunc(input) >>> 0;
  }
  if (typeof input === 'string' && input.length > 0) {
    return hashString(input);
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function seedForItem(seed: number, index: number): number {
  let x = (BigInt(seed >>> 0) ^ (BigInt(index) * GOLDEN)) & MASK64;
  x = (x + GOLDEN) & MASK64;
  let z = x;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  z = z ^ (z >> 31n);
  return Number((z >> 32n) & 0xffffffffn) >>> 0;
}

export class Rng {
  private state: bigint;

  constructor(seed: number) {
    this.state = BigInt(seed >>> 0);
  }

  nextUint32(): number {
    this.state = (this.state + GOLDEN) & MASK64;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    z = z ^ (z >> 31n);
    return Number((z >> 32n) & 0xffffffffn) >>> 0;
  }

  next(): number {
    return this.nextUint32() / 0x100000000;
  }

  int(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[this.int(items.length)];
  }

  weightedPick<T>(items: readonly T[], weightOf: (item: T) => number): T {
    if (items.length === 0) throw new Error('Rng.weightedPick: empty array');
    let total = 0;
    for (const item of items) {
      const w = weightOf(item);
      if (Number.isFinite(w) && w > 0) total += w;
    }
    if (total <= 0) return this.pick(items);
    let roll = this.next() * total;
    for (const item of items) {
      const w = weightOf(item);
      if (!Number.isFinite(w) || w <= 0) continue;
      roll -= w;
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}

export function profileHash(profile: unknown): string {
  return `fnv1a:${hashString(canonicalJson(profile)).toString(16).padStart(8, '0')}`;
}
