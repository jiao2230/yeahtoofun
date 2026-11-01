# 名箓 · Minglu

[![CI](https://github.com/jiao2230/yeahtoofun/actions/workflows/ci.yml/badge.svg)](https://github.com/jiao2230/yeahtoofun/actions/workflows/ci.yml)

> 从六十万人物的姓名史里，取一个像那个时代的名字。
>
> 本地优先 · 可复现 · 可解释 · 给修仙与历史题材项目用

**状态：v0.6 规格 + M1 原型（2026-10-31）**
规格见 `docs/`；`src/` 下已有可运行的人名/法宝/宗门/丹药/功法生成器、CLI、HTTP、48 项测试。CBDB 2026-10-24 与 CNC 已实测，并构建了 `core` 与 `cbdb` 数据包；`seed` 仍保留用于测试。

当前定位：**个人自用，不规划商用版本**。`core` 保留为 CNC/seed 数据分层；`cbdb` 只在本机构建、不分享。

---

## 一句话

名箓是一个**跑在自己电脑上的古典中文取名器**。输入时代、性别、风格、阶层，输出**姓 + 名（+ 字辈）**，附带用字解释、拼音/声调、重名提示，以及一个能复现同一结果的种子。

它不做命理，不接大模型，运行时零网络（首次构建数据包需要下载源数据）。

---

## 当前可跑（M1 原型：seed / cbdb）

```bash
cd minglu

# 默认 seed 包：生成一个宋代士族男性
node src/cli.ts gen --era song --gender male --class 士族 --seed 42 --json

# 真实 CBDB 包（个人自用，CC BY-NC-SA）
MINGLU_PACK=cbdb node src/cli.ts gen --era song --gender male --class 士族 --seed 42 --json
# PowerShell: $env:MINGLU_PACK='cbdb'; node src/cli.ts gen ...

# CNC core 包（Apache-2.0，偏现代/可读性）
MINGLU_PACK=core node src/cli.ts gen --era song --gender male --class 士族 --seed 42 --json

# 字辈：明皇室第 8 字「翊」
node src/cli.ts gen --surname 沈 --era ming --generation ming-imperial --generation-index 8

# 法宝：材质/意象/功能 + 器型，不带品阶
node src/cli.ts artifact gen --count 6 --seed 42

# 宗门：双字前缀 + 宗/门/派/宫/教
node src/cli.ts sect gen --count 9 --seed 42

# 丹药：普通功效丹 / 高级通用丹
node src/cli.ts pill gen --count 8 --seed 42
node src/cli.ts pill gen --count 8 --mode high --seed 42

# 功法：A + B + C；B 可以是空槽 ∅
node src/cli.ts technique gen --count 8 --seed 42

# 本地 HTTP ＋ Web UI
node src/cli.ts serve --port 5178
# 浏览器打开 http://127.0.0.1:5178/

# 测试（42 core ＋ 6 M3）
npm test

# 类型检查 / 浏览器 bundle（需要本地 TypeScript / esbuild）
npm run typecheck
npm run bundle:web
```

> `data/seed/` 是手工测试包；`data/packs/cbdb/` 是真实 CBDB 包（500 姓 / 1,781 字 / 25,000 双字名 / 418,076 碰撞名），**CC BY-NC-SA，个人自用**；`data/packs/core/` 是 CNC + seed 的 Apache-2.0 包（500 姓 / 1,446 字 / 23,177 名）。审计数字见 [reports/data-audit-20261031.md](reports/data-audit-20261031.md)，构建细节见 [reports/pack-build-20261031.md](reports/pack-build-20261031.md)。

---

## 它生成什么

以「宋 · 士族 · 男 · 雅正」为例：

| 姓 | 名 | 字 | 说明 |
|---|---|---|---|
| 沈 | 玄清 | 澄之 | 玄＝幽远，清＝澄澈；清→澄，同义 |
| 崔 | 望川 | 临渊 | 望→临，登高临水，引申 |
| 谢 | 知微 | 见著 | 见微知著，用典＋引申 |

> 上表为**示意**，不是真实生成结果；M1 起用固定种子可以复现。

### 名与字辈不是一回事

| 层 | 是什么 | 例 | 生成依据 |
|---|---|---|---|
| **姓** | 家族标识 | 沈 | 时代频率 × 阶层偏好 × 地域（P1） |
| **名** | 本名 | 玄清 | 字频、性别倾向、双字共现、音形义 |
| **字辈** | 同宗同代共用的一个字 | 翊 | 用户输入 / 明皇室 / 2 个通用模板 |

v0.6 起不再生成表字（字）；修仙与历史项目都只用姓名，必要时加字辈。

### 可调维度

| 维度 | 取值 |
|---|---|
| 时代 | 先秦 / 汉 / 魏晋 / 唐 / 宋 / 明 / 清 / 仙侠 |
| 风格 | 雅正 / 清冷 / 雄浑 / 仙逸 / 质朴 / 绮丽 |
| 阶层 | 士族 / 寒门 / 僧道 / 江湖 / 宫闱 / 仙门 |
| 性别 | male / female / any |
| 克制度 | 0（网文）– 1（史传） |
| 名字长度 | auto / 1 字 / 2 字 |
| 字辈 | 不启用 / 明皇室 / 通用 A / 通用 B / 自定义 |
| 用典 | 不限制 / chuci / shijing / lunyu / all |
| 姓氏输入 | 只接受 1–4 个汉字；数字/字母/符号会被拒绝 |
| 批量模式 | stable（默认）/ diverse |

> `--surname` 只接受 1–4 个汉字；`--allusion` 只接受 `chuci` / `shijing` / `lunyu` / `all`。

### 字辈

字辈默认不启用；启用时可选明皇室、通用 A/B，或粘贴自定义诗。字辈是同一宗族、同一代共用的一个字，通常放在名的第一字（明皇室：朱高炽、朱瞻基、朱祁镇……），也可以放第二字。

> 开关是 `generation`：默认关闭；不会因为时代选「明」就自动启用。

- **用户输入**：粘贴字辈诗，标点/空白自动去掉；
- **内置模板**：
  - `ming-imperial`：明朝皇室（燕王系）20 字「高瞻祁见祐，厚载翊常由，慈和怡伯仲，简靖迪先猷」；
  - `generic-a`：通用模板「文德承先世，诗书启后贤，忠孝传家远，清和继泽长」；
  - `generic-b`：通用模板「永绍祖泽，克振家声，守正崇学，光启文明，诗礼传家」。
- 指定 1-based 的辈分序号和位置（first/second）；字辈模式强制双字名。
- 可限定 `applyTo`（all / male / female）；不匹配的人不启用字辈，便于混合性别批次。明皇室模板用于 female 时只给提示，不阻断。

### 音形过滤

- 双字名检查：双三声、同声调、同声母、同韵母；
- 姓与名之间检查：同声母、同韵母；
- 命中后最多重掷 4 次；仍冲突则输出 `phonetic_relaxed` 提示。
- 同偏旁/总笔画：已从 Unihan 18.0 导入 `radical`/`strokes`，双字同偏旁 `-0.08`，总笔画 > 40 `-0.10`。

### 采样与批量多样性

- 候选先打分（频次、性别、风格、音形、偏旁/笔画），取子集 top-K（24），再按 softmax 抽样；
- `diverse` 模式在配额之上加 MMR：`final = score - 0.15 × maxSimilarity(已选)`；
- `stable` 模式仍按人物派生 seed，追加/删除不影响其他人。

### 风格标签

- 来源：seed 的 124 字 ＋ `data/lexicons/styles.json` 手工词表；
- `cbdb` 包 323/1,781 字有标签；`core` 包类似；
- 指定 `style` 时，双字名优先从至少一个字匹配的候选里抽；没有匹配时退回全局池。
- 字辈字不参与「首字/末字配额」；另一个字仍按音形义生成。
- 通用模板是项目自建，不对应真实宗族；明皇室模板只覆盖燕王系，其他藩系可自定义。

> 明皇室模板是历史参考，不表示生成结果与明代宗室有关。

### 僧道法名式

- 只在 `class=僧道` 时启用，默认 35% 概率；
- 形式：`道 / 法 / 僧 + 名`，例如 `道兴`、`法全`、`僧律`；
- 其他阶层不变；`之`、`伯仲叔` 没有塞进僧道，仍按普通名处理；
- 字辈启用时优先字辈，不套法名式。

> 这是题材约定，不是历史统计；当前只覆盖“前缀式”，没有完整法名/道名词典。

### 经典用典（楚辞 / 诗经 / 论语）

- 来源：`chinese-poetry` 的楚辞 65 篇、诗经 305 篇、论语 20 篇；
- 合并提取 **23,217 个双字索引**，每个带 `corpus/source/line`；
- `--allusion chuci|shijing|lunyu|all` 只从对应语料的双字名里抽；
- 实测：`峻茂`、`妙仪` 有楚辞出处；`琼英`、`思服` 有诗经出处；`文会`、`三变` 有论语出处；
- **`文澜` 不在楚辞/诗经/论语文本中**，不会伪造出处。

```bash
node src/cli.ts gen --allusion shijing --count 5
node src/cli.ts gen --allusion lunyu --count 5
node src/cli.ts gen --allusion all --count 5
```

---

## 为什么不是「随机抽字」

随机抽字的取名器，玩十分钟就会露馅：满屏「李玄」「王轩」「张子墨」，姓氏永远是李王张，名永远是那几个网红字。

名箓的做法是：

1. **姓氏有时代和阶层**——宋代士族和明代军户的姓氏分布不一样；复姓在魏晋和仙侠里的权重也不一样。
2. **名字从真实共现里学**——不是「玄 ＋ 清」两个好字硬拼，而是看六十万历史人物和一百二十万现代姓名里，哪些字真的会放在一起。
3. **音形义过滤**——平仄/声调、声母韵母、偏旁/笔画、生僻字、不雅谐音，逐项扣分或重掷。
4. **批量去重**——一千个 NPC 不能像一家人；`diverse` 模式用 MMR ＋ 姓氏/首字/末字配额拉开距离，`stable` 模式保证追加/删除人物不影响其他人。
5. **可解释、可复现**——每个字给出处，每个结果带 seed；同 seed ＋ 同 profile ＋ 同数据包 ＝ 同一个名字。

---

## 快速开始（完整数据形态）

> 发布后的命令；当前原型请用上一节的 `node src/cli.ts`。

### 命令行

```bash
npm i -g minglu

# 生成 5 个宋代士族男性的名字
minglu gen --era song --gender male --class 士族 --style 雅正 --count 5 --seed 42

# 指定姓氏，输出 JSON
minglu gen --surname 沈 --given-length 2 --json

# 字辈：明皇室第 8 字「翊」，生成「沈翊×」
minglu gen --surname 沈 --generation ming-imperial --generation-index 8

# 字辈：自定义字辈诗，第 3 字
minglu gen --generation "文德承先世诗书启后贤" --generation-index 3

# 批量导出 CSV
minglu batch --profile ./profiles/sect.json --count 1000 --out ./out/sect.csv

# 查重名、谐音、生僻字
minglu check 沈玄清 --against famous,cbdb --phonetic
```

`profiles/sect.json` 就是一组 profile 字段：

```json
{
  "era": "xianxia",
  "class": "仙门",
  "style": ["仙逸", "清冷"],
  "restraint": 0.6,
  "generation": { "preset": "generic-a", "index": 3, "position": "first" },
  "mode": "diverse",
  "seed": 20261031
}
```

### 本地服务

```bash
minglu serve --port 5178
# 局域网（必须带 token）
minglu serve --allow-lan --token change-me --port 5178
```

```bash
curl -s http://127.0.0.1:5178/v1/names \
  -H 'content-type: application/json' \
  -d '{"profile":{"era":"song","gender":"male","class":"士族","style":["雅正"]},"count":3,"seed":42}'
```

默认只绑定 `127.0.0.1`，不对外网开放；局域网访问需要显式 `--allow-lan` 并带 token。

### TypeScript 库

```ts
import { createGenerator } from './src/sdk.ts'

const gen = createGenerator()   // 默认 MINGLU_PACK=seed；core/cbdb 见下

const person = gen.generate({
  era: 'song',
  gender: 'male',
  class: '士族',
  style: ['雅正'],
  seed: 42,
})

const many = gen.generateBatch({ era: 'ming', count: 100, seed: 7 })
const report = gen.check('沈玄清')
const artifacts = gen.artifacts({ count: 5, seed: 1 })

console.log(person.fullName)         // 沈玄清
console.log(person.given[0]?.pinyin) // xuán
```

```bash
# 用真实包
MINGLU_PACK=cbdb node --input-type=module -e "import {createGenerator} from './src/sdk.ts'; console.log(createGenerator().generate({seed:42}).fullName)"
```

> v0.6 起输出不再包含 `courtesy`（字）字段。

> SDK 目前面向 Node（直接跑 `.ts`）；浏览器使用 `src/browser.ts` 或已打包的 `web/minglu-sdk.js`。`package.json` 已声明 `exports`。
>
> 游戏里建议用 NPC 的稳定 ID 派生 seed（`hash(worldSeed, npcId)`），不要用数组下标；这样增删 NPC 不会串名。

### 浏览器 SDK

```bash
npm run bundle:web   # 需要本地有 esbuild；输出 web/minglu-sdk.js（约 46.9 KB）
```

```js
import { createGenerator, loadPack } from './web/minglu-sdk.js'

const pack = await loadPack('/packs/seed.json') // 或直接传入已加载的 pack 对象
const gen = createGenerator(pack)
console.log(gen.generate({ era: 'ming', seed: 42 }).fullName)
```

> 浏览器 bundle 不含 pack 数据；pack 由静态文件/接口提供。`loadPack` 只做 `fetch`，不读本地文件。

---

## 数据从哪来

| 数据源 | 规模 | 用它做什么 | 授权 |
|---|---|---|---|
| **CBDB** 中国历代人物传记资料库 | 663,571 人（2026-10-24 SQLite 实测） | 历代姓名、朝代、性别、身份；时代/地域姓氏分布；字仅审计记录，v0.6 不再生成 | **CC BY-NC-SA 4.0** |
| **Chinese-Names-Corpus** | 解析 2,543,804 条，有效 1–4 字汉字名 2,539,925 | 字频、性别倾向、双字共现、姓氏表 | Apache-2.0 |
| **chinese-poetry** | 楚辞 65 篇、诗经 305 篇、论语 20 篇；合并 23,217 个双字索引 | 经典用典、双字搭配、风格语料 | MIT（诗文公版） |
| **Unihan** | Unicode 18.0.0（构建时锁定） | 读音、部首、笔画、异体 | Unicode License |
| **通用规范汉字表** | 8,105 字（一级 3,500 / 二级 3,000 / 三级 1,605） | 可读性分级；M1 构建期用 GB2312 一级＋二级（6,763）作代理，目标通用规范 6,500 | 政府规范 |
| **项目词表** | 6 种风格 × 50–80 字；51 个负面字 | 风格标签、负面字过滤 | 项目自建 |
| **平水韵 / 词林正韵** | 公版韵书 | 平仄、韵部（P1） | 公版；数字化数据需逐项核对 |
| **公版古籍**（山海经/淮南子/本草纲目/云笈七签） | 原文 | 扩展命名的意象、材质、药名、道门词汇 | 公版；只用原文，不用今人注本 |
| **OpenCC / cnchar / pinyin-pro** | 1.1.x / 3.x / 3.x | 简繁转换、拼音、笔画、部首 | Apache-2.0 / MIT / MIT |

### 授权是硬约束，先读这段

CBDB 的数据是 **CC BY-NC-SA 4.0**：署名、**非商业**、相同方式共享。这意味着：

- 本项目定位**个人自用**，**不规划商用版本**，也不提供商用合规承诺。
- `core` 包只含 Apache-2.0 / MIT / 公版 / Unicode 来源，保留为数据分层；不再作为“商用安全路径”维护。
- `cbdb` 包由用户用自己的 CBDB 文件在本地构建，**不随工具分发**；输出带 `CC-BY-NC-SA-4.0` 标记，不公开分享。
- 每条输出都带 `license` 和 `provenance`，不剥元数据。
- 详细边界见 [需求拆解与验收标准](docs/名箓-需求拆解与验收标准.md) 第 6.9 节。

> 授权口径以 CBDB 官方 Data Licensing Terms 为准。若未来改变个人自用定位，需要重新评估授权，不在当前版本范围内。

### 隐私

Chinese-Names-Corpus 里有大量**真实现代姓名**。名箓只取聚合统计，不打包完整姓名列表：

- 字频 ≥ 5 才进入统计；
- 双字共现 ≥ 20 才进入统计；
- core pack 里没有任何一条「完整现代姓名」；
- 不做现代人物查询，不提供「这个名字是谁」的反查。

---

## 功能一览

**P0（M1–M4）**

- ✅ 姓 ＋ 名（单字/双字），8 个时代/题材档案：先秦、汉、魏晋、唐、宋、明、清、仙侠
- ✅ 性别、6 种风格、6 种阶层
- ✅ 字辈（用户输入 / 明皇室 20 字 / 2 个通用模板；指定辈分与位置）
- 🟡 音形义校验：声调/声母/韵母、偏旁/笔画、生僻字、不雅谐音
- ✅ 重名提示：内置敏感名单（手工维护）＋ 自定义黑名单；装 cbdb 包后可查历史人物全库
- ✅ 种子复现；`stable` 模式按人物派生 seed，追加/删除 NPC 不影响其他人
- ✅ 批量生成：`stable`（追加/删除不影响他人）/ `diverse`（MMR ＋ 姓氏/首字/末字配额）
- ✅ CBDB 可选包：历史人物碰撞索引（本地构建）
- ✅ CLI / 本地 HTTP / TypeScript SDK
- ✅ JSON / JSONL / CSV 导出（UTF-8 BOM 可选）
- ✅ 简繁输出

**P1**

- ⬜ 地域/郡望加权
- ⬜ 元、民国档案
- ⬜ 宗门、功法、法宝、丹药等扩展命名（M5；宗门/丹药/法宝/功法 seed 原型已可跑；法宝/功法不加品阶，单独 AC）
- ⬜ Web 试玩页
- ⬜ 单文件 HTML 试玩版（core pack 内嵌，双击即用）
- ⬜ 单文件可执行（Node SEA / Bun compile）

**明确不做**

- ❌ 八字、五行、三才五格、生肖宜忌
- ❌ 大模型实时生成
- ❌ 在线账号、云服务、付费
- ❌ 现代英文名、日文名
- ❌ 号（自号/别号/道号/法号/诨号/封号）
- ❌ 地名、洞府命名
- ❌ 避讳（国讳/家讳）
- ❌ 历史考据级真实性保证
- ❌ 现实政治人物、敏感人物姓名生成
- ❌ Unity/Godot 原生包、移动原生 SDK

### 宗门 / 功法 / 法宝 / 丹药好做吗？

**结构上比人名简单，数据上比人名难。**

- **简单**：没有姓/字/字辈/性别/时代/历史重名这些约束；模板 ＋ 词表就能出结果；多为 2–6 字；不涉及真人隐私。
- **难**：没有 CBDB 这样大规模、高质量、带标注的语料；质量偏主观；容易写成网文陈词；要避开真实宗门、功法、商标和已有作品专名；每个题材都要单独维护词表。
- **共用一个引擎**：RNG/seed、profile、模板引擎、音形义过滤、去重、批量模式、输出 schema 共用；词表、模板、评分权重、校验器按 `kind` 分开。
- **功法构词式**：`[意象/元素/动作/程度] + [动名词/空] + [诀/功/真经/妙法/篇/典/剑章/真本/直指/灵书/要义/神册/录]`。例：青木＋归元＋真经；大＋镇山＋诀；吐纳＋∅＋功（即吐纳功）。`∅` 表示中间不生成字，不是字「无」。（输入的「决」按「诀」处理）
- **程度词约束**：单字程度只保留「大」；`极/至` 不再单独当前缀，只用于 `至阳/至阴` 等双字词。程度中段用 `镇山/周天/玄关/紫府/敕雷/御霆/归元/无相`，不使用 `雷法/剑意/洗髓`。
- **法宝构词式**：`[材质/意象/功能] + [器型：剑/刀/鼎/钟/塔/印/珠/幡/镜]`。例：神意珠、铁剑、赤焰刀、万魂幡、翻天印、澄明镜。2–5 字为主，**不带品阶**。
- **宗门构词式**：`[双字前缀] + [宗/门/派/宫/教]`。例：绝意门、青林宗、栖霞门、问剑宗、衔山派、赤阳派、东极宫、天魔宫、虺心教。前缀带正道/魔道/中立与气质标签。
- **丹药构词式**：
  - 普通功效丹：`[修饰词（可无）] + [功效] + [丹/膏/散/露]`。例：壮骨丹、渡厄丹、破障丹、宁神散、恒阳固元丹、玄玉续气膏、太阴凝华露、幻月绝情散。
  - 高级通用丹：`[天地意象] + [高级意象] + [丹/膏/散/露]`。例：青木生机丹、玄霄龙象丹、九天造化丹。高级丹单独 `tier=高级`，不绑定功效。
  - 不允许“功能词修饰 + 功能功效”叠加，如 `凝+破障`、`宁神+安神`、`凝气+聚气`。
- **优先级**：M5；先法宝，再做宗门/丹药，最后功法（语义搭配最难）。地名、洞府不做。

---

## 目录结构

```
minglu/
  src/
    core/          # types / rng / data / generator / artifact / check / manifest
    cli.ts         # gen / artifact / batch / check / generation list / data info / serve
    server.ts      # 本地 HTTP（node:http）
    sdk.ts         # Node SDK
    browser.ts     # 浏览器 SDK（无 node:fs）
    openapi.ts     # OpenAPI 3.1
  data/
    seed/          # 手工种子包：surnames / chars / given-names / generations / artifacts / sects / pills / techniques / blacklist / famous
    packs/core/    # CNC+seed，Apache-2.0，可分发
    packs/cbdb/    # 真实 CBDB pack（CC BY-NC-SA，不提交、不分享）
    lexicons/      # 风格字表、负面字表（构建用）
    vendor/        # OpenCC、拼音、Unihan、经典语料（构建用）
  types/
    node-shim.d.ts # 本地最小 Node 类型声明（无 @types/node 时用）
  test/
    core.test.ts   # 42 项核心断言
    m3.test.ts     # 6 项 M3/OpenAPI 断言
  scripts/
    typecheck.mjs  # 定位本地 tsc
    bundle-web.mjs # esbuild 浏览器 bundle
  web/
    index.html     # 四标签页 Web UI（姓名/宗门/丹药/功法）
    minglu-sdk.js  # 浏览器 bundle（约 46.9 KB）
  tools/
    audit_sources.py  # M0 数据审计
    build_pack.py     # CBDB/CNC → cbdb pack
    build_core_pack.py # CNC/seed → core pack
    import_unihan.py  # Unihan.zip → 偏旁/笔画表
    build_allusions.py # 楚辞/诗经/论语 → 合并索引
  reports/
    data-audit-20261031.md
    pack-build-20261031.md
    m3-bench-20261031.md
    lexicon-source-audit-20261101.md
  profiles/        # 示例 profile
  docs/
    名箓-需求拆解与验收标准.md
  CHANGELOG.md
```

> 目标形态是 `packages/` ＋ `apps/` 的 monorepo；当前 M1 原型先用扁平 `src/`，避免过早拆包。

技术栈：TypeScript（Node 原生类型剥离）＋ Node 22＋ / 浏览器；数据构建用 Python 3.11＋；无运行时 npm 依赖。

平台限定：Web/Node（浏览器 ＋ 本地 Node 服务）；不提供 Unity/Godot 原生包。

---

## 接口

### CLI 命令

> 原型阶段用 `node src/cli.ts <command>`；`minglu` 是发布后的命令名。

| 命令 | 作用 |
|---|---|
| `minglu gen` | 生成 1–N 个名字 |
| `minglu batch` | 按 profile 批量生成并导出 |
| `minglu check` | 查重名、谐音、生僻字、字数 |
| `minglu generation list` | 列出内置字辈模板 |
| `minglu sect gen` | 生成宗门名（双字前缀 + 宗/门/派/宫/教） |
| `minglu sect list` | 列出宗门前缀/后缀 |
| `minglu pill gen` | 生成丹药名（普通功效丹 / 高级通用丹） |
| `minglu pill list` | 列出丹药词表 |
| `minglu technique gen` | 生成功法名（三槽，B 槽可为空） |
| `minglu technique list` | 列出功法词表 |
| `minglu artifact gen` | 生成法宝名（材质/意象/功能 + 器型） |
| `minglu artifact list` | 列出法宝词表 |
| `minglu serve` | 启动本地 HTTP 服务 |
| `minglu data build` | 从原始数据构建 core / cbdb 包 |
| `minglu data info` | 显示包版本、来源、授权、条数 |
| `minglu data verify` | 校验包完整性与 SHA-256 |
| `minglu data purge` | 删除本地构建的指定包 |

> 原型已实现 `gen / sect / pill / technique / artifact / batch / check / generation list / data info / serve`；`data build/verify/purge` 仍是后续目标。

### HTTP

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/` | 四标签页 Web UI（姓名/宗门/丹药/功法） |
| GET | `/health` | 健康检查 |
| GET | `/openapi.json` | OpenAPI 3.1 文档 |
| GET | `/v1/profiles` | 列出时代/风格/阶层 |
| GET | `/v1/generations` | 列出内置字辈模板 |
| GET | `/v1/artifact-parts` | 列法宝修饰词/器型 |
| POST | `/v1/artifacts` | 生成法宝 |
| GET | `/v1/sect-parts` | 列宗门前缀/后缀 |
| POST | `/v1/sects` | 生成宗门 |
| GET | `/v1/pill-parts` | 列丹药词表 |
| POST | `/v1/pills` | 生成丹药 |
| GET | `/v1/technique-parts` | 列功法词表 |
| POST | `/v1/techniques` | 生成功法 |
| GET | `/v1/packs` | 列出已加载数据包 |
| GET | `/v1/pack` | 返回完整 pack JSON（浏览器 SDK 用） |
| POST | `/v1/names` | 生成 1–1000 个名字 |
| POST | `/v1/names/check` | 查重名/谐音 |
| POST | `/v1/batch` | 大批量生成（流式 JSONL，最多 100000） |

> 原型已实现上述全部端点，并带 `/` 四标签页 Web UI；局域网需 `--allow-lan --token`，默认只绑定 `127.0.0.1`。

统一响应：

```jsonc
{
  "ok": true,
  "data": [ /* PersonName */ ],
  "meta": {
    "seed": 42,
    "count": 3,
    "pack": { "core": "1.0.0" },
    "license": "Apache-2.0",
    "disclaimer": "Names are fictional and may coincide with real persons.",
    "elapsedMs": 3
  }
}
```

错误：

```jsonc
{
  "ok": false,
  "error": {
    "code": "E_PROFILE_INVALID",
    "message": "unknown era: songx",
    "hint": "valid: preqin, han, weijin, tang, song, ming, qing, xianxia"
  }
}
```

### 输出

```jsonc
{
  "schemaVersion": "1.0",
  "fullName": "沈玄清",
  "surname": { "text": "沈", "pinyin": "shěn", "tone": 3 },
  "given": [
    {
      "char": "玄",
      "pinyin": "xuán",
      "tone": 2,
      "meaning": "幽远；天之色",
      "sources": ["cnc:char", "unihan:definition"]
    },
    {
      "char": "清",
      "pinyin": "qīng",
      "tone": 1,
      "meaning": "澄澈；清朗",
      "sources": ["poetry:allusion:..."]
    }
  ],
  "generation": null,
  "allusion": { "corpus": "chuci", "source": "楚辞·离骚·离骚", "line": "路漫漫其修远兮，吾将上下而求索。" },
  "score": 0.87,
  "warnings": [],
  "seed": 42,
  "profileHash": "sha256:...",
  "pack": { "core": "1.0.0" },
  "license": "Apache-2.0",
  "provenance": ["cnc@2025-11-09", "poetry@2026-06-17", "unihan@18.0.0", "lexicon@1.0.0"]
}
```

> 字段只增不改；v0.6 移除 `courtesy`（字），消费方需适配。

---

## 质量怎么保证

| 指标 | 目标 | 测法 |
|---|---|---|
| 1000 个名字内部重复 | 0 | 自动 |
| 生僻字率（默认，显式字辈除外） | 0% | 自动 |
| 无调号率（默认） | 0% | 自动 |
| 不雅谐音命中 | 0 / 10,000 | 自动 |
| 历史名人完全重名 | 0 / 1,000 | 自动 |
| 时代匹配 | ≥ 70% | 3 人盲评 |
| 风格匹配 | ≥ 70% | 3 人盲评 |
| 字名关联 | ≥ 80% | 3 人盲评 |
| 用典准确 | ≥ 95% | 抽样 100 |
| 单名生成 P95 | < 5 ms | 基准 |
| core pack | ≤ 25 MB / ≤ 8 MB gzip | CI |

> 以上为完整数据包目标；seed 原型只验证管线，不参与验收。

完整 78 条有效验收标准（另 7 条因移除字/号作废）见 [需求拆解与验收标准](docs/名箓-需求拆解与验收标准.md) 第 9 节。改动生成算法或数据后必须重跑；全部「必须」项通过才发布。

---

## 已知限制

1. **统计可信 ≠ 史实考据**：名字符合语料分布，不等于历史上真的有人这么叫。
2. **CBDB 偏置**：收录以精英、男性、有传记者为主；平民、女性样本偏少。寒门/女性 profile 会用诗词与人工词典补，但仍不完美。
3. **现代语料偏置**：120 万现代姓名只能提供「可读性」和「字频」，不能提供「古风」；古风主要靠 CBDB ＋ 时代档案。
4. **不做命理**：没有八字、五行、五格、生肖。想要这些请用别的工具。
5. **只有普通话读音**：没有中古音、方言、平水韵默认校验（P1 才做韵部）。
6. **重名与撞梗不可避免**：再多的过滤也挡不住「沈清」「顾言」这类组合；工具会给提示，不保证独一无二。
7. **语义组合靠统计**：偶尔会生成「字都对、连起来怪」的名字；批量生成后建议人工过一遍。
8. **CBDB 包非商用**：个人自用，不公开分享；项目不规划商用版本，不做商用合规承诺。
9. **繁简/异体**：OpenCC 转换个别姓名用字会有异体差异。
10. **字体**：默认字表在 Noto Serif SC / 思源宋体下应全部可显示；冷门字体可能缺字。默认不生成《通用规范汉字表》以外的字，极生僻的历史用字需自定义词典（P1）。
11. **字辈模板**：明皇室模板只覆盖燕王系；通用 A/B 是项目自建，不保证对应你的家谱，正式用请粘贴自己的字辈诗。
12. **seed 原型规模很小**：124 个用字、50 个双字名、72 个姓氏；重复率高，只用于验证接口与管线，不代表最终质量。
13. **法宝 seed 原型**：51 个修饰词、20 个器型；只验证组合规则，不代表最终词表。
14. **cbdb pack 的简繁/拼音**：已用 OpenCC 单字映射做简繁；词组/异体可能残留。**包内 1,781 个字全部有调号**；1,780 个在 GB2312 内，`祐` 是明皇室字辈的显式例外。无调号、非 GB2312、极冷门的字已在构建期剔除（显式字辈除外）。
15. **cbdb pack 的风格标签**：323/1,781 个字有标签（seed 124 ＋ 手工词表）；其余无标签，风格过滤会退化。
16. **碰撞索引**：`check` 已查 CBDB 418,076 条历史姓名；生成时仍只硬拒绝 seed 名人名单，不做全库硬拒绝。
17. **core pack 偏现代**：CNC 是 120 万现代姓名分布，core 只是数据分层，不代表商用计划；历史风格请用 cbdb 包。
18. **core pack 姓氏拼音**：只覆盖 seed 的 72 个同姓，其余姓氏拼音为空；名用字拼音来自拼音表。
19. **M2 未完成项**：盲评未做；偏旁/笔画已从 Unihan 18.0 导入（102,999 字，pack 内全量覆盖）；楚辞/诗经/论语合并 23,217 个双字索引已接入，`文澜` 不在其中。softmax/top-K 与 MMR 已实现。
20. **M3 状态**：CI 6/6 全绿；AC-58 OpenCC 往返 100/100；静态 pack、RSS/泄漏、OpenAPI、`tsc`、bundle 均已完成。Web UI 已扩展为姓名/宗门/丹药/功法四标签页。
21. **僧道法名式**：只覆盖 `道/法/僧 + 名` 前缀式，没有完整法名/道名词典；`之`、`伯仲叔` 没有特判。
22. **宗门 seed 原型**：164 个双字前缀、5 个后缀；只做“前缀 + 宗/门/派/宫/教”，没有四字前缀、驻地、传承、职阶体系。正道/魔道/中立是手工标签，不是语义模型判断。
23. **丹药 seed 原型**：29 个天地修饰词、48 个功效、54 个高级意象、4 个后缀；普通丹 3/5 字，高级丹 5 字；不做完整药性/丹方体系。
24. **功法 seed 原型**：77 个起手词、51 个中段、13 个后缀；只做 A+B+C / A+∅+C，没有品阶、修炼阶段、威力数值。B 槽为空时输出中 `middle` 为 `null`，不会写成「无」。程度词只保留单字「大」作前缀；`极/至` 不再单独当前缀，`洗髓` 不与程度词搭配。
25. **专名黑名单**：法宝 1、宗门 9、丹药 11、功法 3；仅覆盖真实药品/宗教/影视标题，游戏/小说中的泛专名不默认拦截，扩表时按此口径补。

---

## 路线图

| 阶段 | 交付 | 验收 |
|---|---|---|
| **M0** | 规格、数据审计、授权清单 | 本文档 ＋ AC 评审通过 |
| **M1** | core 引擎、CLI、core pack（名） | AC-11~16、22~26、43~45、51、59~61、66~70 |
| **M2** | 字辈、音形义、批量多样性 | AC-17~21、27~34、42、46~50 |
| **M3** | HTTP、SDK、Web、导出 | AC-52~58、62~65、71~73 |
| **M4** | CBDB pack、碰撞索引 | AC-01~10、74~79 |
| **M5** | 法宝/宗门/丹药/功法 | 单独 AC |

> M5 的 16 条验收标准见 [需求拆解与验收标准](docs/名箓-需求拆解与验收标准.md) 9.2 节；其中 M5-09 规定丹药/功法的前缀/核心/中段不得与后缀同词，M5-16 黑名单为法宝 1 / 宗门 9 / 丹药 11 / 功法 3。词表扩展候选见 [来源审计](reports/lexicon-source-audit-20261101.md)。

## 实现状态（M1/M2/M3 原型：seed + core + cbdb）

| 项 | 状态 |
|---|---|
| 规格 | ✅ v0.6 |
| 核心生成器 | 🟡 姓 / 名 / 字辈；无字、无号；seed / core / cbdb 三包 |
| CLI | 🟡 `gen` / `artifact` / `batch` / `check` / `generation list` / `data info` / `serve` |
| 本地 HTTP | ✅ 17 个 JSON API ＋ `/v1/batch` 流式 JSONL ＋ `/openapi.json` |
| Web UI | ✅ `/` 四标签页（姓名/宗门/丹药/功法）；首次生成时加载 `/v1/pack`，之后走浏览器 SDK |
| TypeScript SDK | ✅ Node `createGenerator`；`tsc --noEmit` 通过（本地 shim） |
| 浏览器 SDK | ✅ `web/minglu-sdk.js`（约 46.9 KB，esbuild） |
| OpenAPI | ✅ 3.1；6 项结构/ref/路由/零网络/AC-58 测试 |
| CI | ✅ GitHub Actions 6/6 全绿（Ubuntu/Windows/macOS × Node 22/24） |
| 测试 | ✅ 48 项（42 core ＋ 6 M3；`npm test`） |
| 音形过滤 | 🟡 双三声/同调/同声母/同韵母/姓—名冲突重掷；偏旁/笔画已计入打分 |
| 风格标签 | 🟡 cbdb 323/1,781 字有标签（seed ＋ 手工词表） |
| 采样/多样性 | ✅ 候选子集 top-K softmax；diverse 有 MMR ＋ 配额 |
| 法宝 seed 原型 | 🟡 材质/意象/功能 + 器型；无品阶 |
| 宗门 seed 原型 | 🟡 164 个双字前缀 + 5 个后缀；正道/魔道/中立 + 气质标签 |
| 丹药 seed 原型 | 🟡 29 天地修饰 + 48 功效 + 54 高级意象 + 4 后缀；普通/高级双模式 |
| 功法 seed 原型 | 🟡 77 个起手词 + 51 个中段 + 13 个后缀；B 槽可为空 |
| 数据包 | ✅ `core`（CNC+seed, Apache-2.0）；🟡 `cbdb`（500 姓 / 1,781 字 / 25,000 名 / 418,076 碰撞名, CC BY-NC-SA） |
| M0 审计 | ✅ CBDB/CNC 实测；chinese-poetry 的楚辞/诗经/论语已接入 |
| M1/M2 验收 | ⬜ 未逐条验收，当前是 seed/core/cbdb 原型 |
| M3 验收 | ✅ CI 6/6 全绿；AC-58 往返 100/100；Web UI 四标签页 |
| M5 验收 | ✅ 16/16；黑名单：法宝 1 / 宗门 9 / 丹药 11 / 功法 3 |

---

## 数据修正与贡献

- **数据错了**：提 issue，附「来源 / 当前值 / 期望值 / 依据」。
- **想加风格或词典**：改 `data/lexicons/*.json`，然后重建 pack；不用改引擎。
- **名字不好听**：在试玩页点「不喜欢」，选原因（太现代/太中二/谐音/生僻/性别不符）。默认不记录名字本身，只记录原因计数。

---

## 免责声明

名箓生成的所有姓名均为**虚构**，用于小说、游戏、跑团等创作场景，不代表历史真实人物，也不应用于户籍、证件、正式文书。

与真实人物重名纯属统计巧合；发布前请自行做敏感名单与商标核查。

CBDB 数据的使用受其 Data Licensing Terms 约束；本项目不提供法律意见。

> 文档结构参考工作区的《混凝土养护龄期计算器》README 与《修仙人生重开模拟器-需求拆解与验收标准》。

---

*名箓 v0.6 · 2026-10-31 · 规格稿*


