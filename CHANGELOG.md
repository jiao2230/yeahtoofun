# CHANGELOG

## 0.6.0 — 2026-10-31

### Removed

- 移除「字」：`courtesy` 字段、名—字配对、`courtesy.json`、`--courtesy` 全部删除。
- 移除商用路线：项目定位个人自用，不规划商用版本。

### Added

- 楚辞 / 诗经 / 论语用典索引：23,217 个双字，带 `corpus/source/line`。
- `--allusion chuci|shijing|lunyu|all`。
- 僧道法名式：`道/法/僧 + 名`，35% 概率，仅 `class=僧道`。
- 宗门 seed 原型：107 个双字前缀 + `宗/门/派/宫/教`，带正道/魔道/中立与气质标签。
- 丹药 seed 原型：50 个修饰词 + 69 个核心 + `丹/膏/散/露`，支持 3 字/5 字。
- 姓氏校验：只接受 1–4 个汉字，非法报 `E_SURNAME_INVALID`。
- Unihan 18.0 偏旁/笔画：102,999 字。
- softmax / top-K 采样、MMR、diverse 配额。
- M3：`/v1/batch` 流式 JSONL、`/v1/pack` 静态 pack、OpenAPI 3.1、Web UI、Node/浏览器 SDK、CSV BOM。

### Changed

- 名字长度按 CBDB 实测校准（明 53.2% 单字，清 18.2% 单字）。
- `core` / `cbdb` 包重建为 GB2312、有调号、有偏旁/笔画。

### Verification

- `npm test`：30 core ＋ 6 M3 = 36 项通过；AC-58 OpenCC 往返 100/100。
- `npm run typecheck`：0 错误。
- GitHub Actions：Ubuntu/Windows/macOS × Node 22/24，6/6 全绿。
- M3 基准见 `reports/m3-bench-20261031.md`。

## 0.5.0

- 修正功法 B 槽语义：`吐纳 + ∅ + 功 = 吐纳功`。
- 法宝取消品阶，按材质/意象/功能 + 器型组合。
- 移除「号」，字辈改为纯开关。
