#!/usr/bin/env python3
"""Build a local female given-name pool from a Ming Qing Women's Writings CSV.

The CSV is exported from primitive-data/mqww202512.accdb by tools/export_mqww_female.ps1.
The .accdb and raw CSV stay local; only aggregate name counts and the pool are
written. The pool is intended for the local cbdb pack, not for redistribution.
"""

from __future__ import annotations

import argparse
import collections
import csv
import json
import re
from pathlib import Path

TITLES = (
    "皇后", "夫人", "太后", "贵妃", "贵人", "妃", "嫔", "氏", "某",
    "妓", "女", "妻", "母", "太君", "孺人", "安人", "宜人", "淑人",
    "无名", "佚名", "不详", "宫人", "道姑", "尼", "节妇", "烈女",
    "贞女", "孝女", "才女", "名妓", "诗妓", "女史", "女冠", "尼姑",
    "妾", "婢", "伎", "名媛",
)


def load_simplifier(path: Path) -> dict[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    table = {k: v for k, v in data.items() if isinstance(v, str) and k != v}
    table["夀"] = "寿"
    return table


def simplify(text: str, table: dict[str, str]) -> str:
    return "".join(table.get(ch, ch) for ch in text)


def split_surname(name: str, surnames: set[str], compounds: list[str]) -> tuple[str, str]:
    for compound in compounds:
        if name.startswith(compound):
            return compound, name[len(compound):]
    return name[:1], name[1:]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, default=Path("tmp/mqww-female-poets.csv"))
    parser.add_argument("--out", type=Path, default=Path("data/packs/cbdb/female-given-names-by-era.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/mqww-female-names-20261101.md"))
    args = parser.parse_args()

    rows = list(csv.DictReader(args.csv.open(encoding="utf-8-sig")))
    simplifier = load_simplifier(Path("data/vendor/opencc/ts-inverted.json"))
    surnames_data = json.loads(Path("data/packs/cbdb/surnames.json").read_text(encoding="utf-8"))
    surnames = {row["text"] for row in surnames_data}
    compounds = sorted((s for s in surnames if len(s) == 2), key=len, reverse=True)
    pack_chars = {
        row["char"]
        for row in json.loads(Path("data/packs/cbdb/chars.json").read_text(encoding="utf-8"))
    }

    counts: collections.Counter[str] = collections.Counter()
    lengths: collections.Counter[int] = collections.Counter()
    skipped_title = 0
    for row in rows:
        raw = re.sub(r"[^\u4e00-\u9fa5]", "", simplify(row.get("NameHZ", ""), simplifier))
        surname, given = split_surname(raw, surnames, compounds)
        if not surname or not given:
            continue
        if any(title in given for title in TITLES):
            skipped_title += 1
            continue
        lengths[len(given)] += 1
        if len(given) == 2 and all(ch in pack_chars for ch in given):
            counts[given] += 1

    top = counts.most_common(50)
    pool = [{"text": name, "weight": count} for name, count in counts.most_common(3000)]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps({"mingqing": pool}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    def top_with(char: str) -> tuple[int, list[tuple[str, int]]]:
        hits = [(n, c) for n, c in counts.most_common() if char in n]
        return sum(c for _, c in hits), hits[:12]

    lines = [
        "# 名箓 · MQWW 女性名统计",
        "",
        "> 来源：`primitive-data/mqww202512.accdb` 的 `poet` 表，`Sex='女'`。",
        "> 用途：本地个人研究；`.accdb` 与原始 CSV 不提交，仅保留聚合名池。",
        "> 清洗：去姓、繁转简、只取 2 字名、剔除“皇后/夫人/某氏/节妇”等身份词。",
        "",
        "## 样本",
        "",
        f"- 女性作者：{len(rows):,}",
        f"- 剔除身份词：{skipped_title:,}",
        f"- 可用双字名条数：{sum(counts.values()):,}",
        f"- 不同双字名：{len(counts):,}",
        f"- 单字名：{lengths.get(1, 0):,}",
        "",
        "## 高频女性名（top 30）",
        "",
        "、".join(f"{name}（{count}）" for name, count in top[:30]),
        "",
        "## 淑 / 媛 / 娥",
        "",
    ]
    for char in "淑媛娥":
        total, hits = top_with(char)
        lines.append(f"- `{char}`：{total} 条；" + "、".join(f"{n}（{c}）" for n, c in hits))
    lines += [
        "",
        "## 结论",
        "",
        "- MQWW 的女性名池比 CBDB 更分散，`淑媛/淑娥` 不再是绝对头部。",
        "- `淑` 仍是高频字，但 `媛/娥` 样本很少，不能据此推断时代偏好。",
        "- 这批数据主要覆盖明清、且偏有作品传世的女性，不代表平民女性。",
        "- 名池已写成 `female-given-names-by-era.json`，供本地 `cbdb` pack 使用。",
        "",
    ]
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text("\n".join(lines), encoding="utf-8")
    print(args.out)
    print(args.report)


if __name__ == "__main__":
    main()
