#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { loadSeedPack } from './core/data.ts';
import { checkName, summarizeWarnings } from './core/check.ts';
import { generateArtifacts } from './core/artifact.ts';
import { generateSects, sectParts } from './core/sect.ts';
import { generatePills, pillParts } from './core/pill.ts';
import { generateTechniques, techniqueParts } from './core/technique.ts';
import { generate, generateBatch, resolveProfile } from './core/generator.ts';
import type { PersonName, Profile } from './core/types.ts';

const VERSION = '0.6.0';

function main(): Promise<void> {
  return run();
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0] ?? 'help';
  const { flags, positional } = parseArgs(argv.slice(1));
  const pack = loadSeedPack();

  if (command === 'help' || flags.help === true) {
    printHelp();
    return;
  }

  if (command === 'gen') {
    const profile = profileFromFlags(flags);
    const count = profile.count ?? 1;
    const people =
      count === 1
        ? [generate(profile, pack)]
        : generateBatch({ ...profile, count }, pack);
    printPeople(people, flags);
    return;
  }

  if (command === 'batch') {
    const profilePath = stringFlag(flags, 'profile');
    if (!profilePath) throw new Error('batch 需要 --profile <path>');
    const fileProfile = JSON.parse(readFileSync(profilePath, 'utf8')) as Profile;
    const profile: Profile = {
      ...fileProfile,
      count: numberFlag(flags, 'count') ?? fileProfile.count ?? 10,
      seed: seedFlag(flags) ?? fileProfile.seed,
      mode: (stringFlag(flags, 'mode') as Profile['mode']) ?? fileProfile.mode,
    };
    const people = generateBatch(profile, pack);
    const out = stringFlag(flags, 'out');
    const format = stringFlag(flags, 'format') ?? 'jsonl';
    if (out) {
      writeFileSync(out, formatPeople(people, format, flags.bom === true), 'utf8');
      console.log(`已写入 ${out}（${people.length} 条，${format}${flags.bom === true ? '，BOM' : ''}）`);
    } else {
      process.stdout.write(formatPeople(people, format, flags.bom === true));
    }
    return;
  }

  if (command === 'check') {
    const name = positional[0];
    if (!name) throw new Error('check 需要姓名，例如：minglu check 沈玄清');
    const report = checkName(name, pack);
    if (flags.json === true) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`${report.name}: ${report.valid ? '通过' : '有问题'}`);
      for (const warning of report.warnings) console.log(`  - [${warning.code}] ${warning.message}`);
      if (report.collisions.length > 0) console.log(`  重名：${report.collisions.join('、')}`);
    }
    return;
  }

  if (command === 'technique' && positional[0] === 'gen') {
    const kindRaw = stringFlag(flags, 'kind');
    const suffixRaw = stringFlag(flags, 'suffix');
    if (
      kindRaw !== undefined &&
      kindRaw !== 'any' &&
      kindRaw !== '意象' &&
      kindRaw !== '动作' &&
      kindRaw !== '程度'
    ) {
      throw new Error('E_TECHNIQUE_KIND: --kind 只支持 意象/动作/程度/any');
    }
    if (
      suffixRaw !== undefined &&
      !['诀', '功', '真经', '妙法', '篇', '典', '章'].includes(suffixRaw)
    ) {
      throw new Error('E_TECHNIQUE_SUFFIX: --suffix 只支持 诀/功/真经/妙法/篇/典/章');
    }
    const techniques = generateTechniques(
      {
        count: numberFlag(flags, 'count') ?? 5,
        seed: seedFlag(flags),
        kind: kindRaw as '意象' | '动作' | '程度' | 'any' | undefined,
        suffix: suffixRaw as '诀' | '功' | '真经' | '妙法' | '篇' | '典' | '章' | undefined,
      },
      pack,
    );
    if (flags.json === true) {
      console.log(JSON.stringify(techniques.length === 1 ? techniques[0] : techniques, null, 2));
    } else {
      for (const technique of techniques) {
        const warning =
          technique.warnings.length > 0 ? `  ⚠ ${summarizeWarnings(technique.warnings)}` : '';
        const middle = technique.middle ?? '∅';
        console.log(`${technique.fullName}  [${technique.kind} / ${technique.head}+${middle}+${technique.suffix}]  seed=${technique.seed}`);
        console.log(`  ${technique.description}${warning}`);
      }
    }
    return;
  }

  if (command === 'technique' && positional[0] === 'list') {
    const parts = techniqueParts(pack);
    console.log(`heads (${parts.heads.length}):`);
    for (const head of parts.heads) console.log(`  ${head.text}\t${head.kind}\t${head.weight}`);
    console.log(`middles (${parts.middles.length}): ${parts.middles.map((m) => m.text).join(' ')}`);
    console.log(`suffixes: ${parts.suffixes.map((s) => s.text).join(' ')}`);
    return;
  }

  if (command === 'pill' && positional[0] === 'gen') {
    const kindRaw = stringFlag(flags, 'kind');
    const suffixRaw = stringFlag(flags, 'suffix');
    const modeRaw = stringFlag(flags, 'mode');
    if (
      kindRaw !== undefined &&
      kindRaw !== 'any' &&
      kindRaw !== '天地' &&
      kindRaw !== '突破' &&
      kindRaw !== '疗伤' &&
      kindRaw !== '淬体' &&
      kindRaw !== '神魂' &&
      kindRaw !== '通用'
    ) {
      throw new Error('E_PILL_KIND: --kind 只支持 天地/突破/疗伤/淬体/神魂/通用/any');
    }
    if (suffixRaw !== undefined && !['丹', '膏', '散', '露'].includes(suffixRaw)) {
      throw new Error('E_PILL_SUFFIX: --suffix 只支持 丹/膏/散/露');
    }
    if (modeRaw !== undefined && !['function', 'high', 'any'].includes(modeRaw)) {
      throw new Error('E_PILL_MODE: --mode 只支持 function/high/any');
    }
    const pills = generatePills(
      {
        count: numberFlag(flags, 'count') ?? 5,
        seed: seedFlag(flags),
        kind: kindRaw as '天地' | '突破' | '疗伤' | '淬体' | '神魂' | '通用' | 'any' | undefined,
        suffix: suffixRaw as '丹' | '膏' | '散' | '露' | undefined,
        mode: modeRaw as 'function' | 'high' | 'any' | undefined,
      },
      pack,
    );
    if (flags.json === true) {
      console.log(JSON.stringify(pills.length === 1 ? pills[0] : pills, null, 2));
    } else {
      for (const pill of pills) {
        const warning = pill.warnings.length > 0 ? `  ⚠ ${summarizeWarnings(pill.warnings)}` : '';
        console.log(`${pill.fullName}  [${pill.tier}/${pill.mode} / ${pill.kind} / ${pill.suffix}]  seed=${pill.seed}`);
        console.log(`  ${pill.description}${warning}`);
      }
    }
    return;
  }

  if (command === 'pill' && positional[0] === 'list') {
    const parts = pillParts(pack);
    console.log(`modifiers (${parts.modifiers.length}):`);
    for (const modifier of parts.modifiers) {
      console.log(`  ${modifier.text}\t${modifier.kind}\t${modifier.weight}`);
    }
    console.log(`cores (${parts.cores.length}):`);
    for (const core of parts.cores) {
      console.log(`  ${core.text}\t${core.kind}\t${core.weight}`);
    }
    console.log(`suffixes: ${parts.suffixes.map((suffix) => suffix.text).join(' ')}`);
    return;
  }

  if (command === 'sect' && positional[0] === 'gen') {
    const alignmentRaw = stringFlag(flags, 'alignment');
    if (
      alignmentRaw !== undefined &&
      alignmentRaw !== 'any' &&
      alignmentRaw !== '正道' &&
      alignmentRaw !== '魔道' &&
      alignmentRaw !== '中立'
    ) {
      throw new Error('E_SECT_ALIGNMENT: --alignment 只支持 正道 / 魔道 / 中立 / any');
    }
    const sects = generateSects(
      {
        count: numberFlag(flags, 'count') ?? 5,
        seed: seedFlag(flags),
        alignment: alignmentRaw as '正道' | '魔道' | '中立' | 'any' | undefined,
      },
      pack,
    );
    if (flags.json === true) {
      console.log(JSON.stringify(sects.length === 1 ? sects[0] : sects, null, 2));
    } else {
      for (const sect of sects) {
        const warning = sect.warnings.length > 0 ? `  ⚠ ${summarizeWarnings(sect.warnings)}` : '';
        console.log(`${sect.fullName}  [${sect.alignment} / ${sect.tone}]  seed=${sect.seed}`);
        console.log(`  ${sect.description}${warning}`);
      }
    }
    return;
  }

  if (command === 'sect' && positional[0] === 'list') {
    const parts = sectParts(pack);
    console.log(`prefixes (${parts.prefixes.length}):`);
    for (const prefix of parts.prefixes) {
      console.log(`  ${prefix.text}\t${prefix.alignment}\t${prefix.tone}\t${prefix.weight}`);
    }
    console.log(`suffixes (${parts.suffixes.length}): ${parts.suffixes.map((s) => s.text).join(' ')}`);
    return;
  }

  if (command === 'artifact' && positional[0] === 'gen') {
    const artifacts = generateArtifacts(
      { count: numberFlag(flags, 'count') ?? 1, seed: seedFlag(flags) },
      pack,
    );
    if (flags.json === true) {
      console.log(JSON.stringify(artifacts.length === 1 ? artifacts[0] : artifacts, null, 2));
    } else {
      for (const artifact of artifacts) {
        const warning = artifact.warnings.length > 0 ? `  ⚠ ${summarizeWarnings(artifact.warnings)}` : '';
        console.log(`${artifact.name}  [${artifact.modifierKind} / ${artifact.form}]  seed=${artifact.seed}${warning}`);
      }
    }
    return;
  }

  if (command === 'artifact' && positional[0] === 'list') {
    console.log(`modifiers (${pack.artifacts.modifiers.length}):`);
    for (const m of pack.artifacts.modifiers) console.log(`  ${m.text}\t${m.kind}\t${m.weight}`);
    console.log(`forms (${pack.artifacts.forms.length}):`);
    console.log(`  ${pack.artifacts.forms.map((f) => f.text).join(' ')}`);
    return;
  }

  if (command === 'generation' && positional[0] === 'list') {
    for (const preset of pack.generations) {
      console.log(`${preset.id}\t${preset.name}\t${preset.chars.length} 字\t${preset.chars}`);
    }
    return;
  }

  if (command === 'data' && positional[0] === 'info') {
    console.log(`pack: ${pack.id}@${pack.version}`);
    console.log(`license: ${pack.license}`);
    console.log(`source: ${pack.source}`);
    console.log(
      `counts: surnames=${pack.surnames.length} chars=${pack.chars.length} givenNames=${pack.givenNames.length} generations=${pack.generations.length} collision=${pack.collision.length}`,
    );
    return;
  }

  if (command === 'serve') {
    const { startServer } = await import('./server.ts');
    startServer({
      port: numberFlag(flags, 'port') ?? 5178,
      host: stringFlag(flags, 'host'),
      allowLan: flags['allow-lan'] === true,
      token: stringFlag(flags, 'token'),
    });
    return;
  }

  throw new Error(`未知命令：${command}。运行 minglu help 查看用法。`);
}

