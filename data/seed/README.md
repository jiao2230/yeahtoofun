# seed pack

手工种子包，仅用于验证 M1 管线，不是 CBDB/CNC 的真实统计结果。

| 文件 | 内容 | 数量 |
|---|---|---:|
| `surnames.json` | 单姓 + 复姓 | 72 |
| `chars.json` | 名字用字（拼音/声调/字义/性别/风格） | 124 |
| `given-names.json` | 双字名 | 50 |
| `generations.json` | 字辈模板 | 3 |
| `artifacts.json` | 法宝修饰词 + 器型 | 38 + 20 |
| `sects.json` | 宗门前缀 + 后缀 | 107 + 5 |
| `pills.json` | 丹药修饰词 + 核心 + 后缀 | 50 + 69 + 4 |
| `blacklist.json` | 不雅谐音/黑名单 | 7 |
| `famous.json` | 历史名人碰撞示例 | 10 |

替换方式：保持字段不变，直接替换 JSON；或按 M0 审计结果生成同构 pack。

> v0.6 起不再生成表字，`courtesy.json` 已移除。

