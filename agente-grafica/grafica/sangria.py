"""Sangria: aumenta a peça em volta, preenchendo a borda nova com a própria arte.

O miolo continua vetorial (idêntico ao original). Só a faixa de sangria, que vai ser
cortada fora, é desenhada como imagem, espelhando ou esticando a borda da arte.
"""

from __future__ import annotations

import math

import pymupdf
from PIL import Image

from .config import cm

LARGURA_BORDA_ESTICAR = 0.05  # cm da borda da arte que são esticados no modo "esticar"
SOBREPOSICAO = 1.0  # pontos que a sangria entra por baixo da arte (evita filete branco na emenda)


def _faixa(pagina, origem: pymupdf.Rect, dpi: int, cmyk: bool, espelhar_h: bool, espelhar_v: bool,
           lados: str) -> pymupdf.Pixmap:
    """Recorta a borda da arte, espelha e estende `lados` (e/d/c/b) repetindo a última linha."""
    espaco = pymupdf.csCMYK if cmyk else pymupdf.csRGB
    pix = pagina.get_pixmap(dpi=dpi, clip=origem, colorspace=espaco, alpha=False)
    modo = "CMYK" if cmyk else "RGB"
    img = Image.frombytes(modo, (pix.width, pix.height), pix.samples)
    if espelhar_h:
        img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if espelhar_v:
        img = img.transpose(Image.Transpose.FLIP_TOP_BOTTOM)

    extra = max(1, round(SOBREPOSICAO / 72 * dpi))
    w, h = img.size
    e, d = extra * ("e" in lados), extra * ("d" in lados)
    c, b = extra * ("c" in lados), extra * ("b" in lados)
    maior = Image.new(modo, (w + e + d, h + c + b))
    maior.paste(img.resize((w + e + d, h + c + b)), (0, 0))  # base: tudo coberto
    maior.paste(img, (e, c))
    return pymupdf.Pixmap(espaco, maior.width, maior.height, maior.tobytes(), False)


def aplicar(peca: pymupdf.Document, sangria_cm: float, modo: str, config: dict) -> pymupdf.Document:
    """Devolve um novo PDF de 1 página: arte + sangria em volta."""
    if modo in ("nenhuma", "arte_ja_tem") or sangria_cm <= 0:
        return peca

    fonte = peca[0]
    L, A = fonte.rect.width, fonte.rect.height
    s = cm(sangria_cm)
    dpi = config["qualidade"]["dpi_sangria"]
    cmyk = config["qualidade"].get("cor_sangria", "cmyk") == "cmyk"

    # No modo espelhar, a faixa copiada tem a largura da sangria (limitada ao tamanho da arte).
    # No modo esticar, copia só uma linha fininha da borda e estica.
    if modo == "espelhar":
        bx, by = min(s, L), min(s, A)
    else:
        bx = by = min(cm(LARGURA_BORDA_ESTICAR), L, A)
    espelha = modo == "espelhar"
    # Limites direito/inferior alinhados ao pixel: a última coluna/linha parcial sairia clareada
    # pela mistura com o branco de fora da página e viraria um filete na linha de corte.
    z = dpi / 72
    Lp, Ap = math.floor(L * z) / z, math.floor(A * z) / z

    saida = pymupdf.open()
    pagina = saida.new_page(width=L + 2 * s, height=A + 2 * s)

    # (origem na arte, destino na sangria, espelhar_h, espelhar_v, lados que avançam sob a arte)
    regioes = [
        (pymupdf.Rect(0, 0, Lp, by), pymupdf.Rect(s, 0, s + L, s), False, espelha, "b"),  # topo
        (pymupdf.Rect(0, Ap - by, Lp, Ap), pymupdf.Rect(s, s + A, s + L, A + 2 * s), False, espelha, "c"),  # base
        (pymupdf.Rect(0, 0, bx, Ap), pymupdf.Rect(0, s, s, s + A), espelha, False, "d"),  # esquerda
        (pymupdf.Rect(Lp - bx, 0, Lp, Ap), pymupdf.Rect(s + L, s, L + 2 * s, s + A), espelha, False, "e"),  # direita
        (pymupdf.Rect(0, 0, bx, by), pymupdf.Rect(0, 0, s, s), espelha, espelha, "db"),  # cantos
        (pymupdf.Rect(Lp - bx, 0, Lp, by), pymupdf.Rect(s + L, 0, L + 2 * s, s), espelha, espelha, "eb"),
        (pymupdf.Rect(0, Ap - by, bx, Ap), pymupdf.Rect(0, s + A, s, A + 2 * s), espelha, espelha, "dc"),
        (pymupdf.Rect(Lp - bx, Ap - by, Lp, Ap), pymupdf.Rect(s + L, s + A, L + 2 * s, A + 2 * s), espelha, espelha, "ec"),
    ]
    o = SOBREPOSICAO
    for origem, destino, eh, ev, lados in regioes:
        pix = _faixa(fonte, origem, dpi, cmyk, eh, ev, lados)
        destino = pymupdf.Rect(
            destino.x0 - o * ("e" in lados), destino.y0 - o * ("c" in lados),
            destino.x1 + o * ("d" in lados), destino.y1 + o * ("b" in lados),
        )
        pagina.insert_image(destino, pixmap=pix, keep_proportion=False)

    # Arte original (vetorial) por cima, no centro.
    pagina.show_pdf_page(pymupdf.Rect(s, s, s + L, s + A), peca, 0)
    return saida
