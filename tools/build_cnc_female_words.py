#!/usr/bin/env python3
"""Extract a modern female given-name supplement for the 写意 style.

The result is intentionally a small, filtered pool, not the full 1.2M corpus.
Rules:
  - female rows only
  - strip surname (seed surname list, longest compound first)
  - exactly 2-character given names
  - both characters carry the 写意 tag in seed/chars.json
  - no reduplicated names (婷婷, 姗姗, ...)
  - top N by frequency

CNC is Apache-2.0; this derived aggregate is local build data.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--gender-file",
        type=Path,
        default=ROOT / "Chinese-Names-Corpus-master" / "Chinese_Names_Corpus" / "Chinese_Names_Corpus_Gender（120W）.txt",
    )
    parser.add_argument("--out", type=Path, default=ROOT / "data" / "seed" / "given-names-cnc.json")
    parser.add_argument("--report", type=Path, default=ROOT / "reports" / "cnc-female-writeyi-20261101.md")
    parser.add_argument("--top", type=int, default=120)
    parser.add_argument("--min-count", type=int, default=5)
    args = parser.parse_args()

    chars = {
        row["char"]: row
        for row in json.loads((ROOT / "data" / "seed" / "chars.json").read_text(encoding="utf-8"))
    }
    writeyi = {ch for ch, row in chars.items() if "写意" in row.get("styles", [])}
    surnames = {
        row["text"]
        for row in json.loads((ROOT / "data" / "seed" / "surnames.json").read_text(encoding="utf-8"))
    }
    compounds = sorted((s for s in surnames if len(s) == 2), key=len, reverse=True)
    blocked = set("氏某女娘妇女姑姐妹嫂婆奴婢")

    counts: collections.Counter[str] = collections.Counter()
    female_rows = 0
    for line in args.gender_file.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("By@") or text == "dict,sex":
            continue
        try:
            name, sex = text.rsplit(",", 1)
        except ValueError:
            continue
        if sex.strip() != "女":
            continue
        female_rows += 1
        name = re.sub(r"[^\u4e00-\u9fa5]", "", name.strip())
        if len(name) < 3:
            continue
        surname = next((s for s in compounds if name.startswith(s)), name[0])
        given = name[len(surname):]
        if len(given) != 2 or given[0] == given[1]:
            continue
        if any(ch not in writeyi or ch in blocked for ch in given):
            continue
        counts[given] += 1

    selected = [(name, count) for name, count in counts.most_common(args.top) if count >= args.min_count]
    payload = {
        "source": "Chinese-Names-Corpus Gender 120W; female-only, 2-char given names, 写意 chars",
        "writeyiFemale": [
            {"text": name, "weight": count, "gender": "female"} for name, count in selected
        ],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# CNC 女性 · 写意双字词补充",
        "",
        "> 来源：`Chinese_Names_Corpus_Gender（120W）.txt`，仅女性。",
        "> 授权：Chinese-Names-Corpus，Apache-2.0。",
        "> 清洗：去姓、只取 2 字名、二字均在 seed 的“写意”字表、排除叠字。",
        "",
        f"- 女性记录：{female_rows:,}",
        f"- 可用不同双字词：{len(counts):,}",
        f"- 入选（频次 ≥ {args.min_count}，top {args.top}）：{len(selected)}",
        "",
        "## 入选词",
        "",
        "、".join(f"{name}（{count}）" for name, count in selected),
        "",
        "## 注意",
        "",
        "- 这是现代人名用字统计，不是历史名；只作为“写意”补充，不进入史实默认池。",
        "- 叠字（婷婷、姗姗）不进池，避免风格坍缩。",
        "- 现代词仍可能偏时代化，后续可继续人工删减。",
    ]
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{args.out} ({len(selected)} names)")
    print(args.report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
