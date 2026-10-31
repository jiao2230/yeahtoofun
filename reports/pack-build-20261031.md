# pack 构建报告（cbdb + core）

> 日期：2026-10-31
> 输入：`cbdb_20261024/cbdb_20261024.sqlite3`（560 MB）、`Chinese-Names-Corpus-master/`
> 输出：`data/packs/cbdb/`、`data/packs/core/`

---

## 1. cbdb pack

**授权：CC BY-NC-SA 4.0，个人自用，不分享。**

| 文件 | 内容 | 数量 |
|---|---|---:|
| `surnames.json` | 姓氏（含复姓标记、罗马字） | 500 |
| `chars.json` | 名用字（频率/性别倾向/拼音/风格） | 1,781 |
| `given-names.json` | 双字名（CBDB 名内共现 ＋ 经典双字） | 25,000 |
| `generations.json` | 字辈模板 | 3 |
| `allusions.json` | 楚辞/诗经/论语双字 → 出处索引 | 23,217 |
| `artifacts.json` | 法宝词表 | 38 + 20 |
| `collision.json` | CBDB 历史姓名碰撞索引 | 418,076 |
| `pack.json` | manifest | — |

总体积约 9.7 MB（含碰撞索引与经典索引）；core 约 5.2 MB。

### 来源与过滤

- 姓氏：`BIOG_MAIN.c_surname_chn`，GB2312 常用字，Top 500；`c_surname` 罗马字小写。
- 用字：`c_mingzi_chn` 的 1–2 字名；**GB2312 一级+二级、频次 ≥ 20、必须有调号**；性别由 `c_female` 统计。
- 双字名：`c_mingzi_chn` 的 2 字名，两字都在用字表，Top 20,000（频次 ≥ 2）；再并入楚辞/诗经/论语双字名（低权重）。
- 经典：`chinese-poetry` 楚辞 65 篇、诗经 305 篇、论语 20 篇，合并 23,217 个双字索引，保留 corpus/source/line。
- 碰撞：`c_name_chn` 的 1–4 字名，简繁归一后去重，418,076 条。
- 简繁：用 OpenCC `STCharacters` 反转成 T→S 单字映射；词组/异体仍可能有残留。
- 拼音：`kMandarin_8105` 前 5,719 字 ＋ `kHanyuPinlu` 合并；**包内 1,781 字全部有调号**，无调号字在构建期剔除。
- 偏旁/笔画：Unihan 18.0，102,999 字；包内 1,781 字全部有 `radical`/`strokes`。
- 例外：明皇室字辈的 `祐` 不在 GB2312，作为显式模板字保留（1,780 个 GB2312 ＋ 1 个模板例外）。
- 不含号：ALTNAME code=5 的室名/别号未使用。

### 已知限制

1. 单字简繁映射，词组/异体可能残留繁体。
2. 极冷门、无调号、非 GB2312 的字已在构建期剔除；异体字仍有少量可能漏网。
3. 风格标签覆盖 323/1,781 字（seed 124 ＋ `data/lexicons/styles.json`），其余为空；负面字表 51 字已过滤。
4. 女性仅 8.9%，女性名需诗词/人工词典补样。
5. 本项目个人自用、不规划商用；cbdb 包不公开分享。

### 使用

```bash
MINGLU_PACK=cbdb node src/cli.ts gen --era song --gender male --class 士族 --seed 42 --json
# PowerShell: $env:MINGLU_PACK='cbdb'; node src/cli.ts gen ...
```

---

## 2. core pack

**授权：Apache-2.0（CNC 为 Apache-2.0；seed 为项目自建）。**

| 文件 | 内容 | 数量 |
|---|---|---:|
| `surnames.json` | CNC 首字姓氏 | 500 |
| `chars.json` | CNC 名用字 | 1,446 |
| `given-names.json` | CNC 双字名 ＋ 经典双字 | 23,177 |
| `generations.json` | 字辈模板 | 3 |
| `allusions.json` | 楚辞/诗经/论语双字 → 出处索引 | 23,217 |
| `artifacts.json` | 法宝词表 | 38 + 20 |
| `pack.json` | manifest | — |

- 来源：`Chinese_Names_Corpus（120W）.txt` ＋ `Chinese_Names_Corpus_Gender（120W）.txt` ＋ seed。
- 同样执行 GB2312 一级+二级、频次 ≥ 20、调号 > 0 过滤；双字名 23,177（含经典）。
- 不含 CBDB，作为数据分层；项目本身不规划商用；它是**现代姓名分布**，不是历史分布。
- 字辈/法宝词表来自 seed。
- 无碰撞索引（CNC 含真实姓名，不打包完整名单）。

### 使用

```bash
MINGLU_PACK=core node src/cli.ts gen --era song --gender male --class 士族 --seed 42 --json
# PowerShell: $env:MINGLU_PACK='core'; node src/cli.ts gen ...
```

---

## 3. 复跑

```bash
python tools/build_pack.py --cbdb ./cbdb_20261024/cbdb_20261024.sqlite3 \
  --cnc ./Chinese-Names-Corpus-master --out ./data/packs/cbdb

python tools/build_core_pack.py --cnc ./Chinese-Names-Corpus-master --out ./data/packs/core
```

原始数据与 `data/packs/cbdb/` 已加入 `.gitignore`；`data/packs/core/` 技术上可分发，但项目不规划商用。

---

*名箓 M1 · 2026-10-31*
