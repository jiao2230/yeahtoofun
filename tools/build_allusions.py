#!/usr/bin/env python3
"""Build a combined 楚辞 / 诗经 / 论语 / 周易 / 庄子 / 唐诗 / 宋词 phrase index.

Output entries:
  {"峻茂": [{"corpus": "chuci", "source": "楚辞·离骚·离骚", "line": "..."}]}
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

STOP_CHARS = set("之兮而其所以不无有为与则乃于乎哉夫何然者也矣可能将欲既亦皆各自相见使令从来上去中外出前后左右大小多少长短高低")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", type=Path, default=Path("data/vendor/classics"))
    parser.add_argument("--out", type=Path, default=Path("data/vendor/classics/allusions.json"))
    args = parser.parse_args()

    index: dict[str, list[dict[str, str]]] = {}

    def add(phrase: str, corpus: str, source: str, line: str, allow_stop: bool = False) -> None:
        if len(phrase) != 2:
            return
        if not allow_stop and any(ch in STOP_CHARS for ch in phrase):
            return
        hits = index.setdefault(phrase, [])
        if len(hits) >= 5:
            return
        if any(hit["source"] == source and hit["line"] == line for hit in hits):
            return
        hits.append({"corpus": corpus, "source": source, "line": line})

    def add_line(corpus: str, source: str, line: str) -> None:
        clean = "".join(ch for ch in line if "\u4e00" <= ch <= "\u9fa5")
        for i in range(len(clean) - 1):
            add(clean[i : i + 2], corpus, source, line)

    def add_words(corpus: str, source: str, lines: list[str], words: list[str]) -> None:
        for word in words:
            line = next((item for item in lines if word in item), "")
            if line:
                add(word, corpus, source, line, allow_stop=True)

    chuci = json.loads((args.dir / "chuci.json").read_text(encoding="utf-8"))
    for poem in chuci:
        source = "楚辞·" + str(poem.get("section") or "") + "·" + str(poem.get("title") or "")
        for line in poem.get("content") or []:
            add_line("chuci", source, line)

    shijing = json.loads((args.dir / "shijing.json").read_text(encoding="utf-8"))
    for poem in shijing:
        source = "诗经·" + str(poem.get("section") or "") + "·" + str(poem.get("title") or "")
        for line in poem.get("content") or []:
            add_line("shijing", source, line)

    lunyu = json.loads((args.dir / "lunyu.json").read_text(encoding="utf-8"))
    for chapter in lunyu:
        source = "论语·" + str(chapter.get("chapter") or "")
        for paragraph in chapter.get("paragraphs") or []:
            for sentence in re.split(r"[。！？；]", paragraph):
                if sentence.strip():
                    add_line("lunyu", source, sentence.strip())

    zhouyi = json.loads((args.dir / "zhouyi.json").read_text(encoding="utf-8"))
    for chapter in zhouyi:
        source = "周易·" + str(chapter.get("section") or "") + "·" + str(chapter.get("title") or "")
        for line in chapter.get("content") or []:
            add_line("zhouyi", source, line)

    zhuangzi = json.loads((args.dir / "zhuangzi.json").read_text(encoding="utf-8"))
    for chapter in zhuangzi:
        source = "庄子·" + str(chapter.get("section") or "") + "·" + str(chapter.get("title") or "")
        for line in chapter.get("content") or []:
            add_line("zhuangzi", source, line)

    tangshi = json.loads((args.dir / "tangshi.json").read_text(encoding="utf-8"))
    for poem in tangshi:
        source = "唐诗·" + str(poem.get("title") or "")
        lines = poem.get("content") or []
        words = poem.get("words") or []
        if words:
            add_words("tangshi", source, lines, words)
        else:
            for line in lines:
                add_line("tangshi", source, line)

    songci = json.loads((args.dir / "songci.json").read_text(encoding="utf-8"))
    for poem in songci:
        source = "宋词·" + str(poem.get("title") or "")
        lines = poem.get("content") or []
        words = poem.get("words") or []
        if words:
            add_words("songci", source, lines, words)
        else:
            for line in lines:
                add_line("songci", source, line)

    female = json.loads((args.dir / "female-allusions.json").read_text(encoding="utf-8"))
    for item in female:
        add(
            str(item.get("name") or ""),
            str(item.get("corpus") or ""),
            str(item.get("source") or ""),
            str(item.get("line") or ""),
            allow_stop=True,
        )

    index = {phrase: hits for phrase, hits in sorted(index.items()) if hits}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    by_corpus = {}
    for hits in index.values():
        for hit in hits:
            by_corpus[hit["corpus"]] = by_corpus.get(hit["corpus"], 0) + 1
    print(f"wrote {args.out} ({len(index)} phrases; {by_corpus})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
