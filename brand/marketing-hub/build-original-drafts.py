"""Snapshot earlier Omertà X drafts into the marketing hub."""

from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).with_name("ORIGINAL-X-DRAFTS.md")


def section(path: str, start: str | None = None, end: str | None = None) -> str:
    body = (ROOT / path).read_text(encoding="utf-8")
    if start:
        pos = body.find(start)
        if pos < 0:
            raise ValueError(f"missing start marker in {path}: {start}")
        body = body[pos:]
    if end:
        pos = body.find(end)
        if pos < 0:
            raise ValueError(f"missing end marker in {path}: {end}")
        body = body[:pos]
    return body.strip()


SOURCES = [
    ("Master campaign X copy: 108 matched cards", "brand/master-campaign/docs/X-COPY.md", None, None),
    ("Market campaign: three threads and six standalone posts", "brand/market-v2-campaign/X-THREADS.md", None, None),
    ("General marketing copy: X section", "MARKETING-COPY.md", "### C1 · X / Twitter", "### C2 · Landing page"),
    ("Historical launch X pack", "docs/LAUNCH-TWEETS.md", None, None),
    ("OMR marketing pack: three threads", "docs/OMR-MARKETING-PACK.md", "## Technical X thread", "## Gamer-first version"),
    ("OMR machine: X thread and short variants", "docs/OMR-MACHINE-CAMPAIGN.md", "## X / Farcaster thread version", "## Graphic caption"),
    ("Connected City X launch draft", "brand/connected-city-materials/next/launch/connected-city.md", "## X thread", "## Discord"),
    ("Coordination X launch draft", "brand/connected-city-materials/next/launch/coordination.md", "## X thread", "## Discord"),
    ("Market X launch draft", "brand/connected-city-materials/next/launch/market-v2.md", "## X thread", "## Discord"),
    ("World Graph X launch draft", "brand/connected-city-materials/next/launch/world-graph.md", "## X thread", "## Discord"),
    ("Press-kit launch copy", "brand/connected-city-materials/press-kit/launch-copy.md", None, None),
]

parts = [
    "# Original X drafts — historical snapshot",
    "",
    f"Generated {date.today().isoformat()} from the original marketing sources. This file gathers the drafts in one place for reference. It is not a posting queue. For copy that can be posted with an attachment, use [READY-TO-POST.md](READY-TO-POST.md).",
    "",
    "Historical drafts include outdated invite counts and deadlines, earlier economic models, and release assumptions. Recheck all status and on-image text before reuse. Relative asset paths inside the verbatim snapshots resolve from the linked originals, not from this file. The source documents remain linked in [SOURCE-INDEX.md](SOURCE-INDEX.md).",
    "",
]
for title, path, start, end in SOURCES:
    relative = "../../" + path.replace("\\", "/")
    body = section(path, start, end)
    parts.extend([f"## {title}", "", f"Source: [{path}]({relative})", "", "~~~markdown", body, "~~~", ""])

OUT.write_text("\n".join(parts), encoding="utf-8")
print(f"Wrote {OUT} from {len(SOURCES)} sources")