function profileFromFlags(flags: Record<string, string | boolean>): Profile {
  if (flags.courtesy === true || flags['no-courtesy'] === true) {
    throw new Error('E_DEPRECATED: v0.6 起不再生成「字」，请移除 --courtesy/--no-courtesy');
  }
  const generation = buildGeneration(flags);
  const givenLengthRaw = stringFlag(flags, 'given-length');
  const givenLength: Profile['givenLength'] =
    givenLengthRaw === 'auto'
      ? 'auto'
      : givenLengthRaw === '1'
        ? 1
        : givenLengthRaw === '2'
          ? 2
          : undefined;
  return {
    era: stringFlag(flags, 'era') as Profile['era'],
    gender: stringFlag(flags, 'gender') as Profile['gender'],
    style: stringFlag(flags, 'style')?.split(',').filter(Boolean) as Profile['style'],
    class: stringFlag(flags, 'class') as Profile['class'],
    surname: stringFlag(flags, 'surname'),
    givenLength,
    allusion: allusionFlag(flags),
    generation,
    restraint: numberFlag(flags, 'restraint') ?? 0.7,
    seed: seedFlag(flags),
    count: numberFlag(flags, 'count') ?? 1,
    mode: (stringFlag(flags, 'mode') as Profile['mode']) ?? 'stable',
  };
}

