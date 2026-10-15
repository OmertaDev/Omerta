"""Inspection sheets only; source artwork stays untouched."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
root = Path(__file__).resolve().parents[2]
out = root / 'output/brainrot-r3'
out.mkdir(parents=True, exist_ok=True)
for film in range(1, 4):
    sheet = Image.new('RGB', (810, 1016), '#0a0a0a')
    draw = ImageDraw.Draw(sheet)
    for n in range(1, 7):
        shot = f'R3-V{film}-G{n:02d}'
        src = root / f'public/art/brainrot-r3/frames/{shot}-poly-first.png'
        image = ImageOps.fit(Image.open(src).convert('RGB'), (270, 480))
        x, y = ((n-1) % 3)*270, ((n-1)//3)*508
        sheet.paste(image, (x, y+28))
        draw.text((x+10, y+8), shot, fill='#d5ff00')
    sheet.save(out / f'V{film}-scene-review.png')
    print(f'V{film} inspection sheet ready')
