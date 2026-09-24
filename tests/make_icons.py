# Genera los íconos de Rinde (negro con "R" en serif itálica blanca).
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'icons')
FONT = '/System/Library/Fonts/Supplemental/Didot.ttc'

def find_italic():
    for i in range(6):
        try:
            f = ImageFont.truetype(FONT, 100, index=i)
        except OSError:
            break
        if 'italic' in ' '.join(f.getname()).lower():
            return i
    return 0

IDX = find_italic()

def icon(size, scale=0.62, pad_safe=False):
    S = size * 4
    img = Image.new('RGB', (S, S), (0, 0, 0))
    d = ImageDraw.Draw(img)
    fs = int(S * (0.5 if pad_safe else scale))
    f = ImageFont.truetype(FONT, fs, index=IDX)
    l, t, r, b = d.textbbox((0, 0), 'R', font=f)
    x = (S - (r - l)) / 2 - l
    gap = S * 0.045; th0 = max(2, int(S * 0.008))
    y = (S - (b - t) - gap - th0) / 2 - t
    d.text((x, y), 'R', font=f, fill=(244, 244, 242))
    # Línea fina bajo la letra: detalle editorial
    lw = int(S * 0.22); ly = int(y + b + S * 0.045); th = max(2, int(S * 0.008))
    d.rectangle([(S - lw) / 2, ly, (S + lw) / 2, ly + th], fill=(244, 244, 242))
    return img.resize((size, size), Image.LANCZOS)

icon(180).save(os.path.join(OUT, 'apple-touch-icon.png'))
icon(192).save(os.path.join(OUT, 'icon-192.png'))
icon(512).save(os.path.join(OUT, 'icon-512.png'))
icon(512, pad_safe=True).save(os.path.join(OUT, 'icon-maskable-512.png'))
print('ok, italic index', IDX)
