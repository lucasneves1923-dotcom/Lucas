"""Linha de corte para plotter: contorno em cor especial (spot) que o RIP entende como "cortar aqui".

O nome da cor (padrão "CutContour") é o que RIPs como VersaWorks, FlexiPrint e Onyx
procuram. A linha não é impressa: o RIP a envia só para a lâmina da plotter.
"""

from __future__ import annotations

from dataclasses import dataclass

import pymupdf

from .config import ErroGrafica

FORMATOS = ("retangulo", "arredondado", "redondo")
K = 0.5523  # constante da curva de Bézier que aproxima um quarto de círculo


@dataclass
class Contorno:
    x: float  # retângulo de corte em pontos, origem no topo (como o PyMuPDF)
    y: float
    w: float
    h: float
    formato: str
    raio: float = 0.0


def _num(v: float) -> str:
    return f"{v:.3f}".rstrip("0").rstrip(".")


def _caminho(c: Contorno, altura_pagina: float) -> str:
    """Operadores PDF do contorno. PDF usa origem embaixo, então o y é invertido."""
    x0, x1 = c.x, c.x + c.w
    y0, y1 = altura_pagina - c.y - c.h, altura_pagina - c.y
    if c.formato == "retangulo" or (c.formato == "arredondado" and c.raio <= 0):
        return f"{_num(x0)} {_num(y0)} {_num(c.w)} {_num(c.h)} re S"

    if c.formato == "redondo":
        rx, ry = c.w / 2, c.h / 2
    else:
        rx = ry = min(c.raio, c.w / 2, c.h / 2)
    kx, ky = rx * K, ry * K
    n = _num
    partes = [
        f"{n(x0 + rx)} {n(y0)} m",
        f"{n(x1 - rx)} {n(y0)} l",
        f"{n(x1 - rx + kx)} {n(y0)} {n(x1)} {n(y0 + ry - ky)} {n(x1)} {n(y0 + ry)} c",
        f"{n(x1)} {n(y1 - ry)} l",
        f"{n(x1)} {n(y1 - ry + ky)} {n(x1 - rx + kx)} {n(y1)} {n(x1 - rx)} {n(y1)} c",
        f"{n(x0 + rx)} {n(y1)} l",
        f"{n(x0 + rx - kx)} {n(y1)} {n(x0)} {n(y1 - ry + ky)} {n(x0)} {n(y1 - ry)} c",
        f"{n(x0)} {n(y0 + ry)} l",
        f"{n(x0)} {n(y0 + ry - ky)} {n(x0 + rx - kx)} {n(y0)} {n(x0 + rx)} {n(y0)} c",
        "h S",
    ]
    return " ".join(partes)


def desenhar(doc: pymupdf.Document, pagina: pymupdf.Page, contornos: list[Contorno], config: dict) -> None:
    """Acrescenta os contornos à página, na cor spot configurada."""
    if not contornos:
        return
    cfg = config["corte"]
    nome = cfg["nome_cor"]
    if not nome or any(ch in nome for ch in " /()<>[]{}%#"):
        raise ErroGrafica(f"config.yaml: corte.nome_cor inválido: {nome!r} (sem espaços nem símbolos)")
    c, m, y, k = cfg["cor_visualizacao_cmyk"]
    espaco = (
        f"[/Separation /{nome} /DeviceCMYK <</FunctionType 2 /Domain [0 1] "
        f"/C0 [0 0 0 0] /C1 [{c} {m} {y} {k}] /N 1>>]"
    )

    tipo, valor = doc.xref_get_key(pagina.xref, "Resources")
    if tipo == "xref":
        doc.xref_set_key(int(valor.split()[0]), "ColorSpace/CS_Corte", espaco)
    else:
        doc.xref_set_key(pagina.xref, "Resources/ColorSpace/CS_Corte", espaco)

    ops = [f"q /CS_Corte CS 1 SCN {_num(cfg['espessura_pt'])} w"]
    ops += [_caminho(ct, pagina.rect.height) for ct in contornos]
    ops.append("Q")

    pagina.wrap_contents()
    xref = doc.get_new_xref()
    doc.update_object(xref, "<<>>")
    doc.update_stream(xref, "\n".join(ops).encode())
    conteudos = pagina.get_contents() + [xref]
    doc.xref_set_key(pagina.xref, "Contents", "[" + " ".join(f"{x} 0 R" for x in conteudos) + "]")
