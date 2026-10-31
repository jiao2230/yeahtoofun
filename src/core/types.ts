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
