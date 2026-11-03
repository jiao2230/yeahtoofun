// src/core/check.ts
var collisionCache = /* @__PURE__ */ new WeakMap();
function collisionSet(pack) {
  let set = collisionCache.get(pack);
  if (!set) {
    set = new Set(pack.collision);
    collisionCache.set(pack, set);
  }
  return set;
}
function checkName(raw, pack) {
  const name = raw.trim();
  const warnings = [];
  const collisions = [];
  if (!name) {
    return {
      name,
      valid: false,
      warnings: [{ code: "empty", message: "\u540D\u5B57\u4E3A\u7A7A" }],
      collisions
    };
  }
  if (!/^[\u4e00-\u9fa5]+$/.test(name)) {
    warnings.push({ code: "non_han", message: "\u5305\u542B\u975E\u6C49\u5B57\u5B57\u7B26" });
  }
  if (name.length < 2 || name.length > 8) {
    warnings.push({ code: "length", message: "\u59D3\u540D\u957F\u5EA6\u5E94\u4E3A 2\u20138 \u5B57\uFF08\u957F\u59D3\u6700\u591A 6 \u5B57 + \u53CC\u540D\uFF09" });
  }
  const surname = splitSurname(name, pack);
  const given = name.slice(surname.length);
  if (!given) warnings.push({ code: "no_given", message: "\u7F3A\u5C11\u540D" });
  for (const char of name) {
    if (!pack.chars.some((c) => c.char === char) && !pack.surnames.some((s) => s.text.includes(char))) {
      warnings.push({
        code: "char_outside_table",
        message: `\u5B57\u7B26\u300C${char}\u300D\u4E0D\u5728\u79CD\u5B50\u5B57\u8868/\u59D3\u6C0F\u8868\u5185`
      });
    }
  }
  if (pack.blacklist.includes(name)) {
    warnings.push({ code: "blacklist", message: "\u547D\u4E2D\u9ED1\u540D\u5355\u8BCD" });
    collisions.push(name);
  }
  if (given.length === 2 && pack.blacklist.includes(given)) {
    warnings.push({ code: "blacklist", message: "\u540D\u547D\u4E2D\u9ED1\u540D\u5355\u8BCD" });
    collisions.push(given);
  }
  if (pack.famous.includes(name)) {
    warnings.push({ code: "famous_collision", message: "\u4E0E\u5185\u7F6E\u5386\u53F2\u540D\u4EBA\u91CD\u540D" });
    collisions.push(name);
  }
  if (collisionSet(pack).has(name)) {
    warnings.push({ code: "historical_collision", message: "\u4E0E CBDB \u5386\u53F2\u4EBA\u7269\u59D3\u540D\u5B8C\u5168\u76F8\u540C" });
    collisions.push(name);
  }
  return {
    name,
    valid: !warnings.some(
      (w) => ["empty", "non_han", "length", "blacklist"].includes(w.code)
    ),
    warnings,
    collisions: [...new Set(collisions)]
  };
}
function splitSurname(name, pack) {
  const compounds = pack.surnames.filter((s) => s.compound).map((s) => s.text).sort((a, b) => b.length - a.length);
  for (const compound of compounds) {
    if (name.startsWith(compound)) return compound;
  }
  return name.slice(0, 1);
}

// src/core/manifest.ts
function packManifest(pack) {
  return { [pack.id]: pack.version };
}

