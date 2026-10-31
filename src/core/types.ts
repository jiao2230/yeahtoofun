export type Era =
  | 'preqin'
  | 'han'
  | 'weijin'
  | 'tang'
  | 'song'
  | 'ming'
  | 'qing'
  | 'xianxia';

export type Gender = 'male' | 'female' | 'any';

export type Style = '雅正' | '清冷' | '雄浑' | '仙逸' | '质朴' | '绮丽';

export type SocialClass = '士族' | '寒门' | '僧道' | '江湖' | '宫闱' | '仙门';

export type GivenLength = 'auto' | 1 | 2;

export type BatchMode = 'stable' | 'diverse';

export interface SurnameEntry {
  text: string;
  pinyin: string;
  weight: number;
  compound: boolean;
}

export interface CharEntry {
  char: string;
  pinyin: string;
  tone: number;
  meaning: string;
  gender: 'male' | 'female' | 'neutral';
  styles: Style[];
  weight: number;
  radical?: string;
  strokes?: number;
}

export interface GivenEntry {
  text: string;
  weight: number;
}

export interface AllusionEntry {
  corpus: 'chuci' | 'shijing' | 'lunyu';
  source: string;
  line: string;
}

export interface GenerationPreset {
  id: string;
  name: string;
  chars: string;
  position: 'first' | 'second';
  note: string;
}

export interface ArtifactModifier {
  text: string;
  kind: '材质' | '意象' | '功能';
  weight: number;
}

export interface ArtifactForm {
  text: string;
  weight: number;
}

export interface ArtifactPack {
  modifiers: ArtifactModifier[];
  forms: ArtifactForm[];
  blacklist: string[];
}

export interface ArtifactName {
  schemaVersion: '1.0';
  name: string;
  modifier: string;
  modifierKind: '材质' | '意象' | '功能';
  form: string;
  tags: string[];
  score: number;
  seed: number;
  warnings: Warning[];
  pack: Record<string, string>;
  license: string;
}

export type SectAlignment = '正道' | '魔道' | '中立';
export type SectTone = '堂皇' | '凛冽' | '苍茫';

export interface SectPrefix {
  text: string;
  alignment: SectAlignment;
  tone: SectTone;
  tags: string[];
  note: string;
  weight: number;
}

export interface SectSuffix {
  text: string;
  alignment: SectAlignment;
  tone: SectTone;
  weight: number;
}

export interface SectPack {
  prefixes: SectPrefix[];
  suffixes: SectSuffix[];
  blacklist: string[];
}

export interface SectName {
  schemaVersion: '1.0';
  fullName: string;
  prefix: string;
  suffix: string;
  alignment: SectAlignment;
  tone: SectTone;
  tags: string[];
  description: string;
  score: number;
  seed: number;
  warnings: Warning[];
  pack: Record<string, string>;
  license: string;
}

export interface SectOptions {
  count?: number;
  seed?: number | string;
  alignment?: SectAlignment | 'any';
}

export type PillKind = '天地' | '突破' | '疗伤' | '淬体' | '神魂' | '通用';
export type PillSuffixText = '丹' | '膏' | '散' | '露';

export interface PillModifier {
  text: string;
  kind: PillKind;
  weight: number;
  targets?: string[];
}

export interface PillCore {
  text: string;
  kind: PillKind;
  weight: number;
}

export interface PillSuffix {
  text: PillSuffixText;
  weight: number;
  preferred: PillKind[];
}

export interface PillHighModifier {
  text: string;
  weight: number;
}

export interface PillPack {
  modifiers: PillModifier[];
  cores: PillCore[];
  highModifiers: PillHighModifier[];
  suffixes: PillSuffix[];
  blacklist: string[];
}

export interface PillName {
  schemaVersion: '1.0';
  fullName: string;
  mode: 'function' | 'high';
  tier: '普通' | '高级';
  modifier: string;
  core: string;
  suffix: PillSuffixText;
  kind: PillKind;
  tags: string[];
  description: string;
  score: number;
  seed: number;
  warnings: Warning[];
  pack: Record<string, string>;
  license: string;
}