function buildGeneration(flags: Record<string, string | boolean>): Profile['generation'] {
  const value = stringFlag(flags, 'generation');
  if (!value) return null;
  const presetOrPoem = value;
  const position = stringFlag(flags, 'generation-position');
  return {
    ...(isPresetId(presetOrPoem) ? { preset: presetOrPoem } : { poem: presetOrPoem }),
    index: numberFlag(flags, 'generation-index') ?? 1,
    position: position === 'second' ? 'second' : 'first',
    applyTo: (stringFlag(flags, 'generation-apply-to') as 'all' | 'male' | 'female') ?? 'all',
  };
}

function isPresetId(value: string): boolean {
  return ['ming-imperial', 'generic-a', 'generic-b'].includes(value);
}

function parseArgs(args: string[]): {
  flags: Record<string, string | boolean>;
  positional: string[];
} {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return { flags, positional };
}

function stringFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

function numberFlag(flags: Record<string, string | boolean>, key: string): number | undefined {
  const raw = stringFlag(flags, key);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function seedFlag(flags: Record<string, string | boolean>): number | string | undefined {
  const raw = stringFlag(flags, 'seed');
  if (raw === undefined) return undefined;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) && raw.trim() !== '' ? asNumber : raw;
}

function allusionFlag(flags: Record<string, string | boolean>): Profile['allusion'] {
  const raw = stringFlag(flags, 'allusion');
  if (raw === undefined) return undefined;
  if (raw === 'chuci' || raw === 'shijing' || raw === 'lunyu' || raw === 'all') return raw;
  throw new Error('E_ALLUSION_INVALID: --allusion 只支持 chuci / shijing / lunyu / all');
}