// src/core/rng.ts
var MASK64 = (1n << 64n) - 1n;
var GOLDEN = 0x9e3779b97f4a7c15n;
function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function seedFrom(input) {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.trunc(input) >>> 0;
  }
  if (typeof input === "string" && input.length > 0) {
    return hashString(input);
  }
  return (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0;
}
function seedForItem(seed, index) {
  let x = (BigInt(seed >>> 0) ^ BigInt(index) * GOLDEN) & MASK64;
  x = x + GOLDEN & MASK64;
  let z = x;
  z = (z ^ z >> 30n) * 0xbf58476d1ce4e5b9n & MASK64;
  z = (z ^ z >> 27n) * 0x94d049bb133111ebn & MASK64;
  z = z ^ z >> 31n;
  return Number(z >> 32n & 0xffffffffn) >>> 0;
}
var Rng = class {
  state;
  constructor(seed) {
    this.state = BigInt(seed >>> 0);
  }
  nextUint32() {
    this.state = this.state + GOLDEN & MASK64;
    let z = this.state;
    z = (z ^ z >> 30n) * 0xbf58476d1ce4e5b9n & MASK64;
    z = (z ^ z >> 27n) * 0x94d049bb133111ebn & MASK64;
    z = z ^ z >> 31n;
    return Number(z >> 32n & 0xffffffffn) >>> 0;
  }
  next() {
    return this.nextUint32() / 4294967296;
  }
  int(maxExclusive) {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }
  pick(items) {
    if (items.length === 0) throw new Error("Rng.pick: empty array");
    return items[this.int(items.length)];
  }
  weightedPick(items, weightOf) {
    if (items.length === 0) throw new Error("Rng.weightedPick: empty array");
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
};
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }
  const record = value;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(",")}}`;
}
function profileHash(profile) {
  return `fnv1a:${hashString(canonicalJson(profile)).toString(16).padStart(8, "0")}`;
}

// src/core/artifact.ts
function generateArtifacts(options, pack) {
  const count = Math.min(1e4, Math.max(0, Math.trunc(options.count ?? 1)));
  const baseSeed = seedFrom(options.seed);
  const artifacts = [];
  const seen = /* @__PURE__ */ new Set();
  for (let i = 0; i < count; i++) {
    let artifact = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const seed = seedForItem(baseSeed, i + attempt * 1000003);
      const candidate = generateOne(seed, pack);
      if (pack.artifacts.blacklist.includes(candidate.name)) continue;
      if (seen.has(candidate.name)) continue;
      artifact = candidate;
      break;
    }
    if (!artifact) {
      const seed = seedForItem(baseSeed, i + 9000019);
      artifact = generateOne(seed, pack);
      artifact.warnings.push({ code: "duplicate_relaxed", message: "\u591A\u6B21\u91CD\u63B7\u4ECD\u91CD\u590D\uFF0C\u5DF2\u653E\u5BBD" });
    }
    seen.add(artifact.name);
    artifacts.push(artifact);
  }
  return artifacts;
}
function generateOne(seed, pack) {
  const rng = new Rng(seed);
  const { modifiers, forms } = pack.artifacts;
  const modifier = rng.weightedPick(modifiers, (m) => m.weight);
  const form = rng.weightedPick(forms, (f) => f.weight);
  let name = `${modifier.text}${form.text}`;
  const warnings = [];
  if (pack.artifacts.blacklist.includes(name)) {
    warnings.push({ code: "artifact_blacklist", message: "\u4E0E\u5185\u7F6E\u771F\u5B9E/\u4E13\u6709\u6CD5\u5B9D\u540D\u51B2\u7A81" });
  }
  return {
    schemaVersion: "1.0",
    name,
    modifier: modifier.text,
    modifierKind: modifier.kind,
    form: form.text,
    tags: [modifier.kind, form.text],
    score: Number((0.6 + rng.next() * 0.3).toFixed(4)),
    seed,
    warnings,
    pack: packManifest(pack),
    license: pack.license
  };
}

// src/core/sect.ts
var DEFAULT_COUNT = 5;
var MAX_COUNT = 1e4;
function generateSects(options = {}, pack) {
  const count = Math.min(MAX_COUNT, Math.max(0, Math.trunc(options.count ?? DEFAULT_COUNT)));
  if (count === 0) return [];
  const alignment = options.alignment ?? "any";
  const prefixes = alignment === "any" ? pack.sects.prefixes : pack.sects.prefixes.filter((prefix) => prefix.alignment === alignment);
  if (prefixes.length === 0) {
    throw new Error(`E_SECT_ALIGNMENT: \u6CA1\u6709\u300C${alignment}\u300D\u9635\u8425\u7684\u524D\u7F00`);
  }
  const suffixes = pack.sects.suffixes.filter(
    (suffix) => !(alignment === "\u6B63\u9053" && suffix.text === "\u6559")
  );
  if (suffixes.length === 0) throw new Error("E_SECT_PACK: \u5B97\u95E8\u540E\u7F00\u4E3A\u7A7A");
  const baseSeed = seedFrom(options.seed);
  const sects = [];
  const seen = /* @__PURE__ */ new Set();
  for (let i = 0; i < count; i++) {
    let sect = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const seed = seedForItem(baseSeed, i + attempt * 1000003);
      const candidate = generateOne2(seed, pack, prefixes, suffixes);
      if (pack.sects.blacklist.includes(candidate.fullName)) continue;
      if (seen.has(candidate.fullName)) continue;
      sect = candidate;
      break;
    }
    if (!sect) {
      const seed = seedForItem(baseSeed, i + 9000019);
      sect = generateOne2(seed, pack, prefixes, suffixes);
      sect.warnings.push({ code: "duplicate_relaxed", message: "\u591A\u6B21\u91CD\u63B7\u4ECD\u91CD\u590D\uFF0C\u5DF2\u653E\u5BBD" });
    }
    seen.add(sect.fullName);
    sects.push(sect);
  }
  return sects;
}
function generateOne2(seed, pack, prefixes, suffixes) {
  const rng = new Rng(seed);
  const prefix = rng.weightedPick(prefixes, (item) => item.weight);
  const suffixPool = suffixes.filter(
    (item) => !(prefix.alignment === "\u6B63\u9053" && item.text === "\u6559")
  );
  const suffix = rng.weightedPick(suffixPool, (item) => {
    let weight = item.weight;
    if (item.alignment === prefix.alignment) weight += 2;
    if (item.text === "\u6559" && prefix.alignment === "\u9B54\u9053") weight += 2;
    if (item.text === "\u5B97" && prefix.alignment === "\u6B63\u9053") weight += 1;
    return weight;
  });
  const fullName = `${prefix.text}${suffix.text}`;
  const warnings = [];
  if (pack.sects.blacklist.includes(fullName)) {
    warnings.push({ code: "sect_blacklist", message: "\u4E0E\u5185\u7F6E\u771F\u5B9E/\u4E13\u6709\u5B97\u95E8\u540D\u51B2\u7A81" });
  }
  const alignmentBonus = prefix.alignment === suffix.alignment ? 0.08 : 0;
  const cultBonus = suffix.text === "\u6559" && prefix.alignment === "\u9B54\u9053" ? 0.05 : 0;
  const score = Number(Math.min(1, 0.55 + rng.next() * 0.3 + alignmentBonus + cultBonus).toFixed(4));
  const tags = [.../* @__PURE__ */ new Set([prefix.alignment, prefix.tone, ...prefix.tags])];
  const note = prefix.note ? `${prefix.note}\u3002` : "";
  return {
    schemaVersion: "1.0",
    fullName,
    prefix: prefix.text,
    suffix: suffix.text,
    alignment: prefix.alignment,
    tone: prefix.tone,
    tags,
    description: `${fullName}\uFF1A${prefix.alignment}\u52BF\u529B\uFF0C\u6C14\u8D28${prefix.tone}\u3002${note}`,
    score,
    seed,
    warnings,
    pack: packManifest(pack),
    license: pack.license
  };
}

// src/core/slot.ts
function slotConflict(a, b) {
  if (!a || !b) return null;
  if (a === b) return "exact";
  if (a[0] === b[0]) return "prefix";
  const left = new Set(Array.from(a));
  return Array.from(b).some((char) => left.has(char)) ? "overlap" : null;
}
function slotPenalty(conflict) {
  if (conflict === "exact") return 0.2;
  if (conflict === "prefix") return 0.15;
  if (conflict === "overlap") return 0.06;
  return 0;
}
function isBlockedConflict(conflict) {
  return conflict === "exact" || conflict === "prefix";
}

// src/core/pill.ts
var DEFAULT_COUNT2 = 5;
var MAX_COUNT2 = 1e4;
var HIGH_GRADE_CHANCE = 0.3;
function generatePills(options = {}, pack) {
  const count = Math.min(MAX_COUNT2, Math.max(0, Math.trunc(options.count ?? DEFAULT_COUNT2)));
  if (count === 0) return [];
  const kind = options.kind ?? "any";
  if (kind === "\u5929\u5730") {
    throw new Error("E_PILL_KIND: \u5929\u5730\u662F\u4FEE\u9970\u8BCD\u7C7B\u522B\uFF0C\u4E0D\u662F\u529F\u6548\uFF1B\u53EF\u9009\u7A81\u7834/\u7597\u4F24/\u6DEC\u4F53/\u795E\u9B42/\u901A\u7528/\u6BD2");
  }
  const suffixText = options.suffix ?? "any";
  const mode = options.mode ?? "any";
  if (!["function", "high", "poison", "any"].includes(mode)) {
    throw new Error("E_PILL_MODE: --mode \u53EA\u652F\u6301 function/high/poison/any");
  }
  const poisonMode = mode === "poison" || kind === "\u6BD2";
  const effectiveMode = poisonMode ? "poison" : mode === "any" && kind !== "any" ? "function" : mode;
  const modifiers = pack.pills.modifiers;
  const cores = pack.pills.cores.filter((core) => kind === "any" || core.kind === kind);
  const suffixes = pack.pills.suffixes.filter(
    (suffix) => suffixText === "any" || suffix.text === suffixText
  );
  const highModifiers = pack.pills.highModifiers;
  if (modifiers.length === 0) throw new Error("E_PILL_PACK: \u4FEE\u9970\u8BCD\u4E3A\u7A7A");
  if (!poisonMode && cores.length === 0) throw new Error(`E_PILL_KIND: \u6CA1\u6709\u300C${kind}\u300D\u529F\u6548`);
  if (suffixes.length === 0) throw new Error(`E_PILL_SUFFIX: \u672A\u77E5\u540E\u7F00\u300C${suffixText}\u300D`);
  if (highModifiers.length === 0) throw new Error("E_PILL_PACK: \u9AD8\u7EA7\u4FEE\u9970\u8BCD\u4E3A\u7A7A");
  if (poisonMode && (pack.pills.poisonHeads.length === 0 || pack.pills.poisonTargets.length === 0)) {
    throw new Error("E_PILL_PACK: \u6BD2\u4E39\u5B57\u8868\u4E3A\u7A7A");
  }
  const baseSeed = seedFrom(options.seed);
  const pills = [];
  const seen = /* @__PURE__ */ new Set();
  for (let i = 0; i < count; i++) {
    let pill = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const seed = seedForItem(baseSeed, i + attempt * 1000003);
      const candidate = generateOne3(seed, pack, modifiers, cores, highModifiers, suffixes, effectiveMode);
      if (pack.pills.blacklist.includes(candidate.fullName)) continue;
      if (seen.has(candidate.fullName)) continue;
      pill = candidate;
      break;
    }
    if (!pill) {
      const seed = seedForItem(baseSeed, i + 9000019);
      pill = generateOne3(seed, pack, modifiers, cores, highModifiers, suffixes, effectiveMode);
      pill.warnings.push({ code: "duplicate_relaxed", message: "\u591A\u6B21\u91CD\u63B7\u4ECD\u91CD\u590D\uFF0C\u5DF2\u653E\u5BBD" });
    }
    seen.add(pill.fullName);
    pills.push(pill);
  }
  return pills;
}
function generateOne3(seed, pack, modifiers, cores, highModifiers, suffixes, requestedMode) {
  const rng = new Rng(seed);
  if (requestedMode === "poison") {
    return generatePoison(seed, pack, rng, suffixes);
  }
  const high = requestedMode === "high" || requestedMode === "any" && rng.next() < HIGH_GRADE_CHANCE;
  return high ? generateHighGrade(seed, pack, rng, modifiers, highModifiers, suffixes) : generateFunction(seed, pack, rng, modifiers, cores, suffixes);
}
function generatePoison(seed, pack, rng, suffixes) {
  const head = rng.pick(pack.pills.poisonHeads);
  const target = rng.pick(pack.pills.poisonTargets);
  const core = `${head}${target}`;
  const suffixPool = suffixes.filter((item) => item.text !== core);
  const suffix = rng.weightedPick(suffixPool, (item) => item.weight);
  return {
    schemaVersion: "1.0",
    fullName: `${core}${suffix.text}`,
    mode: "poison",
    tier: "\u6BD2",
    modifier: "",
    core,
    suffix: suffix.text,
    kind: "\u6BD2",
    tags: ["\u6BD2", "\u6BD2\u4E39", suffix.text],
    description: `\u4EE5\u300C${head}\u300D\u4E4B\u6027\u4FB5\u300C${target}\u300D\uFF0C\u70BC\u4E3A\u6BD2${suffix.text}\u3002`,
    score: Number((0.6 + rng.next() * 0.3).toFixed(4)),
    seed,
    warnings: [],
    pack: packManifest(pack),
    license: pack.license
  };
}
function generateFunction(seed, pack, rng, modifiers, cores, suffixes) {
  const modifierPool = modifiers.filter((item) => item.text.length === 2);
  const modifier = rng.next() < 0.65 ? rng.weightedPick(
    modifierPool.length > 0 ? modifierPool : modifiers,
    (item) => item.weight
  ) : { text: "", kind: "\u5929\u5730", weight: 1 };
  let core = rng.weightedPick(cores, (item) => item.weight);
  const coreConflict = slotConflict(modifier.text, core.text);
  if (isBlockedConflict(coreConflict)) {
    const alternatives = cores.filter((item) => !isBlockedConflict(slotConflict(modifier.text, item.text)));
    if (alternatives.length === 0) {
      throw new Error("E_PILL_SLOT_DUPLICATE: \u4FEE\u9970\u8BCD\u4E0E\u529F\u6548\u4E0D\u80FD\u540C\u8BCD\u6216\u540C\u9996\u5B57");
    }
    core = rng.weightedPick(alternatives, (item) => item.weight);
  }
  const finalCoreConflict = slotConflict(modifier.text, core.text);
  const forbidden = /* @__PURE__ */ new Set([modifier.text, core.text]);
  const suffixPool = suffixes.filter(
    (item) => !forbidden.has(item.text) && suffixAllowed(core.kind, item.text)
  );
  if (suffixPool.length === 0) {
    throw new Error("E_PILL_SLOT_DUPLICATE: \u6CA1\u6709\u53EF\u7528\u540E\u7F00\uFF08\u4FEE\u9970\u8BCD/\u529F\u6548\u4E0D\u80FD\u4E0E\u540E\u7F00\u540C\u8BCD\uFF09");
  }
  const suffix = rng.weightedPick(suffixPool, (item) => weightedSuffix(item, modifier.kind, core.kind));
  const fullName = `${modifier.text}${core.text}${suffix.text}`;
  const tags = [core.kind, modifier.text ? "\u4FEE\u9970" : "\u65E0\u4FEE\u9970", suffix.text];
  return {
    schemaVersion: "1.0",
    fullName,
    mode: "function",
    tier: "\u666E\u901A",
    modifier: modifier.text,
    core: core.text,
    suffix: suffix.text,
    kind: core.kind,
    tags,
    description: modifier.text ? `\u4EE5\u300C${modifier.text}\u300D\u4E3A\u5F15\uFF0C\u4E3B\u300C${core.text}\u300D\uFF0C\u70BC\u4E3A${suffix.text}\u3002` : `\u4EE5\u300C${core.text}\u300D\u4E3A\u4E3B\uFF0C\u70BC\u4E3A${suffix.text}\u3002`,
    score: Number(
      Math.max(
        0,
        0.55 + rng.next() * 0.3 + compatibilityBonus(modifier.kind, core.kind) - slotPenalty(finalCoreConflict)
      ).toFixed(4)
    ),
    seed,
    warnings: [],
    pack: packManifest(pack),
    license: pack.license
  };
}
function generateHighGrade(seed, pack, rng, modifiers, highModifiers, suffixes) {
  const firstPool = modifiers.filter((item) => item.text.length === 2);
  const first = rng.weightedPick(firstPool.length > 0 ? firstPool : modifiers, (item) => item.weight);
  const secondPool = highModifiers.filter(
    (item) => !isBlockedConflict(slotConflict(first.text, item.text))
  );
  if (secondPool.length === 0) {
    throw new Error("E_PILL_SLOT_DUPLICATE: \u6CA1\u6709\u53EF\u7528\u7684\u9AD8\u7EA7\u4FEE\u9970\u8BCD");
  }
  const second = rng.weightedPick(secondPool, (item) => item.weight);
  const modifierConflict = slotConflict(first.text, second.text);
  const forbidden = /* @__PURE__ */ new Set([first.text, second.text]);
  const suffixPool = suffixes.filter((item) => !forbidden.has(item.text));
  if (suffixPool.length === 0) throw new Error("E_PILL_SLOT_DUPLICATE: \u6CA1\u6709\u53EF\u7528\u540E\u7F00");
  const suffix = rng.weightedPick(suffixPool, (item) => item.weight + (item.text === "\u4E39" ? 4 : 0));
  const fullName = `${first.text}${second.text}${suffix.text}`;
  return {
    schemaVersion: "1.0",
    fullName,
    mode: "high",
    tier: "\u9AD8\u7EA7",
    modifier: first.text,
    core: second.text,
    suffix: suffix.text,
    kind: "\u901A\u7528",
    tags: ["\u9AD8\u7EA7", "\u53CC\u4FEE\u9970", suffix.text],
    description: `\u4EE5\u300C${first.text}\u300D\u4E3A\u57FA\uFF0C\u5408\u300C${second.text}\u300D\uFF0C\u70BC\u4E3A\u9AD8\u7EA7${suffix.text}\u3002`,
    score: Number(
      Math.max(0, 0.78 + rng.next() * 0.18 - slotPenalty(modifierConflict)).toFixed(4)
    ),
    seed,
    warnings: [],
    pack: packManifest(pack),
    license: pack.license
  };
}
function weightedSuffix(item, modifierKind, coreKind) {
  let weight = item.weight;
  if (item.preferred.includes(modifierKind)) weight += 2;
  if (item.preferred.includes(coreKind)) weight += 2;
  if (item.text === "\u4E39") weight += 1;
  return weight;
}
function compatibilityBonus(modifierKind, coreKind) {
  return modifierKind === coreKind ? 0.08 : 0;
}
function suffixAllowed(kind, suffix) {
  if (suffix === "\u4E39") return true;
  if (kind === "\u901A\u7528") return suffix === "\u818F" || suffix === "\u6563" || suffix === "\u9732";
  if (kind === "\u7A81\u7834") return suffix === "\u6563";
  if (kind === "\u7597\u4F24") return suffix === "\u818F" || suffix === "\u6563" || suffix === "\u9732";
  if (kind === "\u6DEC\u4F53") return suffix === "\u818F";
  if (kind === "\u795E\u9B42") return suffix === "\u6563";
  return true;
}

// src/core/technique.ts
var DEFAULT_COUNT3 = 5;
var MAX_COUNT3 = 1e4;
var DEGREE_MIDDLES = /* @__PURE__ */ new Set([
  "\u9547\u5C71",
  "\u5F52\u5143",
  "\u51DD\u795E",
  "\u517B\u6C14",
  "\u6DEC\u4F53",
  "\u901A\u8109",
  "\u5B88\u4E00",
  "\u8FD8\u865A",
  "\u5408\u9053",
  "\u5468\u5929",
  "\u7384\u5173",
  "\u7D2B\u5E9C",
  "\u7ED3\u4E39",
  "\u5316\u5A74",
  "\u6555\u96F7",
  "\u5FA1\u9706",
  "\u805A\u7075",
  "\u517B\u9B42",
  "\u70BC\u9B44",
  "\u65E0\u76F8"
]);
var DEGREE_ONE_MIDDLES = /* @__PURE__ */ new Set([
  "\u9547\u5C71",
  "\u5468\u5929",
  "\u7384\u5173",
  "\u7D2B\u5E9C",
  "\u6555\u96F7",
  "\u5FA1\u9706",
  "\u5F52\u5143",
  "\u65E0\u76F8"
]);
function generateTechniques(options = {}, pack) {
  const count = Math.min(MAX_COUNT3, Math.max(0, Math.trunc(options.count ?? DEFAULT_COUNT3)));
  if (count === 0) return [];
  const kind = options.kind ?? "any";
  const suffixText = options.suffix ?? "any";
  const heads = pack.techniques.heads.filter((head) => kind === "any" || head.kind === kind);
  const suffixes = pack.techniques.suffixes.filter(
    (suffix) => suffixText === "any" || suffix.text === suffixText
  );
  if (heads.length === 0) throw new Error(`E_TECHNIQUE_KIND: \u6CA1\u6709\u300C${kind}\u300D\u8D77\u624B\u8BCD`);
  if (suffixes.length === 0) throw new Error(`E_TECHNIQUE_SUFFIX: \u672A\u77E5\u540E\u7F00\u300C${suffixText}\u300D`);
  const baseSeed = seedFrom(options.seed);
  const techniques = [];
  const seen = /* @__PURE__ */ new Set();
  for (let i = 0; i < count; i++) {
    let technique = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const seed = seedForItem(baseSeed, i + attempt * 1000003);
      const candidate = generateOne4(seed, pack, heads, suffixes);
      if (pack.techniques.blacklist.includes(candidate.fullName)) continue;
      if (seen.has(candidate.fullName)) continue;
      technique = candidate;
      break;
    }
    if (!technique) {
      const seed = seedForItem(baseSeed, i + 9000019);
      technique = generateOne4(seed, pack, heads, suffixes);
      technique.warnings.push({ code: "duplicate_relaxed", message: "\u591A\u6B21\u91CD\u63B7\u4ECD\u91CD\u590D\uFF0C\u5DF2\u653E\u5BBD" });
    }
    seen.add(technique.fullName);
    techniques.push(technique);
  }
  return techniques;
}
function generateOne4(seed, pack, heads, suffixes) {
  const rng = new Rng(seed);
  const template = rng.next();
  const long = template < 0.4;
  const mid = !long && template < 0.7;
  let headLength = mid ? 1 : 2;
  let headPool = mid ? heads.filter((head2) => head2.kind === "\u7A0B\u5EA6") : heads;
  if (headPool.length === 0) {
    headPool = heads;
    headLength = 2;
  }
  const head = pickWithLength(rng, headPool, headLength, headLength === 2 ? 1 : 2);
  const degreeSet = head.kind === "\u7A0B\u5EA6" ? head.text.length === 1 ? DEGREE_ONE_MIDDLES : DEGREE_MIDDLES : null;
  const middlePool = degreeSet === null ? pack.techniques.middles : pack.techniques.middles.filter((item) => degreeSet.has(item.text));
  const middleCandidates = middlePool.filter(
    (item) => !isBlockedConflict(slotConflict(head.text, item.text))
  );
  const middle = long || mid ? pickWithLength(
    rng,
    middleCandidates.length > 0 ? middleCandidates : pack.techniques.middles.filter(
      (item) => !isBlockedConflict(slotConflict(head.text, item.text))
    ),
    2,
    2
  ).text : null;
  const middleConflict = slotConflict(head.text, middle);
  const forbidden = /* @__PURE__ */ new Set([head.text, ...middle ? [middle] : []]);
  const suffixPool = suffixes.filter((item) => {
    if (forbidden.has(item.text)) return false;
    if (head.kind === "\u7A0B\u5EA6" && head.text.length === 1) {
      return item.text === "\u8BC0" || item.text === "\u529F" || item.text === "\u771F\u7ECF";
    }
    return true;
  });
  if (suffixPool.length === 0) {
    throw new Error("E_TECHNIQUE_SLOT_DUPLICATE: \u6CA1\u6709\u53EF\u7528\u540E\u7F00\uFF08\u8D77\u624B/\u4E2D\u6BB5\u4E0D\u80FD\u4E0E\u540E\u7F00\u540C\u8BCD\uFF09");
  }
  const suffix = rng.weightedPick(suffixPool, (item) => {
    let weight = item.weight;
    if (middle === null) weight += item.text === "\u529F" || item.text === "\u8BC0" ? 4 : 0;
    if (head.kind === "\u7A0B\u5EA6") weight += item.text === "\u8BC0" || item.text === "\u529F" ? 2 : 0;
    if (middle !== null) weight += 1;
    return weight;
  });
  const fullName = `${head.text}${middle ?? ""}${suffix.text}`;
  const warnings = [];
  if (pack.techniques.blacklist.includes(fullName)) {
    warnings.push({ code: "technique_blacklist", message: "\u4E0E\u5185\u7F6E\u771F\u5B9E/\u4E13\u6709\u529F\u540D\u51B2\u7A81" });
  }
  const emptyBonus = middle === null && suffix.text === "\u529F" ? 0.05 : 0;
  const score = Number(
    Math.max(0, 0.55 + rng.next() * 0.3 + emptyBonus - slotPenalty(middleConflict)).toFixed(4)
  );
  const tags = [head.kind, middle === null ? "\u7A7A\u69FD" : "\u53CC\u6BB5", suffix.text];
  const middleText = middle ? `\u4E2D\u6BB5\u300C${middle}\u300D` : "\u4E2D\u6BB5\u4E3A\u7A7A\uFF08\u4E0D\u751F\u6210\u300C\u65E0\u300D\uFF09";
  return {
    schemaVersion: "1.0",
    fullName,
    head: head.text,
    middle,
    suffix: suffix.text,
    kind: head.kind,
    tags,
    description: `\u4EE5\u300C${head.text}\u300D\u8D77\u624B\uFF0C${middleText}\uFF0C\u6536\u4E8E\u300C${suffix.text}\u300D\u3002`,
    score,
    seed,
    warnings,
    pack: packManifest(pack),
    license: pack.license
  };
}
function pickWithLength(rng, items, length, fallbackLength) {
  const exact = items.filter((item) => item.text.length === length);
  if (exact.length > 0) return rng.weightedPick(exact, (item) => item.weight);
  const fallback = items.filter((item) => item.text.length === fallbackLength);
  return rng.weightedPick(fallback.length > 0 ? fallback : items, (item) => item.weight);
}

// src/core/generator.ts
var ERAS = ["qinhan", "weijin", "tangsong", "mingqing", "xianxia"];
var GENDERS = ["male", "female", "any"];
var STYLES = ["\u53F2\u5B9E", "\u5199\u610F", "\u5B97\u6559"];
var CLASSES = ["\u4FD7\u4EBA", "\u96C5\u58EB"];
var INITIALS = [
  "zh",
  "ch",
  "sh",
  "b",
  "p",
  "m",
  "f",
  "d",
  "t",
  "n",
  "l",
  "g",
  "k",
  "h",
  "j",
  "q",
  "x",
  "r",
  "z",
  "c",
  "s",
  "y",
  "w"
];
var RELIGIOUS_MALE_CHARS = ["\u9053", "\u50E7", "\u6CD5", "\u5FB7", "\u6B63", "\u5143", "\u7384", "\u627F", "\u666F", "\u5B97", "\u771F", "\u4E4B", "\u5F18", "\u4FEE", "\u609F", "\u5B50", "\u667A", "\u8D24", "\u7EAF", "\u4E2D"];
var RELIGIOUS_FEMALE_CHARS = ["\u6167", "\u9759", "\u5999", "\u5FBD", "\u5B81", "\u6E05", "\u4E91", "\u7075", "\u4ED9", "\u8D1E", "\u5143", "\u7476", "\u6148", "\u7D20", "\u5982"];
var RELIGIOUS_NAME_CHARS = [.../* @__PURE__ */ new Set([...RELIGIOUS_MALE_CHARS, ...RELIGIOUS_FEMALE_CHARS])];
var RELIGIOUS_NAME_SET = new Set(RELIGIOUS_NAME_CHARS);
var RELIGIOUS_WEAK_SINGLE = /* @__PURE__ */ new Set(["\u4E2D", "\u5B50", "\u4E4B"]);
var MIN_STYLE_CHARS = 12;
var MIN_STYLE_GIVEN = 8;
var EMPTY_SURNAME = { text: "", pinyin: "", tone: 0 };
var COLLOQUIAL_NUMERALS = ["\u5927", "\u5C0F", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D", "\u5341"];
var COLLOQUIAL_MALE_TAILS = ["\u90CE", "\u6BDB", "\u67F1", "\u6839", "\u9501", "\u86CB", "\u72D7", "\u725B", "\u9A6C", "\u767D", "\u826F", "\u751F", "\u77F3", "\u864E", "\u957F", "\u4FDD", "\u9F99", "\u65FA", "\u5B58", "\u5B89", "\u5E73", "\u5B81", "\u548C", "\u987A", "\u5B9D", "\u798F", "\u8D35", "\u8D22", "\u559C", "\u6765", "\u6709", "\u94C1"];
var COLLOQUIAL_FEMALE_TAILS = ["\u5A18", "\u4E2B", "\u82B1", "\u5170", "\u79C0", "\u82F1", "\u6843", "\u674F", "\u83CA", "\u6625", "\u6EE1", "\u7389", "\u679D", "\u6842", "\u83B2", "\u7231", "\u59B9", "\u5A23", "\u599E", "\u5A03", "\u5974", "\u5B9D", "\u798F", "\u559C", "\u6709", "\u5E73", "\u5B89", "\u5B81", "\u548C", "\u987A"];
var COLLOQUIAL_SINGLE_MALE = ["\u5927", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D", "\u5341", "\u6BDB", "\u67F1", "\u6839", "\u9501", "\u86CB", "\u72D7", "\u725B", "\u9A6C", "\u826F", "\u751F", "\u77F3", "\u864E", "\u957F", "\u4FDD", "\u9F99", "\u65FA", "\u5B58", "\u5B89", "\u798F", "\u8D35", "\u8D22", "\u559C", "\u6765", "\u6709", "\u94C1", "\u987A"];
var COLLOQUIAL_SINGLE_FEMALE = ["\u5927", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D", "\u5341", "\u5A18", "\u82B1", "\u5170", "\u79C0", "\u82F1", "\u6843", "\u674F", "\u83CA", "\u6625", "\u6EE1", "\u7389", "\u679D", "\u6842", "\u83B2", "\u7231", "\u534E", "\u79CB", "\u8273", "\u60E0", "\u8D1E"];
var COLLOQUIAL_FEMALE_SLAVE_STEMS = ["\u91D1", "\u6708", "\u7EA2", "\u9999", "\u5A07", "\u67D4", "\u5E86", "\u5B9C", "\u661F", "\u5BCC", "\u5143", "\u99A8", "\u5747"];
var COLLOQUIAL_FEMALE_A_STEMS = ["\u73CD", "\u5DE7", "\u7EA2", "\u6708", "\u9999", "\u5A07", "\u67D4", "\u5E86", "\u5B9C", "\u91D1", "\u5974"];
var COLLOQUIAL_FEMALE_REDUP = ["\u73E0", "\u62C2", "\u8885", "\u7678", "\u5DE7", "\u60DC", "\u76C8", "\u5B89", "\u7AEF", "\u601C", "\u83BA", "\u5E08", "\u8D5B"];
var ALLUSION_STOP_CHARS = new Set(
  "\u4E4B\u516E\u800C\u5176\u6240\u4EE5\u4E0D\u65E0\u6709\u4E3A\u4E0E\u5219\u4E43\u4E8E\u4E4E\u54C9\u592B\u4F55\u7136\u8005\u4E5F\u77E3\u53EF\u80FD\u5C06\u6B32\u65E2\u4EA6\u7686\u5404\u81EA\u76F8\u89C1\u4F7F\u4EE4\u4ECE\u6765\u4E0A\u53BB\u4E2D\u5916\u51FA\u524D\u540E\u5DE6\u53F3\u5927\u5C0F\u591A\u5C11\u77ED\u9AD8\u4F4E\u6211\u5C14\u6C5D\u5973\u66F0\u8C13\u662F\u4EBA\u5341\u767E\u4E07"
);
var SINGLE_RATE = {
  qinhan: 0.75,
  weijin: 0.45,
  tangsong: 0.35,
  mingqing: 0.25,
  xianxia: 0.3
};
var SINGLE_NAME_STOP = /* @__PURE__ */ new Set(["\u5C0F", "\u963F", "\u8001", "\u513F", "\u6C0F", "\u67D0", "\u5A18", "\u59D1", "\u4E2B", "\u599E", "\u5A03", "\u59B9", "\u5A23"]);
var ELEGANT_BANNED_CHARS = /* @__PURE__ */ new Set(["\u5927", "\u5C0F", "\u4E2B", "\u5A18", "\u90CE"]);
var FEMALE_NAME_BLOCKLIST = /* @__PURE__ */ new Set(["\u897F\u697C", "\u95F2\u6101", "\u9611\u73CA", "\u9EC4\u82B1", "\u5F52\u8DEF", "\u85D5\u82B1", "\u9E25\u9E6D", "\u5BD2\u8749", "\u957F\u4EAD", "\u6653\u98CE"]);
var DEFAULT_PROFILE = {
  era: "tangsong",
  gender: "any",
  style: [],
  class: "\u96C5\u58EB",
  givenLength: "auto",
  generation: null,
  restraint: 0.7,
  seed: 0,
  count: 1,
  mode: "stable"
};
function resolveProfile(input = {}) {
  const socialClass = input.class && CLASSES.includes(input.class) ? input.class : DEFAULT_PROFILE.class;
  const commoner = socialClass === "\u4FD7\u4EBA";
  const era = commoner ? DEFAULT_PROFILE.era : input.era && ERAS.includes(input.era) ? input.era : DEFAULT_PROFILE.era;
  const gender = input.gender && GENDERS.includes(input.gender) ? input.gender : DEFAULT_PROFILE.gender;
  const style = commoner ? [] : (input.style ?? []).filter((s) => STYLES.includes(s));
  const givenLength = input.givenLength === 1 || input.givenLength === 2 ? input.givenLength : "auto";
  const mode = input.mode === "diverse" ? "diverse" : "stable";
  const surname = typeof input.surname === "string" ? input.surname.trim() : void 0;
  if (surname && (!/^[\u4e00-\u9fa5]{1,6}$/.test(surname) || /[某氏]/.test(surname))) {
    throw new Error("E_SURNAME_INVALID: \u59D3\u6C0F\u53EA\u80FD\u586B 1\u20136 \u4E2A\u6C49\u5B57\uFF0C\u4E0D\u80FD\u542B\u6570\u5B57/\u5B57\u6BCD/\u7B26\u53F7\u6216\u67D0/\u6C0F\u7B49\u5360\u4F4D\u5B57");
  }
  return {
    era,
    gender,
    style,
    class: socialClass,
    surname: surname || void 0,
    givenLength,
    allusion: input.allusion === "chuci" || input.allusion === "shijing" || input.allusion === "lunyu" || input.allusion === "zhouyi" || input.allusion === "zhuangzi" || input.allusion === "tangshi" || input.allusion === "songci" || input.allusion === "all" ? input.allusion : void 0,
    generation: commoner ? null : input.generation ?? null,
    restraint: clamp(input.restraint ?? DEFAULT_PROFILE.restraint, 0, 1),
    seed: input.seed ?? (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0,
    count: normalizeCount(input.count),
    mode
  };
}
function generateOne5(input, pack, index = 0, seedOverride) {
  const profile = resolveProfile(input);
  const baseSeed = seedFrom(profile.seed);
  const seed = seedOverride ?? seedForItem(baseSeed, index);
  const rng = new Rng(seed);
  const warnings = [];
  const generation = resolveGeneration(profile, pack, warnings);
  const generationChar = generation?.char;
  const surname = pickSurname(profile, pack, rng, generationChar);
  if (generation && surname.text.includes(generation.char)) {
    throw new Error("E_GENERATION_CONFLICT: \u5B57\u8F88\u5B57\u4E0E\u59D3\u6C0F\u51B2\u7A81\uFF0C\u8BF7\u6362\u59D3\u6216\u6362\u5B57\u8F88");
  }
  const given = pickGiven(profile, pack, rng, generation, warnings, surname);
  const givenText = given.map((c) => c.text).join("");
  const fullName = surname.text + givenText;
  const allusionHits = pack.allusions[givenText];
  const allusion = profile.allusion && profile.allusion !== "all" ? allusionHits?.find((hit) => hit.corpus === profile.allusion) ?? allusionHits?.[0] : allusionHits?.[0];
  if (pack.blacklist.includes(fullName) || givenText.length === 2 && pack.blacklist.includes(givenText)) {
    warnings.push({ code: "blacklist", message: "\u547D\u4E2D\u9ED1\u540D\u5355\u8BCD\uFF1B\u5EFA\u8BAE\u91CD\u65B0\u751F\u6210" });
  }
  if (pack.famous.includes(fullName)) {
    warnings.push({ code: "famous_collision", message: "\u4E0E\u5185\u7F6E\u5386\u53F2\u540D\u4EBA\u91CD\u540D" });
  }
  const styleTags = Array.from(new Set(given.flatMap((c) => findChar(pack, c.text)?.styles ?? [])));
  const pattern = profile.class === "\u4FD7\u4EBA" ? "colloquial" : void 0;
  const score = scoreName(pack, given, rng, profile);
  return {
    schemaVersion: "1.0",
    fullName,
    surname,
    given,
    generation,
    pattern,
    allusion,
    styleTags,
    era: profile.era,
    gender: profile.gender,
    class: profile.class,
    score,
    warnings,
    seed,
    profileHash: profileHash({
      era: profile.era,
      gender: profile.gender,
      style: profile.style,
      class: profile.class,
      surname: profile.surname,
      givenLength: profile.givenLength,
      allusion: profile.allusion,
      generation: profile.generation,
      restraint: profile.restraint
    }),
    pack: packManifest(pack),
    license: pack.license,
    provenance: [`${pack.id}@${pack.version}`]
  };
}
function generate(input, pack) {
  return generateUnblocked(input, pack, 0);
}
function isBlacklisted(person) {
  return person.warnings.some((warning) => warning.code === "blacklist");
}
function generateUnblocked(input, pack, index) {
  let last = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = generateOne5(input, pack, index + attempt * 1000003);
    last = candidate;
    if (!isBlacklisted(candidate)) return candidate;
  }
  return last;
}
function generateBatch(input, pack) {
  const profile = resolveProfile(input);
  const count = profile.count;
  const baseSeed = seedFrom(profile.seed);
  const results = [];
  const seen = /* @__PURE__ */ new Set();
  const surnameCount = /* @__PURE__ */ new Map();
  const givenNameCount = /* @__PURE__ */ new Map();
  const firstCount = /* @__PURE__ */ new Map();
  const lastCount = /* @__PURE__ */ new Map();
  const maxSurname = Math.max(2, Math.floor(count * 0.12));
  const maxGivenName = Math.max(2, Math.floor(count * 0.15));
  const maxFirst = Math.max(2, Math.floor(count * 0.1));
  const maxLast = Math.max(2, Math.floor(count * 0.08));
  for (let i = 0; i < count; i++) {
    let person = null;
    const mmrPool = [];
    for (let attempt = 0; attempt < 32; attempt++) {
      const salt = attempt === 0 ? i : i + attempt * 1000003;
      const candidate = generateOne5(input, pack, salt);
      if (seen.has(candidate.fullName)) continue;
      if (isBlacklisted(candidate)) continue;
      const givenKey = candidate.given.map((c) => c.text).join("");
      if ((givenNameCount.get(givenKey) ?? 0) >= maxGivenName) continue;
      if (profile.mode === "diverse" && count >= 20) {
        const s = candidate.surname.text;
        const f2 = candidate.given[0]?.text ?? "";
        const l2 = candidate.given[candidate.given.length - 1]?.text ?? "";
        const genFirst = candidate.generation?.position === "first";
        const genLast = candidate.generation?.position === "second";
        if ((surnameCount.get(s) ?? 0) >= maxSurname) continue;
        if (!genFirst && (firstCount.get(f2) ?? 0) >= maxFirst) continue;
        if (!genLast && (lastCount.get(l2) ?? 0) >= maxLast) continue;
        mmrPool.push(candidate);
        if (mmrPool.length >= 4) break;
        continue;
      }
      person = candidate;
      break;
    }
    if (!person && mmrPool.length > 0) {
      person = pickByMmr(mmrPool, results);
    }
    if (!person) {
      person = generateUnblocked(input, pack, i + 9000019);
      person.warnings.push({ code: "duplicate_relaxed", message: "\u591A\u6B21\u91CD\u63B7\u4ECD\u91CD\u590D\uFF0C\u5DF2\u653E\u5BBD" });
      if (profile.mode === "diverse" && count >= 20) {
        person.warnings.push({ code: "quota_relaxed", message: "\u914D\u989D\u91CD\u63B7 8 \u6B21\u4ECD\u672A\u6EE1\u8DB3\uFF0C\u5DF2\u653E\u5BBD" });
      }
    }
    seen.add(person.fullName);
    surnameCount.set(person.surname.text, (surnameCount.get(person.surname.text) ?? 0) + 1);
    const f = person.given[0]?.text ?? "";
    const l = person.given[person.given.length - 1]?.text ?? "";
    givenNameCount.set(
      person.given.map((c) => c.text).join(""),
      (givenNameCount.get(person.given.map((c) => c.text).join("")) ?? 0) + 1
    );
    if (person.generation?.position !== "first") {
      firstCount.set(f, (firstCount.get(f) ?? 0) + 1);
    }
    if (person.generation?.position !== "second") {
      lastCount.set(l, (lastCount.get(l) ?? 0) + 1);
    }
    results.push(person);
  }
  return results;
}
function pickByMmr(candidates, selected) {
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const maxSimilarity = selected.reduce(
      (max, existing) => Math.max(max, similarity(candidate, existing)),
      0
    );
    const score = candidate.score - 0.15 * maxSimilarity;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
function similarity(a, b) {
  const ac = new Set(Array.from(a.given.map((c) => c.text).join("")));
  const bc = new Set(Array.from(b.given.map((c) => c.text).join("")));
  const union = /* @__PURE__ */ new Set([...ac, ...bc]);
  let overlap = 0;
  for (const ch of ac) if (bc.has(ch)) overlap++;
  const jaccard = union.size === 0 ? 0 : overlap / union.size;
  const sameSurname = a.surname.text === b.surname.text ? 0.3 : 0;
  const sameFirst = a.given[0]?.text === b.given[0]?.text ? 0.2 : 0;
  const sameLast = a.given[a.given.length - 1]?.text === b.given[b.given.length - 1]?.text ? 0.2 : 0;
  const sameTone = a.given.map((c) => c.tone).join("") === b.given.map((c) => c.tone).join("") ? 0.1 : 0;
  return jaccard * 0.2 + sameSurname + sameFirst + sameLast + sameTone;
}
function resolveGeneration(profile, pack, warnings) {
  const config = profile.generation;
  if (!config) return null;
  if (config.applyTo && config.applyTo !== "all" && config.applyTo !== profile.gender) {
    return null;
  }
  const preset = config.preset ? pack.generations.find((g) => g.id === config.preset) : void 0;
  if (config.preset && !preset) {
    throw new Error(`E_GENERATION_INVALID: unknown preset "${config.preset}"`);
  }
  const poem = normalizePoem(config.poem ?? preset?.chars ?? "");
  if (poem.length < 2 || poem.length > 40) {
    throw new Error("E_GENERATION_INVALID: \u5B57\u8F88\u8BD7\u9700\u4E3A 2\u201340 \u4E2A\u6C49\u5B57");
  }
  const index = config.index ?? 1;
  if (!Number.isInteger(index) || index < 1 || index > poem.length) {
    throw new Error(`E_GENERATION_INDEX: index ${index} \u8D8A\u754C\uFF081..${poem.length}\uFF09`);
  }
  if (profile.givenLength === 1) {
    throw new Error("E_GENERATION_CONFLICT: \u5B57\u8F88\u6A21\u5F0F\u5F3A\u5236\u53CC\u5B57\u540D");
  }
  const position = config.position ?? preset?.position ?? "first";
  const char = poem[index - 1];
  if (!pack.chars.some((c) => c.char === char)) {
    warnings.push({
      code: "generation_char_outside_table",
      message: `\u5B57\u8F88\u5B57\u300C${char}\u300D\u4E0D\u5728\u79CD\u5B50\u5B57\u8868\u5185\uFF0C\u6309\u7528\u6237\u8F93\u5165\u653E\u884C`
    });
  }
  if (preset?.id === "ming-imperial" && profile.gender === "female") {
    warnings.push({
      code: "historical_gender_mismatch",
      message: "\u660E\u7687\u5BA4\u5B57\u8F88\u901A\u5E38\u7528\u4E8E\u7537\u6027\uFF1B\u9700\u8981\u4E25\u683C\u5386\u53F2\u7528\u6CD5\u65F6\u8BBE applyTo=male"
    });
  }
  if (preset?.id === "ming-imperial" && profile.era !== "mingqing" && profile.era !== "xianxia") {
    warnings.push({
      code: "era_mismatch",
      message: "\u660E\u7687\u5BA4\u5B57\u8F88\u4E0E\u6240\u9009\u65F6\u4EE3\u4E0D\u4E00\u81F4\uFF1B\u4EC5\u63D0\u793A\uFF0C\u4E0D\u963B\u65AD"
    });
  }
  return {
    char,
    index,
    preset: preset?.id,
    poem: config.poem ? poem : void 0,
    position
  };
}
function normalizePoem(raw) {
  return raw.replace(/[^\u4e00-\u9fa5]/g, "");
}
function surnamesForEra(pack, era) {
  const pool = pack.surnames.filter((s) => !/[某氏]/.test(s.text));
  if (era === "xianxia") {
    const eligible = pool.filter(
      (s) => s.text.length <= 2 && (!s.eras || s.eras.some((tag) => tag !== "mingqing"))
    );
    return eligible.length > 0 ? eligible : pool.filter((s) => s.text.length <= 2);
  }
  const tagged = pool.filter((s) => s.eras?.includes(era));
  if (tagged.length >= 20) return tagged;
  if (era === "qinhan" || era === "weijin") {
    const singles = pool.filter((s) => s.text.length === 1);
    return [...new Map([...tagged, ...singles].map((s) => [s.text, s])).values()];
  }
  return pool.filter((s) => s.text.length <= 2);
}
function pickSurname(profile, pack, rng, generationChar) {
  if (profile.surname) {
    const known = pack.surnames.find((s) => s.text === profile.surname);
    return {
      text: profile.surname,
      pinyin: known?.pinyin ?? "",
      tone: 0,
      sources: ["user"]
    };
  }
  const surnames = surnamesForEra(pack, profile.era);
  let candidates = surnames;
  for (let attempt = 0; attempt < 6; attempt++) {
    const picked2 = rng.weightedPick(candidates, (s) => s.weight);
    if (!generationChar || !picked2.text.includes(generationChar)) {
      return { text: picked2.text, pinyin: picked2.pinyin, tone: 0, sources: [`${pack.id}:surname`] };
    }
  }
  const fallback = surnames.find((s) => !generationChar || !s.text.includes(generationChar));
  const picked = fallback ?? surnames[0];
  return { text: picked.text, pinyin: picked.pinyin, tone: 0, sources: [`${pack.id}:surname`] };
}
function pickGiven(profile, pack, rng, generation, warnings, surname) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const chars = pickGivenOnce(profile, pack, rng, generation, warnings, surname);
    const issues = phoneticIssues(EMPTY_SURNAME, chars);
    if (issues.length === 0 || attempt === 3) {
      if (issues.length > 0) {
        warnings.push({
          code: "phonetic_relaxed",
          message: `\u97F3\u5F62\u51B2\u7A81\uFF08${issues.join("/")}\uFF09\u91CD\u63B7 4 \u6B21\u4ECD\u5B58\u5728\uFF0C\u5DF2\u653E\u5BBD`
        });
      }
      return chars;
    }
  }
  return pickGivenOnce(profile, pack, rng, generation, warnings, surname);
}
function pickColloquialGiven(profile, pack, rng, surnameChars, wantSingle, warnings) {
  const available = (values) => values.filter((ch) => Boolean(findChar(pack, ch)) && !surnameChars.has(ch));
  const numerals = available(COLLOQUIAL_NUMERALS);
  const tails = profile.gender === "female" ? available(COLLOQUIAL_FEMALE_TAILS) : profile.gender === "male" ? available(COLLOQUIAL_MALE_TAILS) : available([...COLLOQUIAL_MALE_TAILS, ...COLLOQUIAL_FEMALE_TAILS]);
  const single = profile.gender === "female" ? available(COLLOQUIAL_SINGLE_FEMALE) : profile.gender === "male" ? available(COLLOQUIAL_SINGLE_MALE) : available([...COLLOQUIAL_SINGLE_MALE, ...COLLOQUIAL_SINGLE_FEMALE]);
  if (wantSingle) {
    if (single.length === 0) return null;
    return [toNameChar(pack, rng.pick(single), warnings)];
  }
  if (profile.gender === "female") {
    const slaveStems = available(COLLOQUIAL_FEMALE_SLAVE_STEMS);
    const aStems = available(COLLOQUIAL_FEMALE_A_STEMS);
    const redup = available(COLLOQUIAL_FEMALE_REDUP);
    const roll = rng.next();
    if (roll < 0.22 && slaveStems.length > 0) {
      return [toNameChar(pack, rng.pick(slaveStems), warnings), toNameChar(pack, "\u5974", warnings)];
    }
    if (roll < 0.44 && aStems.length > 0) {
      return [toNameChar(pack, "\u963F", warnings), toNameChar(pack, rng.pick(aStems), warnings)];
    }
    if (roll < 0.62 && redup.length > 0) {
      const ch = rng.pick(redup);
      return [toNameChar(pack, ch, warnings), toNameChar(pack, ch, warnings)];
    }
  }
  if (numerals.length === 0 || tails.length === 0) return null;
  let first;
  let second;
  if (numerals.length >= 2 && rng.next() < 0.25) {
    first = rng.pick(numerals);
    second = rng.pick(numerals.filter((ch) => ch !== first));
  } else {
    first = rng.pick([...numerals, "\u5927", "\u5C0F"].filter((ch) => available([ch]).length > 0));
    second = rng.pick(tails.filter((ch) => ch !== first));
  }
  if (!first || !second || first === second) return null;
  return [first, second].map((ch) => toNameChar(pack, ch, warnings));
}
function pickReligiousGiven(profile, pack, rng, surname, surnameChars, wantSingle) {
  const pool = profile.gender === "female" ? RELIGIOUS_FEMALE_CHARS : profile.gender === "male" ? RELIGIOUS_MALE_CHARS : RELIGIOUS_NAME_CHARS;
  const available = pool.filter(
    (ch) => Boolean(findChar(pack, ch)) && !surnameChars.has(ch)
  );
  if (available.length === 0) return null;
  if (wantSingle) {
    const singles = available.filter((ch) => !RELIGIOUS_WEAK_SINGLE.has(ch));
    return [toNameChar(pack, rng.pick(singles.length > 0 ? singles : available), [])];
  }
  const religious = rng.pick(available);
  const exactGender = pack.chars.filter(
    (c) => c.char !== religious && !RELIGIOUS_NAME_SET.has(c.char) && !surnameChars.has(c.char) && isElegantGivenAllowed(c.char, profile) && c.gender === profile.gender
  );
  const neutral = pack.chars.filter(
    (c) => c.char !== religious && !RELIGIOUS_NAME_SET.has(c.char) && !surnameChars.has(c.char) && isElegantGivenAllowed(c.char, profile) && c.gender === "neutral"
  );
  const companionPool = profile.gender === "any" ? pack.chars.filter(
    (c) => c.char !== religious && !RELIGIOUS_NAME_SET.has(c.char) && !surnameChars.has(c.char) && isElegantGivenAllowed(c.char, profile)
  ) : exactGender.length > 0 ? exactGender : neutral;
  if (companionPool.length === 0) return null;
  const sampled = sampleSubset(companionPool, rng, 96);
  const scored = sampled.map((entry) => ({
    item: entry.char,
    score: scoreGiven(pack, plainChars(pack, entry.char), profile)
  }));
  const companion = sampleTopK(scored, rng, 24);
  const chars = rng.next() < 0.5 ? [religious, companion] : [companion, religious];
  return chars.map((ch) => toNameChar(pack, ch, []));
}
function pickGivenOnce(profile, pack, rng, generation, warnings, surname) {
  const surnameText = surname.text;
  const surnameChars = new Set(Array.from(surnameText));
  const wantSingle = profile.givenLength === 1 || profile.givenLength === "auto" && rng.next() < SINGLE_RATE[profile.era];
  if (generation) {
    const pair = findPairWithGeneration(pack, generation, profile, rng, surname);
    if (pair && !Array.from(pair).some((c) => surnameChars.has(c))) {
      return pair.split("").map((c) => toNameChar(pack, c, warnings));
    }
    const other = pickOtherChar(pack, profile, rng, surname, generation.char, surnameChars);
    const chars = generation.position === "first" ? [generation.char, other] : [other, generation.char];
    return chars.map((c) => toNameChar(pack, c, warnings));
  }
  if (profile.style.includes("\u5B97\u6559")) {
    const religious = pickReligiousGiven(profile, pack, rng, surname, surnameChars, wantSingle);
    if (religious) return religious;
  }
  if (profile.class === "\u4FD7\u4EBA") {
    const colloquial = pickColloquialGiven(profile, pack, rng, surnameChars, wantSingle, warnings);
    if (colloquial) return colloquial;
  }
  if (profile.allusion && profile.givenLength !== 1) {
    const femaleExtras = profile.gender === "female" ? [
      ...pack.femaleGivenNamesByStyle?.["\u5199\u610F"] ?? [],
      ...pack.femaleGivenNamesByEra?.[profile.era] ?? [],
      ...pack.femaleGivenNamesByEra?.xianxia ?? []
    ] : [];
    const baseNames = [...new Map(
      [...pack.givenNames, ...givenNamesForProfile(pack, profile), ...femaleExtras].map((entry) => [entry.text, entry])
    ).values()];
    let pool2 = baseNames.filter((entry) => {
      if (entry.text.length !== 2) return false;
      const hits = pack.allusions[entry.text];
      if (!hits?.length) return false;
      if (profile.allusion !== "all" && !hits.some((hit) => hit.corpus === profile.allusion)) {
        return false;
      }
      if (entry.text[0] === entry.text[1]) return false;
      if (Array.from(entry.text).some((c) => ALLUSION_STOP_CHARS.has(c))) return false;
      if (Array.from(entry.text).some((c) => surnameChars.has(c))) return false;
      if (!isElegantGivenAllowed(entry.text, profile)) return false;
      if (isGivenCharBlocked(entry.text, pack, profile)) return false;
      if (isFemaleNameBlocked(entry.text, profile)) return false;
      if (profile.gender === "any") return true;
      if (entry.gender) return entry.gender === "neutral" || entry.gender === profile.gender;
      return entry.text.split("").every((c) => {
        const meta = findChar(pack, c);
        return !meta || meta.gender === "neutral" || meta.gender === profile.gender;
      });
    });
    if (profile.style.length > 0) {
      const styled = pool2.filter(
        (entry) => Array.from(entry.text).some(
          (c) => findChar(pack, c)?.styles.some((s) => profile.style.includes(s))
        )
      );
      if (styled.length >= MIN_STYLE_GIVEN) pool2 = styled;
    }
    if (pool2.length > 0) {
      const sampled = sampleSubset(pool2, rng, 128);
      const scored = sampled.map((entry) => ({
        item: entry.text,
        score: scoreGiven(pack, plainChars(pack, entry.text), profile)
      }));
      return sampleTopK(scored, rng, 24).split("").map((c) => toNameChar(pack, c, warnings));
    }
  }
  if (wantSingle) {
    const char = pickOtherChar(pack, profile, rng, surname, void 0, surnameChars, true);
    return [toNameChar(pack, char, warnings)];
  }
  let pool = givenNamesForProfile(pack, profile).filter((entry) => {
    if (entry.text[0] === entry.text[1]) return false;
    if (Array.from(entry.text).some((c) => surnameChars.has(c))) return false;
    if (!isElegantGivenAllowed(entry.text, profile)) return false;
    if (isGivenCharBlocked(entry.text, pack, profile)) return false;
    if (isFemaleNameBlocked(entry.text, profile)) return false;
    if (profile.gender === "any") return true;
    if (entry.gender) return entry.gender === "neutral" || entry.gender === profile.gender;
    return entry.text.split("").every((c) => {
      const meta = findChar(pack, c);
      return !meta || meta.gender === "neutral" || meta.gender === profile.gender;
    });
  });
  if (profile.style.length > 0) {
    const styled = pool.filter(
      (entry) => Array.from(entry.text).some(
        (c) => findChar(pack, c)?.styles.some((s) => profile.style.includes(s))
      )
    );
    if (styled.length > 0) pool = styled;
  }
  if (pool.length > 0) {
    const sampled = sampleSubset(pool, rng, 128);
    const scored = sampled.map((entry) => ({
      item: entry.text,
      score: scoreGiven(pack, plainChars(pack, entry.text), profile)
    }));
    return sampleTopK(scored, rng, 24).split("").map((c) => toNameChar(pack, c, warnings));
  }
  const a = pickOtherChar(pack, profile, rng, surname, void 0, surnameChars);
  const b = pickOtherChar(pack, profile, rng, surname, a, surnameChars);
  return [a, b].map((c) => toNameChar(pack, c, warnings));
}
function findPairWithGeneration(pack, generation, profile, rng, surname) {
  const pos = generation.position === "first" ? 0 : 1;
  const pool = givenNamesForProfile(pack, profile).filter((entry) => {
    if (entry.text.length !== 2 || entry.text[pos] !== generation.char) return false;
    if (!isElegantGivenAllowed(entry.text, profile)) return false;
    if (isGivenCharBlocked(entry.text, pack, profile)) return false;
    if (isFemaleNameBlocked(entry.text, profile)) return false;
    if (profile.gender === "any") return true;
    if (entry.gender) return entry.gender === "neutral" || entry.gender === profile.gender;
    const meta = findChar(pack, entry.text[1 - pos]);
    return !meta || meta.gender === "neutral" || meta.gender === profile.gender;
  });
  if (pool.length < 8) return void 0;
  const sampled = sampleSubset(pool, rng, 128);
  const scored = sampled.map((entry) => ({
    item: entry.text,
    score: scoreGiven(pack, plainChars(pack, entry.text), profile)
  }));
  return sampleTopK(scored, rng, 24);
}
function pickOtherChar(pack, profile, rng, surname, avoid, surnameChars = /* @__PURE__ */ new Set(), single = false) {
  const blocked = (c) => single && SINGLE_NAME_STOP.has(c.char) || profile.class === "\u96C5\u58EB" && ELEGANT_BANNED_CHARS.has(c.char) || profile.class !== "\u4FD7\u4EBA" && Boolean(pack.blockedChars?.includes(c.char));
  const base = pack.chars.filter((c) => {
    if (c.char === avoid || blocked(c)) return false;
    if (surnameChars.has(c.char)) return false;
    if (profile.gender !== "any" && c.gender !== "neutral" && c.gender !== profile.gender) return false;
    return true;
  });
  const styled = profile.style.length > 0 ? base.filter((c) => c.styles.some((s) => profile.style.includes(s))) : [];
  const fallback = pack.chars.filter((c) => c.char !== avoid && !blocked(c) && !surnameChars.has(c.char));
  const source = profile.style.length > 0 ? styled.length >= MIN_STYLE_CHARS ? styled : base.length > 0 ? base : fallback : base.length > 0 ? base : fallback;
  const sampled = sampleSubset(source, rng, 96);
  const scored = sampled.map((c) => ({
    item: c.char,
    score: scoreGiven(pack, plainChars(pack, c.char), profile)
  }));
  return sampleTopK(scored, rng, 24);
}
function toNameChar(pack, char, warnings) {
  const meta = findChar(pack, char);
  if (!meta) {
    warnings.push({
      code: "char_outside_table",
      message: `\u5B57\u7B26\u300C${char}\u300D\u4E0D\u5728\u79CD\u5B50\u5B57\u8868\u5185`
    });
    return { text: char, pinyin: "", tone: 0 };
  }
  return {
    text: meta.char,
    pinyin: meta.pinyin,
    tone: meta.tone,
    meaning: meta.meaning,
    sources: [`${pack.id}:char`]
  };
}
var charIndexCache = /* @__PURE__ */ new WeakMap();
function isFemaleNameBlocked(text, profile) {
  return profile.gender === "female" && FEMALE_NAME_BLOCKLIST.has(text);
}
function isGivenCharBlocked(text, pack, profile) {
  if (profile.class === "\u4FD7\u4EBA") return false;
  const blocked = pack.blockedChars;
  return Boolean(blocked?.length) && Array.from(text).some((char) => blocked.includes(char));
}
function isElegantGivenAllowed(text, profile) {
  if (profile.class !== "\u96C5\u58EB") return true;
  return !Array.from(text).some((char) => ELEGANT_BANNED_CHARS.has(char));
}
function givenNamesForProfile(pack, profile) {
  const femaleStylePool = profile.style.includes("\u5199\u610F") ? pack.femaleGivenNamesByStyle?.\u5199\u610F : void 0;
  const femaleEraPool = pack.femaleGivenNamesByEra?.[profile.era];
  const rawFemalePool = femaleStylePool && femaleStylePool.length >= 5 ? femaleStylePool : femaleEraPool;
  const femalePool = rawFemalePool?.filter(
    (entry) => Array.from(entry.text).every((char) => Boolean(findChar(pack, char)))
  );
  if (profile.gender === "female" && femalePool && femalePool.length >= 5) return femalePool;
  const extras = [];
  if (profile.era === "xianxia") extras.push(...pack.givenNamesByEra?.xianxia ?? []);
  if (profile.style.includes("\u5199\u610F")) extras.push(...pack.givenNamesByStyle?.\u5199\u610F ?? []);
  const validExtras = [...new Map(
    extras.filter((entry) => Array.from(entry.text).every((char) => Boolean(findChar(pack, char)))).map((entry) => [entry.text, entry])
  ).values()];
  if (validExtras.length >= 5) return validExtras;
  const eraPool = pack.givenNamesByEra?.[profile.era];
  return eraPool && eraPool.length >= 50 ? eraPool : pack.givenNames;
}
function findChar(pack, char) {
  let index = charIndexCache.get(pack);
  if (!index) {
    index = new Map(pack.chars.map((c) => [c.char, c]));
    charIndexCache.set(pack, index);
  }
  return index.get(char);
}
function splitPinyin(pinyin) {
  const text = pinyin.toLowerCase().replace(/[^a-zü]/g, "").replace(/ü/g, "v");
  if (!text) return null;
  const initial = INITIALS.find((candidate) => text.startsWith(candidate)) ?? "";
  return { initial, final: text.slice(initial.length) };
}
function phoneticIssues(surname, given) {
  const issues = [];
  if (given.length === 2) {
    const [a, b] = given;
    if (a.tone === 3 && b.tone === 3) issues.push("double_third");
    if (a.tone > 0 && a.tone === b.tone) issues.push("same_tone");
    const pa = splitPinyin(a.pinyin);
    const pb = splitPinyin(b.pinyin);
    if (pa && pb) {
      if (pa.initial && pa.initial === pb.initial) issues.push("same_initial");
      if (pa.final && pa.final === pb.final) issues.push("same_final");
    }
  }
  const first = given[0];
  if (!first) return Array.from(new Set(issues));
  const ps = splitPinyin(surname.pinyin);
  const pf = splitPinyin(first.pinyin);
  if (ps && pf) {
    if (ps.initial && ps.initial === pf.initial) issues.push("surname_same_initial");
    if (ps.final && ps.final === pf.final) issues.push("surname_same_final");
  }
  return Array.from(new Set(issues));
}
function plainChars(pack, text) {
  return Array.from(text).map((ch) => {
    const meta = findChar(pack, ch);
    return meta ? { text: meta.char, pinyin: meta.pinyin, tone: meta.tone, meaning: meta.meaning } : { text: ch, pinyin: "", tone: 0 };
  });
}
function scoreGiven(pack, given, profile) {
  const metas = given.map((c) => findChar(pack, c.text)).filter((c) => Boolean(c));
  const weight = metas.reduce((sum, c) => sum + c.weight, 0);
  const base = 0.55 + Math.min(0.3, weight / 300);
  const styleHits = metas.reduce(
    (sum, c) => sum + (c.styles.some((tag) => profile.style.includes(tag)) ? 1 : 0),
    0
  );
  const genderHits = profile.gender === "any" ? 0 : metas.filter((c) => c.gender === "neutral" || c.gender === profile.gender).length / Math.max(1, metas.length);
  const issues = phoneticIssues(EMPTY_SURNAME, given).length;
  const strokes = metas.reduce((sum, c) => sum + (c.strokes ?? 0), 0);
  const givenText = given.map((c) => c.text).join("");
  const allusionBonus = pack.allusions[givenText]?.length ? 0.05 : 0;
  const strokePenalty = strokes > 40 ? 0.1 : 0;
  const radicalKey = (value) => value?.split(".")[0]?.replace(/'/g, "");
  const radicalPenalty = metas.length === 2 && radicalKey(metas[0].radical) && radicalKey(metas[0].radical) === radicalKey(metas[1].radical) ? 0.08 : 0;
  return Number(
    (base + styleHits * 0.02 + genderHits * 0.01 + allusionBonus - issues * 0.03 - strokePenalty - radicalPenalty).toFixed(4)
  );
}
function sampleSubset(items, rng, limit) {
  if (items.length <= limit) return items;
  const copy = items.slice();
  for (let i = 0; i < limit; i++) {
    const j = i + Math.floor(rng.next() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, limit);
}
function sampleTopK(scored, rng, k, temperature = 0.8) {
  const top = scored.slice().sort((a, b) => b.score - a.score).slice(0, k);
  const max = top[0].score;
  const weights = top.map((entry) => Math.exp((entry.score - max) / temperature));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = rng.next() * total;
  for (let i = 0; i < top.length; i++) {
    cursor -= weights[i];
    if (cursor <= 0) return top[i].item;
  }
  return top[top.length - 1].item;
}
function scoreName(pack, given, rng, profile) {
  return Number((scoreGiven(pack, given, profile) + rng.next() * 0.05).toFixed(4));
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function normalizeCount(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1e5, Math.max(0, Math.trunc(value)));
}

// src/browser.ts
function createGenerator(pack) {
  if (!pack || !pack.id || !Array.isArray(pack.chars)) {
    throw new Error("E_PACK_INVALID: \u9700\u8981\u4F20\u5165\u5DF2\u52A0\u8F7D\u7684 pack \u5BF9\u8C61");
  }
  return {
    pack,
    generate: (profile = {}) => generate(profile, pack),
    generateBatch: (profile = {}) => generateBatch(profile, pack),
    check: (name) => checkName(name, pack),
    artifacts: (options = {}) => generateArtifacts(options, pack),
    sects: (options = {}) => generateSects(options, pack),
    pills: (options = {}) => generatePills(options, pack),
    techniques: (options = {}) => generateTechniques(options, pack)
  };
}
async function loadPack(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`E_PACK_FETCH: HTTP ${response.status}`);
  const payload = await response.json();
  return payload.data ?? payload;
}
export {
  createGenerator,
  loadPack
};
