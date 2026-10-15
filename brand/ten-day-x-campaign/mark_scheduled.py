"""Mark rows after the X interface confirms each scheduled time."""

import csv
import sys
from datetime import datetime
from pathlib import Path

queue = Path(__file__).with_name("PUBLISHING-QUEUE.csv")
ids = set(sys.argv[1:])
if not ids:
    raise SystemExit("Pass at least one queue id")
with queue.open(encoding="utf-8-sig", newline="") as handle:
    reader = csv.DictReader(handle)
    fields = reader.fieldnames
    rows = list(reader)
found = set()
for row in rows:
    if row["id"] in ids:
        found.add(row["id"])
        row["state"] = "scheduled"
        row["verified_at_et"] = datetime.now().astimezone().strftime("%Y-%m-%d %I:%M %p ET")
if found != ids:
    raise SystemExit(f"Unknown ids: {sorted(ids - found)}")
with queue.open("w", encoding="utf-8-sig", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
print(f"Marked {len(ids)} rows scheduled")
