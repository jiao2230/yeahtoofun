#!/usr/bin/env python3
"""Build the permissive `core` pack from Chinese-Names-Corpus + seed.

This pack is Apache-2.0 (CNC is Apache-2.0) and does not contain CBDB data.
It is intentionally modern/readability-oriented; use the `cbdb` pack for
historical distributions under CC BY-NC-SA.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
from pathlib import Path

HAN = re.compile(r"^[\u4e00-\u9fa5]{1,4}$")
MIN_FREQ = 20
TONE_MARKS = {
    "ā": 1, "á": 2, "ǎ": 3, "à": 4,
    "ē": 1, "é": 2, "ě": 3, "è": 4,
    "ī": 1, "í": 2, "ǐ": 3, "ì": 4,
    "ō": 1, "ó": 2, "ǒ": 3, "ò": 4,
    "ū": 1, "ú": 2, "ǔ": 3, "ù": 4,
    "ǖ": 1, "ǘ": 2, "ǚ": 3, "ǜ": 4,
}


def is_common(text: str) -> bool:
    try:
        text.encode("gb2312")
        return True
    except UnicodeEncodeError:
        return False


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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cnc", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--id", default="core")
    parser.add_argument("--version", default="2025.11.09")
    args = parser.parse_args()
    seed_dir = Path(__file__).resolve().parent.parent / "data" / "seed"
    seed_chars = {
        row["char"]: row for row in json.loads((seed_dir / "chars.json").read_text(encoding="utf-8"))
    }
    seed_surnames = json.loads((seed_dir / "surnames.json").read_text(encoding="utf-8"))
    compounds = [s["text"] for s in seed_surnames if s["compound"]]
    generations = json.loads((seed_dir / "generations.json").read_text(encoding="utf-8"))
    template_chars = set("".join(g["chars"] for g in generations))
    style_map, negative = load_lexicons()
    unihan = load_unihan()
    allusions = load_allusions()
    pinyin = load_pinyin()

    modern = args.cnc / "Chinese_Names_Corpus" / "Chinese_Names_Corpus（120W）.txt"
    gender_file = args.cnc / "Chinese_Names_Corpus" / "Chinese_Names_Corpus_Gender（120W）.txt"
    if not modern.exists():
        # Fallback for renamed/English path
        candidates = list((args.cnc / "Chinese_Names_Corpus").glob("*120W*.txt"))
        modern = next((p for p in candidates if "Gender" not in p.name), modern)
    if not modern.exists():
        raise SystemExit(f"missing CNC file: {modern}")

    surname_counts: collections.Counter[str] = collections.Counter()
    char_counts: collections.Counter[str] = collections.Counter()
    male: collections.Counter[str] = collections.Counter()
    female: collections.Counter[str] = collections.Counter()
    given_counts: collections.Counter[str] = collections.Counter()

    for name in read_names(modern):
        if not is_common(name):
            continue
        if any(ch in negative for ch in name):
            continue
        surname, given = split_name(name, compounds)
        if not surname or not given:
            continue
        surname_counts[surname] += 1
        if len(given) == 2:
            if given[0] != given[1]:
                given_counts[given] += 1
        for ch in given:
            char_counts[ch] += 1

    if gender_file.exists():
        for name, sex in read_gender(gender_file):
            surname, given = split_name(name, compounds)
            if not given:
                continue
            for ch in given:
                if sex == "男":
                    male[ch] += 1
                elif sex == "女":
                    female[ch] += 1

    surnames = []
    for name, count in surname_counts.most_common(500):
        seed = next((s for s in seed_surnames if s["text"] == name), None)
        surnames.append(
            {
                "text": name,
                "pinyin": seed["pinyin"] if seed else "",
                "weight": count,
                "compound": len(name) == 2,
            }
        )

    chars = []
    for ch, count in char_counts.most_common(3000):
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
        if tone <= 0:
            continue
        chars.append(
            {
                "char": ch,
                "pinyin": py,
                "tone": tone,
                "meaning": seed.get("meaning", ""),
                "gender": gender,
                "styles": sorted(set(seed.get("styles", [])) | style_map.get(ch, set())),
                "weight": count,
                **(unihan.get(ch) or {}),
            }
        )

    for ch in sorted(template_chars):
        if any(entry["char"] == ch for entry in chars):
            continue
        seed = seed_chars.get(ch)
        if not seed or not seed.get("pinyin") or seed.get("tone", 0) <= 0:
            continue
        chars.append(
            {
                "char": ch,
                "pinyin": seed["pinyin"],
                "tone": seed["tone"],
                "meaning": seed.get("meaning", ""),
                "gender": seed.get("gender", "neutral"),
                "styles": sorted(set(seed.get("styles", [])) | style_map.get(ch, set())),
                "weight": 0,
                **(unihan.get(ch) or {}),
            }
        )

    char_set = {entry["char"] for entry in chars}
    given = [
        {"text": name, "weight": count}
        for name, count in given_counts.most_common(20_000)
        if count >= 2 and all(ch in char_set for ch in name)
    ]
    given = with_allusion_names(given, allusions, {entry["char"]: entry for entry in chars})

    copy = lambda name: json.loads((seed_dir / name).read_text(encoding="utf-8"))
    generations = copy("generations.json")
    artifacts = copy("artifacts.json")
    sects = copy("sects.json")
    pills = copy("pills.json")
    blacklist = copy("blacklist.json")
    famous = copy("famous.json")

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "courtesy.json").unlink(missing_ok=True)
    data = {
        "surnames.json": surnames,
        "chars.json": chars,
        "given-names.json": given,
        "generations.json": generations,
        "allusions.json": allusions,
        "artifacts.json": artifacts,
        "sects.json": sects,
        "pills.json": pills,
        "blacklist.json": blacklist,
        "famous.json": famous,
    }
    for filename, payload in data.items():
        (args.out / filename).write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    manifest = {
        "id": args.id,
        "version": args.version,
        "license": "Apache-2.0",
        "source": "Chinese-Names-Corpus 2025-11-09 + seed; no CBDB",
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
        },
    }
    (args.out / "pack.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(json.dumps(manifest["counts"], ensure_ascii=False))
    return 0


def read_names(path: Path):
    for line in path.read_text(encoding="utf-8-sig", errors="ignore").splitlines():
        name = line.strip().lstrip("\ufeff")
        if not name or name.startswith("By@") or re.fullmatch(r"\d{4}\.\d{2}\.\d{2}", name):
            continue
        if HAN.fullmatch(name):
            yield name


def read_gender(path: Path):
    for line in path.read_text(encoding="utf-8-sig", errors="ignore").splitlines():
        text = line.strip().lstrip("\ufeff")
        if not text or text.startswith("By@") or text == "dict,sex":
            continue
        if "," not in text:
            continue
        name, sex = text.rsplit(",", 1)
        name, sex = name.strip(), sex.strip()
        if HAN.fullmatch(name):
            yield name, sex


def split_name(name: str, compounds: list[str]) -> tuple[str, str]:
    for compound in compounds:
        if name.startswith(compound) and len(name) > len(compound):
            return compound, name[len(compound) :]
    if len(name) < 2:
        return "", ""
    return name[0], name[1:]


def load_pinyin() -> dict[str, tuple[str, int]]:
    base = Path(__file__).resolve().parent.parent / "data" / "vendor" / "pinyin"
    out: dict[str, tuple[str, int]] = {}
    for filename in ("kMandarin_8105_partial.txt", "kHanyuPinlu.txt"):
        path = base / filename
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
            tone = next((v for k, v in TONE_MARKS.items() if k in reading), 0)
            out.setdefault(ch, (reading, tone))
    return out


if __name__ == "__main__":
    raise SystemExit(main())
