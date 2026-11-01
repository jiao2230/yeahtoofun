#!/usr/bin/env python3
"""Build 名箓 data packs in one deterministic sequence.

Default order:
  1. rebuild the combined allusion index
  2. build core from Chinese-Names-Corpus
  3. build cbdb from CBDB + Chinese-Names-Corpus

MQWW is optional and runs after packs, because it adds a local female pool
to the cbdb pack. It needs mqww202512.accdb and PowerShell's ACE provider.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(label: str, command: list[str], dry_run: bool) -> None:
    print(f"[build] {label}")
    print("  " + " ".join(command))
    if dry_run:
        return
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--packs", default="core,cbdb", help="comma separated: core,cbdb")
    parser.add_argument("--cbdb", type=Path, default=ROOT / "cbdb_20261024" / "cbdb_20261024.sqlite3")
    parser.add_argument("--cnc", type=Path, default=ROOT / "Chinese-Names-Corpus-master")
    parser.add_argument("--out", type=Path, default=ROOT / "data" / "packs")
    parser.add_argument("--skip-allusions", action="store_true")
    parser.add_argument("--skip-cnc", action="store_true")
    parser.add_argument("--with-mqww", action="store_true", help="export MQWW female poets and build the local female pool")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    packs = {item.strip() for item in args.packs.split(",") if item.strip()}
    unknown = packs - {"core", "cbdb"}
    if unknown:
        parser.error(f"unknown packs: {', '.join(sorted(unknown))}")

    if not args.skip_allusions:
        run("allusions", [sys.executable, "tools/build_allusions.py"], args.dry_run)

    if not args.skip_cnc:
        gender_file = args.cnc / "Chinese_Names_Corpus" / "Chinese_Names_Corpus_Gender（120W）.txt"
        if not gender_file.exists():
            parser.error(f"CNC gender file not found: {gender_file}")
        run(
            "CNC female writeyi words",
            [
                sys.executable,
                "tools/build_cnc_female_words.py",
                "--gender-file",
                str(gender_file),
            ],
            args.dry_run,
        )

    if "core" in packs:
        if not args.cnc.exists():
            parser.error(f"CNC directory not found: {args.cnc}")
        run(
            "core",
            [
                sys.executable,
                "tools/build_core_pack.py",
                "--cnc",
                str(args.cnc),
                "--out",
                str(args.out / "core"),
                "--id",
                "core",
                "--version",
                "2025.11.09",
            ],
            args.dry_run,
        )

    if "cbdb" in packs:
        if not args.cbdb.exists():
            parser.error(f"CBDB database not found: {args.cbdb}")
        if not args.cnc.exists():
            parser.error(f"CNC directory not found: {args.cnc}")
        run(
            "cbdb",
            [
                sys.executable,
                "tools/build_pack.py",
                "--cbdb",
                str(args.cbdb),
                "--cnc",
                str(args.cnc),
                "--out",
                str(args.out / "cbdb"),
                "--id",
                "cbdb",
                "--version",
                "2026.10.24",
            ],
            args.dry_run,
        )

    if args.with_mqww:
        accdb = ROOT / "mqww202512.accdb"
        if not accdb.exists():
            parser.error(f"MQWW database not found: {accdb}")
        if "cbdb" not in packs:
            parser.error("--with-mqww requires --packs cbdb")
        export = [
            "powershell.exe",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(ROOT / "tools" / "export_mqww_female.ps1"),
            "-Db",
            str(accdb),
            "-Out",
            str(ROOT / "tmp" / "mqww-female-poets.csv"),
        ]
        print("[build] MQWW export")
        print("  " + " ".join(export))
        if not args.dry_run:
            subprocess.run(export, cwd=ROOT, check=True)
        run("MQWW female pool", [sys.executable, "tools/build_mqww_female_names.py"], args.dry_run)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
