"""Build the October 9–18 editorial queue from the ten approved copy sheets."""

import csv
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
MATRIX = REPO / "brand/master-campaign/docs/CAMPAIGN-MATRIX.csv"
OUT = ROOT / "PUBLISHING-QUEUE.csv"

LANES = {
    2: "01-world",
    3: "02-economy",
    4: "04-organizations",
    5: "03-blood-law",
    6: "05-vice-city",
    7: "06-authored",
    8: "08-agents",
    9: "07-omr",
}

NEW_MEDIA = {
    1: ("day-01-city.png", "Rain-soaked rooftops and a harbor at night, with one warmly lit safehouse window overlooking the city."),
    2: ("day-02-paths.png", "Rain-wet city intersection where six roads diverge into the night."),
    3: ("day-03-ledger.png", "Dimly lit back-room desk with a ledger and closed cash box beside a rain-streaked window."),
    4: ("day-04-family.png", "Five empty chairs around a council table overlooking the city at night."),
    5: ("day-05-law.png", "Sealed envelope on a wet doorstep with distant police lights reflected on the street."),
    6: ("day-06-vice.png", "Empty after-hours casino with green felt tables and warm lamps."),
    7: ("day-07-cases.png", "Old evidence room with sealed folders and a single desk lamp."),
    8: ("day-08-agents.png", "Quiet operations desk with a telephone and city map in a dark back room."),
    9: ("day-09-gated.png", "Locked vault door beneath a city, its machinery dark and inactive."),
    10: ("day-10-invitation.png", "A rain-wet city rooftop at first light, with a door open toward the streets."),
}

with MATRIX.open(encoding="utf-8-sig", newline="") as handle:
    matrix = list(csv.DictReader(handle))

existing = {}
if OUT.exists():
    with OUT.open(encoding="utf-8-sig", newline="") as handle:
        existing = {row["id"]: row for row in csv.DictReader(handle)}

assets = {}
for lane in LANES.values():
    cards = [row for row in matrix if row["lane"] == lane]
    assert len(cards) == 12, (lane, len(cards))
    assets[lane] = cards

rows = []
seen = set()
for day in range(1, 11):
    lines = [line.strip() for line in (ROOT / f"day-{day:02d}.txt").read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == 50, (day, len(lines))
    for slot, post in enumerate(lines, start=1):
        assert len(post) <= 280, (day, slot, len(post))
        assert post not in seen, (day, slot)
        seen.add(post)
        local = datetime.combine(date(2026, 10, 8 + day), datetime.min.time()) + timedelta(hours=8, minutes=(slot - 1) * 19)
        asset = alt = ""
        if slot == 1:
            media_name, alt = NEW_MEDIA[day]
            asset = f"brand/ten-day-x-campaign/media/{media_name}"
        elif day in LANES and slot % 4 == 0:
            card = assets[LANES[day]][slot // 4 - 1]
            asset = f"brand/master-campaign/{card['png']}"
            alt = f"OMERTÀ campaign graphic: {card['title']} {card['body']}"
        if asset:
            assert (REPO / asset).is_file(), asset
        post_id = f"D{day:02d}-{slot:02d}"
        previous = existing.get(post_id, {})
        rows.append({
            "id": post_id,
            "date": local.strftime("%Y-%m-%d"),
            "time_et": local.strftime("%I:%M %p"),
            "post": post,
            "asset": asset,
            "alt": alt,
            "state": previous.get("state", "prepared"),
            "verified_at_et": previous.get("verified_at_et", ""),
        })

assert len(rows) == 500
assert len({(r["date"], r["time_et"]) for r in rows}) == 500
with OUT.open("w", encoding="utf-8-sig", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
print(f"Wrote {len(rows)} posts to {OUT}")
