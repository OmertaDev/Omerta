import json, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
media = root / 'public/art/brainrot-r3'
out = root / 'output/brainrot-r3/qa-motion'
out.mkdir(parents=True, exist_ok=True)
ffmpeg = root / 'brand/hype-flywheel-video/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe'
jobs = json.loads((media / 'generation-ledger.json').read_text())['jobs']
clips = [j for k, j in sorted(jobs.items()) if '-poly-take' in k and j['status'] == 'downloaded']
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 17)
for page in range(0, len(clips), 4):
    canvas = Image.new('RGB', (1200, 1134), '#eeeeee')
    draw = ImageDraw.Draw(canvas)
    for i, job in enumerate(clips[page:page+4]):
        for t, seconds in enumerate([1.0, 4.0]):
            frame = out / f"{job['id']}-{seconds}.jpg"
            if not frame.exists():
                subprocess.run([str(ffmpeg), '-v', 'error', '-ss', str(seconds), '-i', str(root / 'public' / job['src']), '-frames:v', '1', '-update', '1', '-y', str(frame)], check=True, creationflags=subprocess.CREATE_NO_WINDOW)
            im = Image.open(frame).convert('RGB').resize((300, 533))
            x, y = i * 300, t * 567
            canvas.paste(im, (x,y+34))
            draw.text((x+4,y+7), f"{job['id'].replace('R3-', '').replace('-poly-', '-')} / {seconds}s", fill='black', font=font)
    file = out / f'contact-{page//4+1}.jpg'
    canvas.save(file, quality=90)
print(json.dumps({'downloadedMotion':len(clips),'sheets':(len(clips)+3)//4,'output':str(out)}))
