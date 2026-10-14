from PIL import Image, ImageDraw
from pathlib import Path
root=Path(__file__).resolve().parents[2]
files=sorted((root/'public/art/cinematic-r4/captures').glob('*.png'))
out=root/'output/cinematic-r4';out.mkdir(parents=True,exist_ok=True)
for p in range(0,len(files),9):
    sheet=Image.new('RGB',(1530,990),'#151515');d=ImageDraw.Draw(sheet)
    for i,f in enumerate(files[p:p+9]):
        im=Image.open(f).convert('RGB');im.thumbnail((500,290))
        x=(i%3)*510;y=(i//3)*330
        sheet.paste(im,(x,y+28));d.text((x+8,y+8),f.stem,fill='white')
    dest=out/f'captures-contact-{p//9+1}.jpg';sheet.save(dest,quality=92);print(dest)
