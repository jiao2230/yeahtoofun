#!/usr/bin/env python3
"""Import radical/stroke data from Unihan.zip.

Usage:
  python tools/import_unihan.py --zip /path/to/Unihan.zip --out data/vendor/unihan/radical-strokes.json

Writes a compact map:
  {"一": {"radical": "1", "strokes": 1}, ...}

Unihan's `kRSUnicode` is a radical number (with optional apostrophe for
simplified radicals) followed by additional strokes; `kTotalStrokes` is the
total stroke count. OpenCC simplified characters use the same codepoints as
Unihan, so no conversion is needed.
"""

from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    rs: dict[str, str] = {}
    total: dict[str, int] = {}
    with zipfile.ZipFile(args.zip) as archive:
        names = [
            n
            for n in archive.namelist()
            if n.endswith(("Unihan_IRGSources.txt", "Unihan_RadicalStrokeCounts.txt"))
        ]
        if not names:
            raise SystemExit("Unihan radical/stroke files not found in zip")
        for name in names:
            for line in archive.read(name).decode("utf-8-sig", errors="ignore").splitlines():
                if not line or line.startswith("#"):
                    continue
                parts = line.split("\t")
                if len(parts) != 3:
                    continue
                codepoint, prop, value = parts
                match = re.fullmatch(r"U\+([0-9A-Fa-f]{4,6})", codepoint)
                if not match:
                    continue
                try:
                    char = chr(int(match.group(1), 16))
                except ValueError:
                    continue
                if prop == "kRSUnicode":
                    rs[char] = value.strip().split()[0]
                elif prop == "kTotalStrokes":
                    try:
                        total[char] = int(value.strip().split()[0])
                    except ValueError:
                        pass

    out: dict[str, dict[str, object]] = {}
    for char, radical in rs.items():
        entry: dict[str, object] = {"radical": radical}
        if char in total:
            entry["strokes"] = total[char]
        out[char] = entry
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {args.out} ({len(out)} chars, {sum(1 for v in out.values() if 'strokes' in v)} with strokes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
