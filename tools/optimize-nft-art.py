"""Prepare newly commissioned art before publication. Requires Pillow; never calls fal.

Original generation files are retained under ignored output/nft-art/originals.
The manifest keeps both source and delivery hashes. Run once before minting, not
on already published/frozen assets. Existing delivery renditions are left alone.
"""
from pathlib import Path
import hashlib
import json
import re
from PIL import Image

root = Path(__file__).resolve().parent.parent
art = root / "public/art/nft"
manifest_path = art / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
originals = root / "output/nft-art/originals"
originals.mkdir(parents=True, exist_ok=True)
saved = 0
for name, job in manifest["jobs"].items():
    if job.get("status") != "downloaded" or job.get("rendition"):
        continue
    if not re.fullmatch(r"(?:portrait|deed)-[a-z0-9]+", name):
        raise ValueError("Unexpected artwork filename")
    dest = art / (name + ".jpg")
    source = dest.read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    if digest != job["sha256"]:
        raise ValueError(f"{name}: source changed; refusing to overwrite it")
    backup = originals / dest.name
    if backup.exists() and backup.read_bytes() != source:
        raise ValueError(f"{name}: a different original already exists")
    backup.write_bytes(source)
    with Image.open(dest) as opened:
        image = opened.convert("RGB")
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        temp = art / (name + ".delivery.jpg")
        image.save(temp, "JPEG", quality=85, optimize=True, progressive=True)
    delivery = temp.read_bytes()
    temp.replace(dest)
    job.update(sourceSha256=digest, sourceBytes=len(source),
               sha256=hashlib.sha256(delivery).hexdigest(), bytes=len(delivery),
               rendition={"width": image.width, "height": image.height,
                          "format": "jpeg", "quality": 85, "encoder": "Pillow"})
    record = manifest_path.with_suffix(".json.tmp")
    record.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    record.replace(manifest_path)
    saved += len(source) - len(delivery)
    print(f"{name}: {len(source)//1024} KB -> {len(delivery)//1024} KB")
print(f"Saved {saved/1024/1024:.2f} MiB across delivery plates.")