function formatPeople(people: PersonName[], format: string, bom = false): string {
  if (format === 'json') return `${JSON.stringify(people, null, 2)}\n`;
  if (format === 'jsonl') return people.map((p) => JSON.stringify(p)).join('\n') + '\n';
  if (format === 'csv') {
    const lines = ['fullName,surname,given,generation,pinyin,seed'];
    for (const p of people) {
      const given = p.given.map((c) => c.text).join('');
      const pinyin = p.given.map((c) => c.pinyin).join(' ');
      lines.push(
        [p.fullName, p.surname.text, given, p.generation?.char ?? '', pinyin, p.seed]
          .map(csvCell)
          .join(','),
      );
    }
    return `${bom ? '\uFEFF' : ''}${lines.join('\n')}\n`;
  }
  return people
    .map((p) => `${p.fullName}\tseed=${p.seed}`)
    .join('\n') + '\n';
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function printPeople(people: PersonName[], flags: Record<string, string | boolean>): void {
  if (flags.json === true) {
    console.log(JSON.stringify(people.length === 1 ? people[0] : people, null, 2));
    return;
  }
  for (const person of people) {
    const tags = [person.era, person.gender, person.class].join(' / ');
    console.log(`${person.fullName}  [${tags}]  seed=${person.seed}`);
    for (const char of person.given) {
      console.log(`  ${char.text}  ${char.pinyin} ${char.tone}  ${char.meaning ?? ''}`);
    }
    if (person.generation) {
      console.log(`  字辈：${person.generation.char}（${person.generation.preset ?? '自定义'}，第 ${person.generation.index} 字，${person.generation.position}）`);
    }
    if (person.pattern === 'religious-prefix') {
      console.log('  式：僧道法名式（道/法/僧 + 名）');
    }
    if (person.allusion) {
      console.log(`  典：${person.allusion.source}「${person.allusion.line}」`);
    }
    if (person.warnings.length > 0) {
      console.log(`  提示：${summarizeWarnings(person.warnings)}`);
    }
  }
}

function printHelp(): void {
  console.log(`名箓 minglu ${VERSION}（seed prototype）

用法：
  minglu gen [选项]
  minglu batch --profile <json> [--count N] [--out file] [--format json|jsonl|csv] [--bom]
  minglu check <姓名> [--json]
  minglu generation list
  minglu sect gen [--count N] [--alignment 正道|魔道|中立|any] [--seed S] [--json]
  minglu sect list
  minglu pill gen [--count N] [--mode function|high|any] [--kind 天地|突破|疗伤|淬体|神魂|通用] [--suffix 丹|膏|散|露] [--seed S] [--json]
  minglu pill list
  minglu technique gen [--count N] [--kind 意象|动作|程度] [--suffix 诀|功|真经|妙法|篇|典|章] [--seed S] [--json]
  minglu technique list
  minglu artifact gen --count 6 --seed 42 --json
  minglu artifact list
  minglu data info
  minglu serve [--port 5178] [--allow-lan --token <token>]

gen 选项：
  --era song|tang|ming|...      时代
  --gender male|female|any      性别
  --style 雅正,清冷              风格（逗号分隔）
  --class 士族|寒门|...          阶层
  --surname 沈                   指定姓氏
  --given-length auto|1|2        名字长度
  --allusion chuci|shijing|lunyu|all  只取对应经典用典名
  --generation <preset|诗>       字辈模板或自定义诗
  --generation-index 8           1-based 辈分
  --generation-position first|second
  --generation-apply-to all|male|female
  --count 5                      数量
  --seed 42                      种子
  --mode stable|diverse          批量模式
  --json                         输出 JSON

示例：
  minglu gen --era song --gender male --class 士族 --seed 42 --json
  minglu gen --surname 沈 --generation ming-imperial --generation-index 8
  minglu sect gen --count 9 --seed 42
  minglu pill gen --count 8 --seed 42
  minglu technique gen --count 8 --seed 42
  minglu artifact gen --count 6 --seed 42 --json
  minglu batch --profile profiles/sect.json --count 20 --out out.csv --format csv

数据包：
  MINGLU_PACK=seed   默认，手工种子包（测试）
  MINGLU_PACK=core   CNC + seed，Apache-2.0
  MINGLU_PACK=cbdb   真实 CBDB pack（个人自用，CC BY-NC-SA）
`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`错误：${message}`);
  process.exit(1);
}
