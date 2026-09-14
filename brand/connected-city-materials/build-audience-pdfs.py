from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from pypdf import PdfReader

root=Path(__file__).resolve().parent/'next'/'audience'
styles={
 'body':ParagraphStyle('body',fontName='Helvetica',fontSize=11,leading=16,textColor=HexColor('#303c36')),
 'small':ParagraphStyle('small',fontName='Helvetica',fontSize=9,leading=13,textColor=HexColor('#41584a')),
 'lead':ParagraphStyle('lead',fontName='Helvetica',fontSize=14,leading=20,textColor=HexColor('#303c36')),
 'title':ParagraphStyle('title',fontName='Helvetica-Bold',fontSize=32,leading=35,textColor=HexColor('#101616')),
}
def para(c,text,x,y,width,style):
 p=Paragraph(escape(text),styles[style]);_,h=p.wrap(width,800);p.drawOn(c,x,y-h);return y-h
for item in json.loads((root/'content.json').read_text(encoding='utf8')):
 filename=root/(item['id']+'.pdf');c=canvas.Canvas(str(filename),pagesize=(595.28,841.89));c.setTitle('Omertà — '+item['title']);c.setAuthor('Omertà')
 c.setFillColor(HexColor('#eee8db'));c.rect(0,0,595.28,841.89,fill=1,stroke=0)
 c.setFillColor(HexColor('#101616'));c.rect(0,741,595.28,101,fill=1,stroke=0)
 c.setFillColor(HexColor('#c7af79'));c.setFont('Helvetica-Bold',18);c.drawString(45,791,'OMERTÀ')
 c.setFont('Helvetica',9);c.drawString(45,768,item['audience'])
 y=para(c,item['title'],45,705,505,'title')-20
 y=para(c,item['lead'],45,y,505,'lead')-25
 for title,body in item['points']:
  c.setStrokeColor(HexColor('#b7b7a9'));c.line(45,y,550,y);y-=23
  c.setFillColor(HexColor('#101616'));c.setFont('Helvetica-Bold',13);c.drawString(45,y,title);y-=12
  y=para(c,body,45,y,505,'body')-20
 y=para(c,item['status'],45,y,505,'small')-22
 y=para(c,item['cta']+' → omerta.fun',45,y,505,'body')
 assert y>80,(item['id'],y)
 c.linkURL('https://www.omerta.fun',(45,y-4,550,y+18),relative=0)
 c.setFont('Helvetica',8);c.setFillColor(HexColor('#41584a'));c.drawString(45,45,'14 September 2026 / Feature showcase / See the accompanying HTML for local demo links')
 c.showPage();c.save();assert len(PdfReader(str(filename)).pages)==1
 print(item['id']+': one-page PDF verified')
