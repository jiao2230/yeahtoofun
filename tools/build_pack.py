#!/usr/bin/env python3
"""Build a 名箓 pack from CBDB + Chinese-Names-Corpus.

This is a personal-use pack: CBDB is CC BY-NC-SA 4.0, so the output pack is
also marked CC-BY-NC-SA-4.0. Do not publish it.

Usage:
  python tools/build_pack.py \
    --cbdb ./cbdb_20261024/cbdb_20261024.sqlite3 \
    --cnc ./Chinese-Names-Corpus-master \
    --out ./data/packs/cbdb
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sqlite3
from pathlib import Path


HAN = re.compile(r"^[\u4e00-\u9fa5]{1,4}$")
HAN_CHAR = re.compile(r"[\u4e00-\u9fa5]")
BAD_NAME_CHARS = set("氏某女娘婦妇姑姐妹嫂婆奴婢")
MIN_FREQ = 20
COLLOQUIAL_EXTRA = ['郎', '娘', '丫', '蛋', '狗', '马']


def is_common(text: str) -> bool:
    try:
        text.encode("gb2312")
        return True
    except UnicodeEncodeError:
        return False

TONE_MARKS = {
    "ā": ("a", 1), "á": ("a", 2), "ǎ": ("a", 3), "à": ("a", 4),
    "ē": ("e", 1), "é": ("e", 2), "ě": ("e", 3), "è": ("e", 4),
    "ī": ("i", 1), "í": ("i", 2), "ǐ": ("i", 3), "ì": ("i", 4),
    "ō": ("o", 1), "ó": ("o", 2), "ǒ": ("o", 3), "ò": ("o", 4),
    "ū": ("u", 1), "ú": ("u", 2), "ǔ": ("u", 3), "ù": ("u", 4),
    "ǖ": ("ü", 1), "ǘ": ("ü", 2), "ǚ": ("ü", 3), "ǜ": ("ü", 4),
}


def load_simplifier() -> dict[str, str]:
    path = Path(__file__).resolve().parent.parent / "data" / "vendor" / "opencc" / "ts-inverted.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def simplify(text: str, table: dict[str, str]) -> str:
    return "".join(table.get(ch, ch) for ch in text)


def load_pinyin() -> dict[str, tuple[str, int]]:
    base = Path(__file__).resolve().parent.parent / "data" / "vendor" / "pinyin"
    out: dict[str, tuple[str, int]] = {}
    for name in ("kMandarin_8105_partial.txt", "kHanyuPinlu.txt"):
        path = base / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            m = re.match(r"U\+([0-9A-Fa-f]{4,5}):\s*([^#]+)", line)
            if not m:
                continue
            try:
                ch = chr(int(m.group(1), 16))
            except ValueError:
                continue
            reading = m.group(2).strip().split(",")[0].strip()
            if not reading or not re.fullmatch(r"[a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+", reading):
                continue
            tone = 0
            for c in reading:
                if c in TONE_MARKS:
                    tone = TONE_MARKS[c][1]
            out.setdefault(ch, (reading, tone))
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cbdb", type=Path, required=True)
    parser.add_argument("--cnc", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--id", default="cbdb")
    parser.add_argument("--version", default="2026.10.24")
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "courtesy.json").unlink(missing_ok=True)
    seed_dir = Path(__file__).resolve().parent.parent / "data" / "seed"
    seed_chars = {
        row["char"]: row
        for row in json.loads((seed_dir / "chars.json").read_text(encoding="utf-8"))
    }
    simplifier = load_simplifier()
    pinyin = load_pinyin()
    style_map, negative = load_lexicons()
    unihan = load_unihan()
    allusions = load_allusions()
    generations = json.loads((seed_dir / "generations.json").read_text(encoding="utf-8"))
    template_chars = set("".join(g["chars"] for g in generations))

    conn = sqlite3.connect(f"file:{args.cbdb}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        surnames = build_surnames(conn, simplifier, negative)
        chars, char_meta = build_chars(
            conn, seed_chars, simplifier, pinyin, template_chars, style_map, negative, unihan
        )
        given = build_given_names(conn, char_meta, simplifier)
        given = with_allusion_names(given, allusions, char_meta)
        collision = build_collision(conn, simplifier)
    finally:
        conn.close()

    copy = lambda name: json.loads((seed_dir / name).read_text(encoding="utf-8"))
    artifacts = copy("artifacts.json")
    sects = copy("sects.json")
    pills = copy("pills.json")
    techniques = copy("techniques.json")
    blacklist = copy("blacklist.json")
    famous = copy("famous.json")

    write(args.out / "surnames.json", surnames)
    write(args.out / "chars.json", chars)
    write(args.out / "given-names.json", given)
    write(args.out / "generations.json", generations)
    write(args.out / "allusions.json", allusions)
    write(args.out / "artifacts.json", artifacts)
    write(args.out / "sects.json", sects)
    write(args.out / "pills.json", pills)
    write(args.out / "techniques.json", techniques)
    write(args.out / "blacklist.json", blacklist)
    write(args.out / "famous.json", famous)
    write(args.out / "collision.json", collision)
    manifest = {
        "id": args.id,
        "version": args.version,
        "license": "CC-BY-NC-SA-4.0",
        "source": "CBDB 2026-10-24 (primary); Chinese-Names-Corpus 2025-11-09 audited, not yet merged; personal use only",
        "builtAt": "2026-10-31",
        "filter": {
            "common": "GB2312 level 1+2",
            "minFreq": MIN_FREQ,
            "toneRequired": True,
        },
        "counts": {
            "surnames": len(surnames),
            "chars": len(chars),
            "givenNames": len(given),
            "generations": len(generations),
            "allusions": len(allusions),
            "collision": len(collision),
        },
    }
    write(args.out / "pack.json", manifest)
    print(json.dumps(manifest["counts"], ensure_ascii=False))
    return 0


def load_lexicons() -> tuple[dict[str, set[str]], set[str]]:
    base = Path(__file__).resolve().parent.parent / "data" / "lexicons"
    styles: dict[str, set[str]] = {}
    style_path = base / "styles.json"
    if style_path.exists():
        for style, chars in json.loads(style_path.read_text(encoding="utf-8")).items():
            for ch in chars:
                if len(ch) == 1:
                    styles.setdefault(ch, set()).add(style)
    negative_path = base / "negative-chars.json"
    negative = set(json.loads(negative_path.read_text(encoding="utf-8"))) if negative_path.exists() else set()
    return styles, negative


def load_unihan() -> dict[str, dict[str, object]]:
    path = Path(__file__).resolve().parent.parent / "data" / "vendor" / "unihan" / "radical-strokes.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def load_allusions() -> dict[str, list[dict[str, str]]]:
    path = Path(__file__).resolve().parent.parent / "data" / "vendor" / "classics" / "allusions.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


STOP_CHARS = set("之兮而其所以不无有为与则乃于乎哉夫何然者也矣可能将欲既亦皆各自相见使令从来上去中外出前后左右大小多少长短高低我尔汝女曰谓云是人十百千万")


def with_allusion_names(
    given: list[dict], allusions: dict[str, list[dict[str, str]]], chars: dict[str, dict]
) -> list[dict]:
    existing = {entry["text"] for entry in given}
    extra: list[dict] = []
    for phrase in sorted(allusions):
        if len(phrase) != 2 or phrase in existing:
            continue
        if any(ch not in chars for ch in phrase):
            continue
        if phrase[0] == phrase[1] or any(ch in STOP_CHARS for ch in phrase):
            continue
        extra.append({"text": phrase, "weight": 3})
    return given + extra[:5000]


def build_surnames(
    conn: sqlite3.Connection, simplifier: dict[str, str], negative: set[str]
) -> list[dict]:
    counts: collections.Counter[str] = collections.Counter()
    roman: dict[str, collections.Counter[str]] = collections.defaultdict(collections.Counter)
    for row in conn.execute(
        "SELECT c_surname_chn, c_surname FROM BIOG_MAIN "
        "WHERE c_surname_chn IS NOT NULL AND TRIM(c_surname_chn)<>''"
    ):
        name = simplify(row[0].strip(), simplifier)
        if not HAN.fullmatch(name):
            continue
        if not is_common(name):
            continue
        if any(ch in negative for ch in name):
            continue
        counts[name] += 1
        if row[1]:
            roman[name][row[1].strip().lower()] += 1
    out = []
    for name, count in counts.most_common(500):
        pinyin = roman[name].most_common(1)[0][0] if roman[name] else ""
        out.append(
            {
                "text": name,
                "pinyin": pinyin,
                "weight": count,
                "compound": len(name) == 2,
            }
        )
    return out


def build_chars(
    conn: sqlite3.Connection,
    seed_chars: dict[str, dict],
    simplifier: dict[str, str],
    pinyin: dict[str, tuple[str, int]],
    template_chars: set[str],
    style_map: dict[str, set[str]],
    negative: set[str],
    unihan: dict[str, dict[str, object]],
) -> tuple[list[dict], dict[str, dict]]:
    freq: collections.Counter[str] = collections.Counter()
    male: collections.Counter[str] = collections.Counter()
    female: collections.Counter[str] = collections.Counter()
    roman: dict[str, collections.Counter[str]] = collections.defaultdict(collections.Counter)

    for row in conn.execute(
        "SELECT c_mingzi_chn, c_mingzi, c_female FROM BIOG_MAIN "
        "WHERE c_mingzi_chn IS NOT NULL"
    ):
        name = simplify(row[0].strip(), simplifier)
        if not HAN.fullmatch(name) or len(name) > 2:
            continue
        if any(ch in BAD_NAME_CHARS for ch in name):
            continue
        for ch in name:
            freq[ch] += 1
            if row[2] == 1:
                female[ch] += 1
            elif row[2] == 0:
                male[ch] += 1
        if len(name) == 1 and row[1]:
            roman[name][row[1].strip().lower()] += 1

    out = []
    meta: dict[str, dict] = {}
    for ch, count in freq.most_common(3000):
        allow_template = ch in template_chars
        if ch in negative:
            continue
        if count < MIN_FREQ and not allow_template:
            continue
        if not is_common(ch) and not allow_template:
            continue
        seed = seed_chars.get(ch, {})
        m, f = male[ch], female[ch]
        ratio = f / (m + f) if (m + f) else 0.5
        gender = "female" if ratio >= 0.6 else "male" if ratio <= 0.4 else "neutral"
        py, tone = pinyin.get(ch, ("", 0))
        if seed.get("pinyin"):
            py, tone = seed["pinyin"], seed.get("tone", 0)
        elif not py and roman[ch]:
            py = roman[ch].most_common(1)[0][0]
        if tone <= 0:
            continue
        meaning = seed.get("meaning", "")
        styles = sorted(set(seed.get("styles", [])) | style_map.get(ch, set()))
        entry = {
            "char": ch,
            "pinyin": py,
            "tone": tone,
            "meaning": meaning,
            "gender": gender,
            "styles": styles,
            "weight": count,
            **(unihan.get(ch) or {}),
        }
        out.append(entry)
        meta[ch] = entry
    for ch in sorted(template_chars):
        if ch in meta:
            continue
        seed = seed_chars.get(ch)
        if not seed or not seed.get("pinyin") or seed.get("tone", 0) <= 0:
            continue
        entry = {
            "char": ch,
            "pinyin": seed["pinyin"],
            "tone": seed["tone"],
            "meaning": seed.get("meaning", ""),
            "gender": seed.get("gender", "neutral"),
            "styles": sorted(set(seed.get("styles", [])) | style_map.get(ch, set())),
            "weight": 0,
            **(unihan.get(ch) or {}),
        }
        out.append(entry)
        meta[ch] = entry
    for ch in COLLOQUIAL_EXTRA:
        if ch in meta:
            continue
        seed = seed_chars.get(ch)
        if not seed or not seed.get("pinyin") or seed.get("tone", 0) <= 0:
            continue
        entry = {
            "char": ch,
            "pinyin": seed["pinyin"],
            "tone": seed["tone"],
            "meaning": seed.get("meaning", ""),
            "gender": seed.get("gender", "neutral"),
            "styles": sorted(set(seed.get("styles", [])) | style_map.get(ch, set())),
            "weight": 0,
            **(unihan.get(ch) or {}),
        }
        out.append(entry)
        meta[ch] = entry
    return out, meta


def build_given_names(
    conn: sqlite3.Connection, chars: dict[str, dict], simplifier: dict[str, str]
) -> list[dict]:
    counts: collections.Counter[str] = collections.Counter()
    for row in conn.execute("SELECT c_mingzi_chn FROM BIOG_MAIN WHERE c_mingzi_chn IS NOT NULL"):
        name = simplify(row[0].strip(), simplifier)
        if len(name) != 2 or not HAN.fullmatch(name):
            continue
        if name[0] == name[1]:
            continue
        if any(ch in BAD_NAME_CHARS for ch in name):
            continue
        if all(ch in chars for ch in name):
            counts[name] += 1
    return [
        {"text": name, "weight": count}
        for name, count in counts.most_common(20_000)
        if count >= 2
    ]


def build_collision(conn: sqlite3.Connection, simplifier: dict[str, str]) -> list[str]:
    names: set[str] = set()
    for row in conn.execute("SELECT c_name_chn FROM BIOG_MAIN WHERE c_name_chn IS NOT NULL"):
        name = simplify(row[0].strip(), simplifier)
        if HAN.fullmatch(name) and not any(ch in BAD_NAME_CHARS for ch in name):
            names.add(name)
    return sorted(names)


def write(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
