# vendor data

构建用的小型映射表，不参与运行时生成逻辑。

| 文件 | 来源 | 授权 | 说明 |
|---|---|---|---|
| `opencc/STCharacters.txt` | [BYVoid/OpenCC](https://github.com/BYVoid/OpenCC) | Apache-2.0 | 简→繁单字表 |
| `opencc/ts-inverted.json` | 由 `STCharacters.txt` 反转 | Apache-2.0 | 繁→简单字表（同名多繁取第一个） |
| `pinyin/kMandarin_8105_partial.txt` | [mozillazg/pinyin-data](https://github.com/mozillazg/pinyin-data) | MIT | 《通用规范汉字表》常用读音，本次只取到 U+84B9 附近 |
| `pinyin/kHanyuPinlu.txt` | 同上 | MIT | 汉语频率词典读音，作为补充 |
| `unihan/radical-strokes.json` | 由 `tools/import_unihan.py` 从 Unihan 18.0 生成 | Unicode License | 偏旁/笔画；102,999 字，构建脚本自动合并 |
| `classics/chuci.json` | [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) 楚辞 | MIT | 65 篇原文 |
| `classics/shijing.json` | 同上 诗经 | MIT | 305 篇原文 |
| `classics/lunyu.json` | 同上 论语 | MIT | 20 篇原文 |
| `classics/zhouyi.json` | [维基文库·周易](https://zh.wikisource.org/wiki/周易) | 公版；站点 CC BY-SA 4.0 | 乾、坤、系辞选段 |
| `classics/zhuangzi.json` | [维基文库·庄子](https://zh.wikisource.org/wiki/莊子) | 公版；站点 CC BY-SA 4.0 | 逍遥游选段 |
| `classics/tangshi.json` | 唐诗名篇选段（静夜思、春晓、登鹳雀楼等） | 公版 | 10 首 |
| `classics/songci.json` | 宋词名篇选段（水调歌头、念奴娇、声声慢等） | 公版 | 10 首 |
| `classics/female-allusions.json` | 人工核对女性名 → 诗经/楚辞/宋词出处 | 公版 | 26 条 |
| `classics/allusions.json` | 由 `tools/build_allusions.py` 生成 | MIT | 23,491 个双字 → 出处索引（楚辞/诗经/论语/周易/庄子/唐诗/宋词） |
| `lexicons/ATTRIBUTION.md` | 人工筛选的扩展词来源登记 | 见文件内逐项说明 | 2026-11-01 第一批宗门/丹药/功法/法宝扩展词 |

> 两份拼音表都是**部分抓取**（web fetch 有长度上限）。构建期只保留有调号的字，所以最终 pack 内 100% 有调号；完整表可在本地用 `pinyin-data` 重新生成。

构建命令：

```bash
# 一键：典故 → core → cbdb
python tools/build_data.py

# 只预览命令
python tools/build_data.py --dry-run
```
