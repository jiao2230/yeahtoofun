#!/usr/bin/env python3
"""M0 data audit for 名箓.

This script never writes raw names to the report. It emits aggregate counts only.

Usage:
  python tools/audit_sources.py \
    --cbdb /path/to/primitive-data/cbdb_20261024/cbdb_20261024.sqlite3 \
    --cnc /path/to/Chinese-Names-Corpus \
    --poetry /path/to/chinese-poetry \
    --out reports/data-audit.json

If a source path is omitted, that section is marked "not_provided" and the
script still exits 0 so the report can be generated incrementally.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any


def audit_cbdb(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"status": "missing", "path": str(path)}
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        tables = [
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
        ]
        result: dict[str, Any] = {
            "status": "ok",
            "path": str(path),
            "size_bytes": path.stat().st_size,
            "tables": tables,
        }
        if "BIOG_MAIN" not in tables:
            result["error"] = "BIOG_MAIN not found"
            return result

        result["biog_main_rows"] = conn.execute("SELECT COUNT(*) FROM BIOG_MAIN").fetchone()[0]
        result["empty_name_rows"] = conn.execute(
            "SELECT COUNT(*) FROM BIOG_MAIN WHERE c_name_chn IS NULL OR TRIM(c_name_chn)=''"
        ).fetchone()[0]
        result["female_distribution"] = {
            str(row[0]): row[1]
            for row in conn.execute(
                "SELECT c_female, COUNT(*) FROM BIOG_MAIN GROUP BY c_female"
            )
        }
        result["dynasty_top"] = [
            {"c_dy": row[0], "name": row[1], "count": row[2]}
            for row in conn.execute(
                "SELECT b.c_dy, COALESCE(d.c_dynasty_chn, ''), COUNT(*) "
                "FROM BIOG_MAIN b LEFT JOIN DYNASTIES d ON d.c_dy = b.c_dy "
                "GROUP BY b.c_dy ORDER BY 3 DESC LIMIT 20"
            )
        ]
        result["birthyear_range"] = {
            "min": conn.execute("SELECT MIN(c_birthyear) FROM BIOG_MAIN").fetchone()[0],
            "max": conn.execute("SELECT MAX(c_birthyear) FROM BIOG_MAIN").fetchone()[0],
        }
        result["name_length_distribution"] = _length_distribution(
            [row[0] for row in conn.execute("SELECT c_name_chn FROM BIOG_MAIN WHERE c_name_chn IS NOT NULL")]
        )
        result["surname_count"] = conn.execute(
            "SELECT COUNT(DISTINCT c_surname_chn) FROM BIOG_MAIN WHERE c_surname_chn IS NOT NULL AND TRIM(c_surname_chn)<>''"
        ).fetchone()[0]
        result["surname_top"] = [
            {"surname": row[0], "count": row[1]}
            for row in conn.execute(
                "SELECT c_surname_chn, COUNT(*) FROM BIOG_MAIN "
                "WHERE c_surname_chn IS NOT NULL AND TRIM(c_surname_chn)<>'' "
                "GROUP BY c_surname_chn ORDER BY 2 DESC LIMIT 30"
            )
        ]
        result["mingzi_length_distribution"] = _length_distribution(
            [row[0] for row in conn.execute("SELECT c_mingzi_chn FROM BIOG_MAIN WHERE c_mingzi_chn IS NOT NULL")]
        )
        result["valid_mingzi_length_distribution"] = _length_distribution(
            [
                row[0]
                for row in conn.execute(
                    "SELECT c_mingzi_chn FROM BIOG_MAIN WHERE c_mingzi_chn IS NOT NULL"
                )
                if re.fullmatch(r"[\u4e00-\u9fa5]{1,4}", row[0] or "")
            ]
        )

        if "ALTNAME_DATA" in tables:
            result["altname_rows"] = conn.execute("SELECT COUNT(*) FROM ALTNAME_DATA").fetchone()[0]
            result["altname_people"] = conn.execute(
                "SELECT COUNT(DISTINCT c_personid) FROM ALTNAME_DATA"
            ).fetchone()[0]
            if "ALTNAME_CODES" in tables:
                result["altname_codes"] = [
                    {"code": row[0], "desc": row[1], "count": row[2]}
                    for row in conn.execute(
                        "SELECT c.c_name_type_code, "
                        "COALESCE(c.c_name_type_desc_chn, c.c_name_type_desc), COUNT(a.c_personid) "
                        "FROM ALTNAME_CODES c LEFT JOIN ALTNAME_DATA a "
                        "ON a.c_alt_name_type_code = c.c_name_type_code "
                        "GROUP BY c.c_name_type_code ORDER BY 3 DESC"
                    )
                ]
        return result
    finally:
        conn.close()


def audit_cnc(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"status": "missing", "path": str(path)}
    files = sorted(path.rglob("*.txt"))
    name_files = [p for p in files if "Chinese_Names_Corpus" in p.parts]
    other_files = [p for p in files if p not in name_files]
    result: dict[str, Any] = {
        "status": "ok",
        "path": str(path),
        "name_files": [
            {"name": p.relative_to(path).as_posix(), "size_bytes": p.stat().st_size}
            for p in name_files
        ],
        "other_files": [
            {"name": p.relative_to(path).as_posix(), "size_bytes": p.stat().st_size}
            for p in other_files
        ],
    }
    all_lengths: collections.Counter[int] = collections.Counter()
    first_chars: collections.Counter[str] = collections.Counter()
    genders: collections.Counter[str] = collections.Counter()
    total_raw = 0
    total_parsed = 0
    total_valid = 0
    per_file: list[dict[str, Any]] = []
    for p in name_files:
        is_gender = "Gender" in p.name
        raw = headers = parsed = valid = 0
        uniq: set[str] = set()
        for line in p.read_text(encoding="utf-8-sig", errors="ignore").splitlines():
            raw += 1
            text = line.strip().lstrip("\ufeff")
            if not text:
                continue
            if text.startswith("By@") or re.fullmatch(r"\d{4}\.\d{2}\.\d{2}", text) or text == "dict,sex":
                headers += 1
                continue
            if is_gender:
                if "," not in text:
                    headers += 1
                    continue
                name, sex = text.rsplit(",", 1)
                name, sex = name.strip(), sex.strip()
            else:
                name, sex = text, ""
            parsed += 1
            if is_gender:
                genders[sex or "未知"] += 1
            if re.fullmatch(r"[\u4e00-\u9fa5]{1,4}", name):
                valid += 1
                uniq.add(name)
                all_lengths[len(name)] += 1
                first_chars[name[0]] += 1
        total_raw += raw
        total_parsed += parsed
        total_valid += valid
        per_file.append(
            {
                "name": p.relative_to(path).as_posix(),
                "raw_lines": raw,
                "header_lines": headers,
                "parsed_names": parsed,
                "valid_han_names": valid,
                "unique_valid": len(uniq),
                "size_bytes": p.stat().st_size,
            }
        )
    result["raw_lines"] = total_raw
    result["parsed_names"] = total_parsed
    result["valid_han_names"] = total_valid
    result["per_file"] = per_file
    result["name_length_distribution"] = dict(sorted(all_lengths.items()))
    result["first_char_top"] = [
        {"char": char, "count": count} for char, count in first_chars.most_common(30)
    ]
    result["gender_distribution"] = dict(genders)
    return result


def audit_poetry(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"status": "missing", "path": str(path)}
    files = sorted(path.rglob("*.json"))
    total_bytes = sum(p.stat().st_size for p in files)
    result: dict[str, Any] = {
        "status": "ok",
        "path": str(path),
        "json_files": len(files),
        "total_bytes": total_bytes,
        "top_dirs": collections.Counter(
            p.relative_to(path).parts[0] if len(p.relative_to(path).parts) > 1 else "."
            for p in files
        ).most_common(20),
    }
    return result


def _length_distribution(names: list[str]) -> dict[int, int]:
    counter: collections.Counter[int] = collections.Counter(len(name) for name in names if name)
    return dict(sorted(counter.items()))


def main() -> int:
    parser = argparse.ArgumentParser(description="名箓 M0 数据审计")
    parser.add_argument("--cbdb", type=Path, help="CBDB SQLite 文件")
    parser.add_argument("--cnc", type=Path, help="Chinese-Names-Corpus 目录")
    parser.add_argument("--poetry", type=Path, help="chinese-poetry 目录")
    parser.add_argument("--out", type=Path, default=Path("reports/data-audit.json"))
    args = parser.parse_args()

    report: dict[str, Any] = {
        "generated_at": "2026-10-31",
        "note": "聚合统计；不包含完整姓名列表。缺失源标记 missing，不代表 0。",
        "cbdb": audit_cbdb(args.cbdb) if args.cbdb else {"status": "not_provided"},
        "cnc": audit_cnc(args.cnc) if args.cnc else {"status": "not_provided"},
        "poetry": audit_poetry(args.poetry) if args.poetry else {"status": "not_provided"},
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {args.out}")
    for key, value in report.items():
        if isinstance(value, dict):
            print(f"  {key}: {value.get('status', 'ok')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