export interface PillOptions {
  count?: number;
  seed?: number | string;
  kind?: PillKind | 'any';
  suffix?: PillSuffixText | 'any';
  mode?: 'function' | 'high' | 'any';
}

export type TechniqueKind = '意象' | '动作' | '程度';
export type TechniqueSuffixText =
  | '诀'
  | '功'
  | '真经'
  | '妙法'
  | '篇'
  | '典'
  | '剑章'
  | '真本'
  | '直指'
  | '灵书'
  | '要义'
  | '神册'
  | '录';

export interface TechniqueHead {
  text: string;
  kind: TechniqueKind;
  weight: number;
}

export interface TechniqueMiddle {
  text: string;
  weight: number;
}

export interface TechniqueSuffix {
  text: TechniqueSuffixText;
  weight: number;
}

export interface TechniquePack {
  heads: TechniqueHead[];
  middles: TechniqueMiddle[];
  suffixes: TechniqueSuffix[];
  blacklist: string[];
}

export interface TechniqueName {
  schemaVersion: '1.0';
  fullName: string;
  head: string;
  middle: string | null;
  suffix: TechniqueSuffixText;
  kind: TechniqueKind;
  tags: string[];
  description: string;
  score: number;
  seed: number;
  warnings: Warning[];
  pack: Record<string, string>;
  license: string;
}

export interface TechniqueOptions {
  count?: number;
  seed?: number | string;
  kind?: TechniqueKind | 'any';
  suffix?: TechniqueSuffixText | 'any';
}

export interface SeedPack {
  id: string;
  version: string;
  license: string;
  source: string;
  surnames: SurnameEntry[];
  chars: CharEntry[];
  givenNames: GivenEntry[];
  generations: GenerationPreset[];
  allusions: Record<string, AllusionEntry[]>;
  artifacts: ArtifactPack;
  sects: SectPack;
  pills: PillPack;
  techniques: TechniquePack;
  blacklist: string[];
  famous: string[];
  collision: string[];
}

export interface GenerationConfig {
  preset?: string;
  poem?: string;
  index?: number;
  position?: 'first' | 'second';
  applyTo?: 'all' | 'male' | 'female';
}

export interface Profile {
  era?: Era;
  gender?: Gender;
  style?: Style[];
  class?: SocialClass;
  surname?: string;
  givenLength?: GivenLength;
  allusion?: 'chuci' | 'shijing' | 'lunyu' | 'all';
  generation?: GenerationConfig | null;
  restraint?: number;
  seed?: number | string;
  count?: number;
  mode?: BatchMode;
}

export interface ResolvedProfile {
  era: Era;
  gender: Gender;
  style: Style[];
  class: SocialClass;
  surname?: string;
  givenLength: GivenLength;
  allusion?: 'chuci' | 'shijing' | 'lunyu' | 'all';
  generation: GenerationConfig | null;
  restraint: number;
  seed: number | string;
  count: number;
  mode: BatchMode;
}

export interface NameChar {
  text: string;
  pinyin: string;
  tone: number;
  meaning?: string;
  sources?: string[];
}

export interface GenerationInfo {
  char: string;
  index: number;
  preset?: string;
  poem?: string;
  position: 'first' | 'second';
}

export interface Warning {
  code: string;
  message: string;
}

export interface PersonName {
  schemaVersion: '1.0';
  fullName: string;
  surname: NameChar;
  given: NameChar[];
  generation?: GenerationInfo | null;
  pattern?: string;
  allusion?: AllusionEntry;
  styleTags: Style[];
  era: Era;
  gender: Gender;
  class: SocialClass;
  score: number;
  warnings: Warning[];
  seed: number;
  profileHash: string;
  pack: Record<string, string>;
  license: string;
  provenance: string[];
}

export interface CheckReport {
  name: string;
  valid: boolean;
  warnings: Warning[];
  collisions: string[];
}

export interface GeneratorOptions {
  pack: SeedPack;
  now?: string;
}
