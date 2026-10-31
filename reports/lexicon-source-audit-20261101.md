# 词表扩展来源审计

> 日期：2026-11-01
> 范围：宗门、丹药、功法、法宝四类扩展词表
> 结论：先接 **MIT 现成词表** 做候选，再用 **公版古籍原文** 补古典词；不直接引入授权不清的大型古籍库。

---

## 1. 结论先行

| 优先级 | 来源 | 能补什么 | 授权 | 建议 |
|---|---|---|---|---|
| P0 | [xiuxian-vocabulary](https://github.com/zhaotoday/xiuxian-vocabulary) | 宗门、丹药、功法、法宝的现代修仙候选词 | MIT | 可直接做候选池；必须去品阶、去真实专名、人工过一遍 |
| P0 | [维基文库·云笈七签](https://zh.wikisource.org/wiki/雲笈七籤) | 道教丹药、功法、意象词 | 古籍公版；站点贡献 CC BY-SA 4.0 | 抓原文，排除注释/模板；适合 2–4 字候选 |
| P0 | [维基文库·抱朴子](https://zh.wikisource.org/wiki/抱朴子) | 炼丹、服食、功法、古语 | 古籍公版 | 同上；内篇优先 |
| P1 | [维基文库·山海经](https://zh.wikisource.org/wiki/山海經) | 异兽、灵材、法宝意象 | 古籍公版；页面标注 75% 校订 | 适合灵材/异兽/法宝，不适合宗门 |
| P1 | [维基文库·本草纲目](https://zh.wikisource.org/wiki/本草綱目) | 药材、丹方、药性词 | 古籍公版；页面标注未校订、25% | 只能做药材候选，错误率高，必须人工核 |
| P1 | [THUOCL](https://github.com/thunlp/THUOCL) | 诗词、动物、植物、医学等通用词 | MIT | 只取 poem/animal 做意象候选；不是古风词库 |
| P2 | [殆知阁](https://daizhige.org/about) / [daizhigev20](https://github.com/daizhige-org/daizhigev20) | 大量公版古籍原文 | 站点主张原文公版；仓库无 license；标点/校记版权不清 | 只做检索/核对，不整库入库、不再分发 |
| ❌ | [ancient-literature](https://github.com/cangkutou/ancient-literature) | 殆知阁镜像 | 仓库无 license，2.1 GB | 不使用 |
| ❌ | [ctext](https://ctext.org/) / [Kanripo](https://github.com/kanripo) | 古籍原文 | 条款/数据许可需逐项核验；仓库常无 license | 只做人工核对，不批量抓取 |
| ❌ | 百度百科、维基百科、小说/游戏 Wiki | 二手词条 | 版权归原作者/站点；百科还有 CC BY-SA 义务 | 不作为词表来源 |

---

## 2. 现成词表：xiuxian-vocabulary

- 仓库：[zhaotoday/xiuxian-vocabulary](https://github.com/zhaotoday/xiuxian-vocabulary)
- 授权：**MIT**
- 规模：自称 500+ 词；`docs/vocabulary-index.md` 中可提取出 **244 个唯一加粗词条**
- 分类：修炼境界、功法武学、灵药丹方、神兵利器、修仙门派、天材地宝、阵法符箓、妖魔鬼怪、修仙地域、职业、术语
- 优点：结构清楚、可直接读取、MIT 可派生
- 缺点：
  - 面向修仙短剧，偏现代网文，不是古典语料
  - 有完整品阶体系（凡级/灵级/…、一品/二品/…），与本项目「法宝/功法不加品阶」冲突
  - 混有真实/知名专名（轩辕剑、诛仙剑、九阴真经、少林寺等）
  - 很多是泛词（修炼、突破、法宝），直接入库会污染词表

**建议用法**：只作为候选池，抽取 2–4 字词，按四类人工筛选；先去品阶词、泛词、真实专名，再进 seed。不要整份复制。

---

## 3. 公版古籍：维基文库

维基文库正文可稳定取到 raw wikitext：

```text
https://zh.wikisource.org/w/index.php?title=雲笈七籤/01&action=raw
https://zh.wikisource.org/w/index.php?title=抱朴子/卷01&action=raw
https://zh.wikisource.org/w/index.php?title=山海經/南山經&action=raw
```

### 3.1 云笈七签

- 页面：[雲笈七籤](https://zh.wikisource.org/wiki/雲笈七籤)
- 北宋张君房编，122 卷；页面可访问，子页 `/01` … `/122`
- 内容覆盖：道教经教、服食炼气、内丹外丹、方药符图、仙真传记
- 适合：丹药核心/修饰词、功法意象、宗门气质词
- 注意：大量宗教术语、人名、地名；需要停用词和人工过滤

### 3.2 抱朴子

- 页面：[抱朴子](https://zh.wikisource.org/wiki/抱朴子)
- 东晋葛洪；内篇 20 卷、外篇 50 卷
- 适合：炼丹、服食、功法、古语搭配
- 注意：内篇更适合丹/功法；外篇偏政论，不要混入

### 3.3 山海经

- 页面：[山海經](https://zh.wikisource.org/wiki/山海經)
- 页面标注 75% 校订；内容含异兽、草木、金玉、山川
- 适合：灵材、异兽、法宝意象
- 注意：大量生僻字、异体字；必须过现有 GB2312/常用字过滤

### 3.4 本草纲目

- 页面：[本草綱目](https://zh.wikisource.org/wiki/本草綱目)
- 页面标注 `{{未校訂}}`、`textquality 25%`
- 适合：药材、药性、丹方词
- 注意：OCR/录入错误较多，不适合直接生成名字；只能作为候选，人工核对原文

> 维基文库贡献文本按 CC BY-SA 4.0 / GFDL 发布；古籍原文本身已进入公有领域。派生时保留来源、许可证与页面链接。

---

## 4. 大型古籍库：能用但不要整库入库

### 殆知阁

- 说明：[daizhige.org/about](https://daizhige.org/about)
- 数据：[daizhige-org/daizhigev20](https://github.com/daizhige-org/daizhigev20)
- 规模：约 2–3 GB，1.8 万部；含道藏、医藏、子藏等
- 站点认为：忠实录入的公版古籍原文不产生新版权；但**现代标点、校记、提要**可能有版权
- 仓库本身**没有 license 文件**

**建议**：只把它当检索/核对工具；不要 clone 整库进项目，不要把它的标点/校记当自有数据分发。若要用某部书，回到维基文库/公版扫描件核对原文。

### 镜像仓库

- [cangkutou/ancient-literature](https://github.com/cangkutou/ancient-literature)：2.1 GB，无 license
- 不建议使用。

### ctext / Kanripo

- [ctext](https://ctext.org/)：有 API，但条款/抓取限制需逐项确认
- [Kanripo](https://github.com/kanripo)：仓库多为无 license 的文本仓库
- 建议只做人工核对，不做批量抓取和再分发。

---

## 5. 推荐落地顺序

1. **先做 MIT 候选池**
   - 从 `xiuxian-vocabulary` 抽 2–4 字词
   - 去品阶词、泛词、真实专名
   - 人工过一遍，分到宗门/丹药/功法/法宝
2. **再接公版古籍**
   - 先接 `云笈七签` + `抱朴子`（丹/功法）
   - 再接 `山海经`（灵材/异兽/法宝）
   - `本草纲目` 最后接，且只做药材候选
3. **抽取规则**
   - 只取 2–4 字连续汉字
   - 频次 ≥ 3；去停用词、虚词、人名、地名
   - 过 GB2312/常用字、异体字、黑名单
   - 输出候选 TSV：`term, kind, source, license, line`
4. **人工审核**
   - 每类先加 50–100 个，不追求一次扩到几千
   - 保留来源和许可证，运行时仍然零网络
5. **不要做的**
   - 不把整部古籍/整库 JSON 放进运行时 pack
   - 不抓百科/小说站/游戏 Wiki
   - 不把现代品阶体系带进功法/法宝

---

## 6. 建议的下一步

先实现 `tools/build_lexicon_candidates.py`：

- 输入：本地 `xiuxian-vocabulary` Markdown / 维基文库 raw 文本
- 输出：`reports/lexicon-candidates-*.tsv`
- 只生成候选，不直接改 seed
- 人工筛完后，再把确认的词合并进 `data/seed/{sects,pills,techniques,artifacts}.json`

这样词表扩展和运行时生成仍然分离，授权链也可追溯。

---

*名箓 · 词表来源审计 · 2026-11-01*
