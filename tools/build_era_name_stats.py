#!/usr/bin/env python3
"""Aggregate CBDB given names by the five project eras.

This report is for analysis only. It does not modify any pack or seed data.
CBDB data is CC BY-NC-SA 4.0 and remains local.
"""

from __future__ import annotations

import argparse
import collections
import json
import sqlite3
from pathlib import Path

# Explicit c_dy groups. CBDB has one c_dy per person; aggregate and
# sub-dynasty codes are both kept where they are meaningful.
ERA_CODES = {
    "qinhan": {1, 2, 25, 29, 46, 61, 83},
    "weijin": {
        3, 4, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 37, 39, 40,
        41, 42, 44, 45, 47, 48, 49, 50, 51, 52, 53, 55, 56, 60, 62, 63,
        64, 65, 68, 69, 70, 71, 72, 73, 74, 76, 82, 87,
    },
    "tangsong": {5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 38, 57, 59, 66, 75, 77, 78, 81},
    "mingqing": {19, 20, 79, 80, 85, 86},
    "xianxia": set(),
}
ERA_LABEL = {
    "qinhan": "秦汉",
    "weijin": "魏晋",
    "tangsong": "唐宋",
    "mingqing": "明清",
    "xianxia": "仙侠",
}


def load_simplifier(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    table = {k: v for k, v in data.items() if isinstance(v, str) and k != v}
    table.update({"夀": "寿"})
    return table


def simplify(name: str, table: dict[str, str]) -> str:
    return "".join(table.get(ch, ch) for ch in name)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cbdb", type=Path, default=Path("primitive-data/cbdb_20261024/cbdb_20261024.sqlite3"))
    parser.add_argument("--opencc", type=Path, default=Path("data/vendor/opencc/ts-inverted.json"))
    parser.add_argument("--out", type=Path, default=Path("reports"))
    parser.add_argument("--top", type=int, default=100)
    args = parser.parse_args()

    simplifier = load_simplifier(args.opencc)
    con = sqlite3.connect(f"file:{args.cbdb}?mode=ro", uri=True)
    rows: dict[str, collections.Counter[str]] = {era: collections.Counter() for era in ERA_CODES}

    for era, codes in ERA_CODES.items():
        if not codes:
            continue
        marks = ",".join("?" for _ in codes)
        for (raw,) in con.execute(
            f"SELECT c_mingzi_chn FROM BIOG_MAIN "
            f"WHERE c_dy IN ({marks}) AND c_mingzi_chn IS NOT NULL",
            tuple(sorted(codes)),
        ):
            name = raw.strip()
            if len(name) != 2 or name[0] == name[1]:
                continue
            name = simplify(name, simplifier)
            if len(name) == 2 and all("\u4e00" <= ch <= "\u9fff" for ch in name):
                rows[era][name] += 1
    con.close()

    args.out.mkdir(parents=True, exist_ok=True)
    tsv = args.out / "era-name-stats-20261101.tsv"
    with tsv.open("w", encoding="utf-8", newline="") as handle:
        handle.write("era\trank\tname\tcount\n")
        for era in ERA_CODES:
            for rank, (name, count) in enumerate(rows[era].most_common(args.top), 1):
                handle.write(f"{era}\t{rank}\t{name}\t{count}\n")

    lines = [
        "# 名箓 · 时代双字名频率统计",
        "",
        "> 数据：CBDB 2026-10-24，`BIOG_MAIN.c_mingzi_chn` + `c_dy`。",
        "> 授权：CC BY-NC-SA 4.0；仅个人非商业分析，不进入 `core` / `seed` 可分发数据。",
        "> 口径：只统计 2 字名，去掉两字相同；繁转简；按 `c_dy` 归并为五档。",
        "",
        "## 样本量",
        "",
        "| 时代 | 双字名条数 | 不同名数 | 可信度 |",
        "|---|---:|---:|---|",
    ]
    confidence = {
        "qinhan": "低；样本不足，不单独建池",
        "weijin": "中低；可做辅助池",
        "tangsong": "高",
        "mingqing": "高",
        "xianxia": "无历史数据；只能虚构",
    }
    for era in ERA_CODES:
        counter = rows[era]
        lines.append(
            f"| {ERA_LABEL[era]} | {sum(counter.values()):,} | {len(counter):,} | {confidence[era]} |"
        )

    lines += ["", "## 各时代高频名（简写，top 15）", ""]
    for era in ["qinhan", "weijin", "tangsong", "mingqing"]:
        top = rows[era].most_common(15)
        lines.append(f"### {ERA_LABEL[era]}")
        lines.append("")
        lines.append("、".join(f"{name}（{count}）" for name, count in top) or "无")
        lines.append("")

    lines += [
        "## 结论",
        "",
        "- 唐宋、明清样本足够，可以建立时代名池。",
        f"- 魏晋只有 {sum(rows['weijin'].values()):,} 条，适合作为辅助池，低样本名应回退全局池。",
        f"- 秦汉只有 {sum(rows['qinhan'].values()):,} 条，不能据此建立双字名池；继续用单字名为主，双字回退全局/唐宋。",
        "- 仙侠没有历史语料，必须继续用虚构词表。",
        "- 头部名在唐宋与明清之间仍有重叠，例如应龙、时中；时代池只能降低重复，不能完全消除。",
        "",
        f"明细：`{tsv.name}`（每时代 top {args.top}）。",
    ]
    report = args.out / "era-name-stats-20261101.md"
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(report)
    print(tsv)


if __name__ == "__main__":
    main()
