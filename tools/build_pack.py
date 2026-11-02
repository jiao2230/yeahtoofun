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


HAN = re.compile(r"^[\u4e00-\u9fa5]{1,8}$")
HAN_CHAR = re.compile(r"[\u4e00-\u9fa5]")
BAD_NAME_CHARS = set("氏某女娘婦妇姑姐妹嫂婆奴婢")
MIN_FREQ = 20
COLLOQUIAL_EXTRA = ['郎', '娘', '丫', '蛋', '狗', '马', '良', '生', '虎', '保', '龙', '旺', '存', '桃', '杏', '菊', '春', '满', '枝', '桂', '莲', '爱', '悟']
STYLE_EXTRA = ['风', '蓉', '惜', '寒', '羞', '画', '依', '倩', '凌', '千', '君', '妆', '姿', '年', '心', '怀', '昌', '曼', '栖', '滟', '漪', '漱', '澹', '环', '琼', '碧', '秋', '筠', '簟', '红', '翠', '芳', '莺', '萤', '蕙', '语', '韶', '飞', '龄', '龟', '尘', '妍', '晚', '娇', '霜', '劭', '穆', '阿', '奴', '淳', '徽', '桢', '攸', '昭', '朗', '端', '霄', '瀚', '华']
ERA_CODES = {
    "qinhan": {1, 2, 25, 29, 46, 61, 83},
    "weijin": {
        3, 4, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 37, 39, 40,
        41, 42, 44, 45, 47, 48, 49, 50, 51, 52, 53, 55, 56, 60, 62, 63,
        64, 65, 68, 69, 70, 71, 72, 73, 74, 76, 82, 87,
    },
    "tangsong": {5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 38, 57, 59, 66, 75, 77, 78, 81},
    "mingqing": {19, 20, 79, 80, 85, 86},
}


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
        given_by_era = build_given_names_by_era(conn, char_meta, simplifier)
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
    if given_by_era:
        write(args.out / "given-names-by-era.json", given_by_era)
    extra_path = seed_dir / "given-names-extra.json"
    if extra_path.exists():
        write(args.out / "given-names-extra.json", json.loads(extra_path.read_text(encoding="utf-8")))
    cnc_path = seed_dir / "given-names-cnc.json"
    if cnc_path.exists():
        write(args.out / "given-names-cnc.json", json.loads(cnc_path.read_text(encoding="utf-8")))
    blocked_path = seed_dir / "blocked-chars.json"
    if blocked_path.exists():
        write(args.out / "blocked-chars.json", json.loads(blocked_path.read_text(encoding="utf-8")))
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
            "givenNamesByEra": {era: len(items) for era, items in given_by_era.items()},
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


STOP_CHARS = set("之兮而其所以不无有为与则乃于乎哉夫何然者也矣可能将欲既亦皆各自相见使令从来上去中外出前后左右大小多少短高低我尔汝女曰谓是人十百万")


def with_allusion_names(
    given: list[dict], allusions: dict[str, list[dict[str, str]]], chars: dict[str, dict]
) -> list[dict]:
    existing = {entry["text"] for entry in given}
    extra: list[dict] = []
    def allusion_priority(phrase: str) -> tuple[int, str]:
        hits = allusions.get(phrase, [])
        is_new = any(hit.get("corpus") in ("zhouyi", "zhuangzi", "tangshi", "songci") for hit in hits)
        return (0 if is_new else 1, phrase)

    for phrase in sorted(allusions, key=allusion_priority):
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
    reverse = {code: era for era, codes in ERA_CODES.items() for code in codes}
    era_counts: dict[str, collections.Counter[str]] = collections.defaultdict(collections.Counter)
    for row in conn.execute(
        "SELECT c_surname_chn, c_surname, c_dy FROM BIOG_MAIN "
        "WHERE c_surname_chn IS NOT NULL AND TRIM(c_surname_chn)<>''"
    ):
        name = simplify(row[0].strip(), simplifier)
        if not HAN.fullmatch(name):
            continue
        if not is_common(name):
            continue
        if any(ch in negative for ch in name):
            continue
        if any(ch in BAD_NAME_CHARS for ch in name):
            continue
        counts[name] += 1
        if row[1]:
            roman[name][row[1].strip().lower()] += 1
        era = reverse.get(int(row[2])) if row[2] is not None else None
        if era:
            era_counts[name][era] += 1
    out = []
    for name, count in counts.most_common(500):
        pinyin = roman[name].most_common(1)[0][0] if roman[name] else ""
        eras = [
            era for era in ("qinhan", "weijin", "tangsong", "mingqing")
            if era_counts[name][era] >= 2 and era_counts[name][era] / count >= 0.02
        ]
        out.append(
            {
                "text": name,
                "pinyin": pinyin,
                "weight": count,
                "compound": len(name) > 1,
                "eras": eras,
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
        gender = seed.get("gender") or ("female" if ratio >= 0.6 else "male" if ratio <= 0.4 else "neutral")
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
    for ch in COLLOQUIAL_EXTRA + STYLE_EXTRA:
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


def build_given_names_by_era(
    conn: sqlite3.Connection, chars: dict[str, dict], simplifier: dict[str, str]
) -> dict[str, list[dict]]:
    """Aggregate CBDB 2-char given names into the five project eras.

    Qin-Han is deliberately omitted: the 2-char sample is too small.
    Each name must use chars available in this pack. Keep top 5000.
    """
    reverse = {code: era for era, codes in ERA_CODES.items() for code in codes}
    counts: dict[str, collections.Counter[str]] = {
        era: collections.Counter() for era in ERA_CODES
    }
    for row in conn.execute(
        "SELECT c_mingzi_chn, c_dy FROM BIOG_MAIN "
        "WHERE c_mingzi_chn IS NOT NULL AND c_dy IS NOT NULL"
    ):
        era = reverse.get(int(row[1]))
        if not era or era == "qinhan":
            continue
        name = simplify((row[0] or "").strip(), simplifier)
        if len(name) != 2 or not HAN.fullmatch(name) or name[0] == name[1]:
            continue
        if any(ch in BAD_NAME_CHARS for ch in name):
            continue
        if all(ch in chars for ch in name):
            counts[era][name] += 1

    out: dict[str, list[dict]] = {}
    for era, counter in counts.items():
        if era == "qinhan" or not counter:
            continue
        entries = [
            {"text": name, "weight": count}
            for name, count in counter.most_common(5000)
            if count >= 2
        ]
        if entries:
            out[era] = entries
    return out


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
