from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED
import json

root = Path.cwd()
out = root / 'output/flagship-animation'
entries = set()
def add(relative):
    p = root / relative
    if not p.is_file():
        raise FileNotFoundError(relative)
    entries.add(p)
for p in (root/'brand/flagship-animation').rglob('*'):
    if p.is_file(): entries.add(p)
for p in (root/'brand/hype-flywheel-video/src/flagship-animation').rglob('*'):
    if p.is_file(): entries.add(p)
for name in ['package.json','package-lock.json','tsconfig.json']:
    add('brand/hype-flywheel-video/'+name)
for name in ['render-flagship-animation.mjs','render-flagship-animation-film.mjs','splice-flagship-animation-window.mjs']:
    add('brand/hype-flywheel-video/scripts/'+name)
for p in (root/'public/art/flagship-animation').glob('*'):
    if p.is_file(): entries.add(p)
for name in ['animated-mix.wav','audio-added-layer.wav']:
    add('public/art/flagship-animation/audio/'+name)
for name in ['rebuild-mix.wav','captions.json','utterance-timing.json']:
    add('public/art/flagship-rebuild/audio/'+name)
for name in ['story-source.mjs','audio-lib.mjs','audio-report.json','audio-narration-report.json']:
    add('brand/flagship-rebuild/'+name)
for name in ['claim-ledger.json','claims-economy.json','claims-gameplay.json','coverage-map.md','source-manifest.json','creative-direction.md','media-rights.md','media-inventory.json','actual-spend.json','production-brief.txt']:
    add('brand/flagship-trust/'+name)
for name in ['OMERTA-Trust-Is-The-Game-Animated-1080.mp4','OMERTA-Trust-Is-The-Game-Animated-Clean-1080.mp4','OMERTA-Trust-Is-The-Game-Animated-1080-report.json','OMERTA-Trust-Is-The-Game-Animated-Clean-1080-report.json','A57-splice-evidence.json','OMERTA-Animated-Noir.srt','OMERTA-Animated-Noir.vtt','self-critique.md','qa-report.json','thumbnail.png']:
    add('output/flagship-animation/'+name)
target=out/'OMERTA-Animated-Production.zip'
with ZipFile(target,'w',compression=ZIP_DEFLATED,compresslevel=3) as z:
    for p in sorted(entries):
        z.write(p,p.relative_to(root).as_posix(),compress_type=ZIP_STORED if p.suffix.lower() in ['.png','.jpg','.mp4','.mp3'] else ZIP_DEFLATED)
with ZipFile(target) as z:
    bad=z.testzip()
    if bad: raise RuntimeError('Invalid archive entry: '+bad)
print(json.dumps({'file':str(target),'bytes':target.stat().st_size,'entries':len(entries),'archiveVerified':True}))
