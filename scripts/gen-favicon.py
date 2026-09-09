"""Gera os ícones do OrçaAI (favicon.ico, apple-touch-icon e PNGs).
Roda na raiz do projeto:  python3 scripts/gen-favicon.py
Produz: public/favicon.ico, public/apple-touch-icon.png, public/icon-192.png, public/icon-512.png
"""
from PIL import Image, ImageDraw
import os

# ---------- fundo gradiente (índigo) com cantos arredondados ----------
def base_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    # gradiente diagonal #6366f1 -> #4338ca
    top = (99, 102, 241)
    bot = (67, 56, 202)
    for y in range(size):
        t = y / max(1, size - 1)
        r = round(top[0] + (bot[0] - top[0]) * t)
        g = round(top[1] + (bot[1] - top[1]) * t)
        b = round(top[2] + (bot[2] - top[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b, 255)
    # máscara de cantos arredondados (22%)
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)
    return img

def draw_zap(size: int) -> Image.Image:
    """Desenha um símbolo de 'raio' branco centralizado (marca OrçaAI)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size
    # polígono de relâmpago (coordenadas normalizadas 0..1) 
    poly = [
        (0.52, 0.06), (0.20, 0.56), (0.41, 0.56), (0.30, 0.94),
        (0.80, 0.42), (0.58, 0.42), (0.74, 0.06),
    ]
    pts = [(x * s, y * s) for (x, y) in poly]
    d.polygon(pts, fill=(255, 255, 255, 255))
    return img

def rounded_icon(size: int) -> Image.Image:
    base = base_icon(size)
    zap = draw_zap(int(size * 0.72))  # raio ocupa 72% da área
    offset = int(size * 0.14)
    base.alpha_composite(zap, (offset, offset))
    return base

os.makedirs("public", exist_ok=True)

# favicon.ico com múltiplos tamanhos
ico_sizes = [16, 24, 32, 48, 64]
ico_imgs = [rounded_icon(s) for s in ico_sizes]
ico_imgs[0].save("public/favicon.ico", format="ICO", sizes=[(s, s) for s in ico_sizes], append_images=ico_imgs[1:])

# apple-touch-icon (180) e PNGs
rounded_icon(180).save("public/apple-touch-icon.png")
rounded_icon(192).save("public/icon-192.png")
rounded_icon(512).save("public/icon-512.png")

print("Ícones gerados em public/")
