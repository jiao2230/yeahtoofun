import type {
  AllusionEntry,
  ArtifactPack,
  CharEntry,
  GivenEntry,
  PillPack,
  SectPack,
  SeedPack,
  SurnameEntry,
  TechniquePack,
} from './types.ts';

const ERAS = new Set(['qinhan', 'weijin', 'tangsong', 'mingqing', 'xianxia']);
const STYLES = new Set(['史实', '写意', '宗教']);
const GENDERS = new Set(['male', 'female', 'neutral']);
const CORPUS = new Set(['chuci', 'shijing', 'lunyu', 'zhouyi', 'zhuangzi', 'tangshi', 'songci']);
const HAN_TEXT = /^[\u4e00-\u9fa5]+$/;

function fail(message: string): never {
  throw new Error(`E_PACK_INVALID: ${message}`);
}

function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
}

function requireArray(value: unknown, field: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length === 0) fail(`${field} must be a non-empty array`);
}

function optionalArray(value: unknown, field: string): asserts value is unknown[] | undefined {
  if (value !== undefined && !Array.isArray(value)) fail(`${field} must be an array`);
}

function validateGiven(entry: GivenEntry, field: string): void {
  if (!entry || typeof entry !== 'object') fail(`${field} must be an object`);
  if (typeof entry.text !== 'string' || !HAN_TEXT.test(entry.text) || entry.text.length !== 2) {
    fail(`${field}.text must be 2 Han characters`);
  }
  if (typeof entry.weight !== 'number' || !Number.isFinite(entry.weight) || entry.weight < 0) {
    fail(`${field}.weight must be a non-negative number`);
  }
  if (entry.gender !== undefined && !GENDERS.has(entry.gender)) fail(`${field}.gender is invalid`);
}

function validateGivenList(value: unknown, field: string, optional = false): void {
  if (value === undefined && optional) return;
  requireArray(value, field);
  value.forEach((entry, index) => validateGiven(entry as GivenEntry, `${field}[${index}]`));
}

function validateSurname(entry: SurnameEntry, field: string): void {
  if (!entry || typeof entry !== 'object') fail(`${field} must be an object`);
  if (typeof entry.text !== 'string' || !HAN_TEXT.test(entry.text) || entry.text.length > 6) {
    fail(`${field}.text must be 1–6 Han characters`);
  }
  if (entry.text.includes('某') || entry.text.includes('氏')) fail(`${field} is a placeholder surname`);
  if (typeof entry.weight !== 'number' || !Number.isFinite(entry.weight) || entry.weight < 0) {
    fail(`${field}.weight must be a non-negative number`);
  }
  if (typeof entry.compound !== 'boolean') fail(`${field}.compound must be boolean`);
  if (entry.eras !== undefined) {
    if (!Array.isArray(entry.eras) || entry.eras.some((era) => !ERAS.has(era))) {
      fail(`${field}.eras contains an invalid era`);
    }
  }
}

function validateChar(entry: CharEntry, field: string): void {
  if (!entry || typeof entry !== 'object') fail(`${field} must be an object`);
  if (typeof entry.char !== 'string' || entry.char.length !== 1 || !HAN_TEXT.test(entry.char)) {
    fail(`${field}.char must be one Han character`);
  }
  if (typeof entry.pinyin !== 'string') fail(`${field}.pinyin must be a string`);
  if (typeof entry.tone !== 'number' || entry.tone < 0 || entry.tone > 5) fail(`${field}.tone is invalid`);
  if (!GENDERS.has(entry.gender)) fail(`${field}.gender is invalid`);
  if (!Array.isArray(entry.styles)) fail(`${field}.styles must be an array`);
}

function validateAllusions(value: unknown): void {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('allusions must be an object');
  for (const [phrase, hits] of Object.entries(value as Record<string, AllusionEntry[]>)) {
    if (!HAN_TEXT.test(phrase) || phrase.length !== 2) fail(`allusion phrase ${phrase} must be 2 Han characters`);
    if (!Array.isArray(hits)) fail(`allusions.${phrase} must be an array`);
    hits.forEach((hit, index) => {
      if (!hit || typeof hit !== 'object') fail(`allusions.${phrase}[${index}] must be an object`);
      if (!CORPUS.has(hit.corpus)) fail(`allusions.${phrase}[${index}].corpus is invalid`);
      requireString(hit.source, `allusions.${phrase}[${index}].source`);
      requireString(hit.line, `allusions.${phrase}[${index}].line`);
    });
  }
}

export function validatePack(pack: SeedPack): void {
  if (!pack || typeof pack !== 'object') fail('pack must be an object');
  requireString(pack.id, 'id');
  requireString(pack.version, 'version');
  requireString(pack.license, 'license');
  requireString(pack.source, 'source');

  requireArray(pack.surnames, 'surnames');
  pack.surnames.forEach((entry, index) => validateSurname(entry, `surnames[${index}]`));
  requireArray(pack.chars, 'chars');
  pack.chars.forEach((entry, index) => validateChar(entry, `chars[${index}]`));
  validateGivenList(pack.givenNames, 'givenNames');
  requireArray(pack.generations, 'generations');
  requireArray(pack.blacklist, 'blacklist');
  requireArray(pack.famous, 'famous');
  optionalArray(pack.collision, 'collision');
  validateAllusions(pack.allusions);

  for (const field of ['artifacts', 'sects', 'pills', 'techniques'] as const) {
    if (!pack[field] || typeof pack[field] !== 'object') {
      fail(`${field} must be an object`);
    }
  }
  const objects: Array<[string, ArtifactPack | SectPack | PillPack | TechniquePack]> = [
    ['artifacts', pack.artifacts],
    ['sects', pack.sects],
    ['pills', pack.pills],
    ['techniques', pack.techniques],
  ];
  for (const [field, value] of objects) {
    if (Object.keys(value).length === 0) fail(`${field} must not be empty`);
  }

  if (pack.givenNamesByEra !== undefined) {
    for (const [era, entries] of Object.entries(pack.givenNamesByEra)) {
      if (!ERAS.has(era)) fail(`givenNamesByEra has invalid era ${era}`);
      validateGivenList(entries, `givenNamesByEra.${era}`);
    }
  }
  if (pack.femaleGivenNamesByEra !== undefined) {
    for (const [era, entries] of Object.entries(pack.femaleGivenNamesByEra)) {
      if (!ERAS.has(era)) fail(`femaleGivenNamesByEra has invalid era ${era}`);
      validateGivenList(entries, `femaleGivenNamesByEra.${era}`);
    }
  }
  if (pack.givenNamesByStyle !== undefined) {
    for (const [style, entries] of Object.entries(pack.givenNamesByStyle)) {
      if (!STYLES.has(style)) fail(`givenNamesByStyle has invalid style ${style}`);
      validateGivenList(entries, `givenNamesByStyle.${style}`);
    }
  }
  if (pack.femaleGivenNamesByStyle !== undefined) {
    for (const [style, entries] of Object.entries(pack.femaleGivenNamesByStyle)) {
      if (!STYLES.has(style)) fail(`femaleGivenNamesByStyle has invalid style ${style}`);
      validateGivenList(entries, `femaleGivenNamesByStyle.${style}`);
    }
  }
}
