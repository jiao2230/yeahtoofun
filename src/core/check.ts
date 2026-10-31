import type { CheckReport, SeedPack, Warning } from './types.ts';

const collisionCache = new WeakMap<SeedPack, Set<string>>();

export function collisionSet(pack: SeedPack): Set<string> {
  let set = collisionCache.get(pack);
  if (!set) {
    set = new Set(pack.collision);
    collisionCache.set(pack, set);
  }
  return set;
}

export function checkName(raw: string, pack: SeedPack): CheckReport {
  const name = raw.trim();
  const warnings: Warning[] = [];
  const collisions: string[] = [];

  if (!name) {
    return {
      name,
      valid: false,
      warnings: [{ code: 'empty', message: '名字为空' }],
      collisions,
    };
  }
  if (!/^[\u4e00-\u9fa5]+$/.test(name)) {
    warnings.push({ code: 'non_han', message: '包含非汉字字符' });
  }
  if (name.length < 2 || name.length > 4) {
    warnings.push({ code: 'length', message: '姓名长度应为 2–4 字' });
  }

  const surname = splitSurname(name, pack);
  const given = name.slice(surname.length);
  if (!given) warnings.push({ code: 'no_given', message: '缺少名' });

  for (const char of name) {
    if (!pack.chars.some((c) => c.char === char) && !pack.surnames.some((s) => s.text.includes(char))) {
      warnings.push({
        code: 'char_outside_table',
        message: `字符「${char}」不在种子字表/姓氏表内`,
      });
    }
  }

  if (pack.blacklist.includes(name)) {
    warnings.push({ code: 'blacklist', message: '命中黑名单词' });
    collisions.push(name);
  }
  if (pack.famous.includes(name)) {
    warnings.push({ code: 'famous_collision', message: '与内置历史名人重名' });
    collisions.push(name);
  }
  if (collisionSet(pack).has(name)) {
    warnings.push({ code: 'historical_collision', message: '与 CBDB 历史人物姓名完全相同' });
    collisions.push(name);
  }

  return {
    name,
    valid: !warnings.some((w) =>
      ['empty', 'non_han', 'length', 'blacklist'].includes(w.code),
    ),
    warnings,
    collisions: [...new Set(collisions)],
  };
}

export function splitSurname(name: string, pack: SeedPack): string {
  const compounds = pack.surnames
    .filter((s) => s.compound)
    .map((s) => s.text)
    .sort((a, b) => b.length - a.length);
  for (const compound of compounds) {
    if (name.startsWith(compound)) return compound;
  }
  return name.slice(0, 1);
}

export function summarizeWarnings(warnings: Warning[]): string {
  return warnings.map((w) => w.message).join('；');
}
