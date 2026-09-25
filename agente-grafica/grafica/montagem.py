"""Montagem (imposição): distribui as peças na largura da bobina gastando o mínimo de material."""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import pymupdf

from .config import ErroGrafica, cm


@dataclass
class Layout:
    colunas: int
    linhas: int
    girado: bool               # peça girada 90° na bobina
    peca_largura_cm: float     # tamanho ocupado na bobina (já com sangria e giro)
    peca_altura_cm: float
    quantidade: int
    bobina_cm: float
    comprimento_cm: float      # comprimento total de bobina gasto (todas as páginas)
    paginas: int
    linhas_por_pagina: int
    aproveitamento: float      # % da área impressa ocupada por peças

    def resumo(self) -> str:
        giro = " (peças giradas 90°)" if self.girado else ""
        return (
            f"{self.quantidade} peças de {self.peca_largura_cm:g} x {self.peca_altura_cm:g} cm{giro}: "
            f"{self.colunas} por linha x {self.linhas} linhas, "
            f"{self.comprimento_cm:.1f} cm de bobina de {self.bobina_cm:g} cm "
            f"({self.paginas} página(s), aproveitamento {self.aproveitamento:.0f}%)"
        )

    def como_dict(self) -> dict:
        return {**asdict(self), "resumo": self.resumo()}


def calcular(
    largura_cm: float,
    altura_cm: float,
    quantidade: int,
    bobina: dict,
    espacamento_cm: float,
    girar_permitido: bool,
) -> Layout:
    """Escolhe a orientação que gasta menos bobina. Medidas da peça já incluem a sangria."""
    util = bobina["largura_cm"] - 2 * bobina["margem_lateral_cm"]
    margem = bobina["margem_inicio_fim_cm"]
    maximo = bobina["comprimento_max_cm"]
    e = espacamento_cm

    opcoes = [(largura_cm, altura_cm, False)]
    if girar_permitido and largura_cm != altura_cm:
        opcoes.append((altura_cm, largura_cm, True))

    melhor = None
    for w, h, girado in opcoes:
        colunas = min(math.floor((util + e) / (w + e) + 1e-9), quantidade)
        if colunas < 1:
            continue
        linhas = math.ceil(quantidade / colunas)
        linhas_por_pagina = math.floor((maximo - 2 * margem + e) / (h + e) + 1e-9)
        if linhas_por_pagina < 1:
            continue
        linhas_por_pagina = min(linhas_por_pagina, linhas)
        paginas = math.ceil(linhas / linhas_por_pagina)
        comprimento = linhas * h + (linhas - 1) * e + 2 * margem * paginas
        area_pecas = quantidade * w * h
        area_usada = bobina["largura_cm"] * comprimento
        layout = Layout(
            colunas=colunas,
            linhas=linhas,
            girado=girado,
            peca_largura_cm=round(w, 4),
            peca_altura_cm=round(h, 4),
            quantidade=quantidade,
            bobina_cm=bobina["largura_cm"],
            comprimento_cm=round(comprimento, 2),
            paginas=paginas,
            linhas_por_pagina=linhas_por_pagina,
            aproveitamento=round(100 * area_pecas / area_usada, 1),
        )
        if melhor is None or layout.comprimento_cm < melhor.comprimento_cm - 1e-6:
            melhor = layout

    if melhor is None:
        raise ErroGrafica(
            f"A peça de {largura_cm:g} x {altura_cm:g} cm não cabe na bobina "
            f"({util:g} cm úteis de largura, até {maximo:g} cm de comprimento por página)"
            + ("" if girar_permitido else " — e girar está desativado para este pedido")
            + "."
        )
    return melhor


def gerar_pdf(
    pecas: list[tuple[pymupdf.Document, int]],
    layout: Layout,
    bobina: dict,
    espacamento_cm: float,
) -> pymupdf.Document:
    """Desenha as peças na bobina. `pecas` = [(pdf de 1 página, quantidade), ...] na ordem."""
    w, h, e = cm(layout.peca_largura_cm), cm(layout.peca_altura_cm), cm(espacamento_cm)
    largura_pagina = cm(bobina["largura_cm"])
    margem = cm(bobina["margem_inicio_fim_cm"])
    largura_grade = layout.colunas * w + (layout.colunas - 1) * e
    if bobina.get("centralizar", True):
        x0 = (largura_pagina - largura_grade) / 2
    else:
        x0 = cm(bobina["margem_lateral_cm"])
    giro = 90 if layout.girado else 0

    sequencia = [doc for doc, qtd in pecas for _ in range(qtd)]
    por_pagina = layout.colunas * layout.linhas_por_pagina

    saida = pymupdf.open()
    for inicio in range(0, len(sequencia), por_pagina):
        bloco = sequencia[inicio : inicio + por_pagina]
        linhas = math.ceil(len(bloco) / layout.colunas)
        altura_pagina = 2 * margem + linhas * h + (linhas - 1) * e
        pagina = saida.new_page(width=largura_pagina, height=altura_pagina)
        for n, doc in enumerate(bloco):
            linha, coluna = divmod(n, layout.colunas)
            x = x0 + coluna * (w + e)
            y = margem + linha * (h + e)
            pagina.show_pdf_page(pymupdf.Rect(x, y, x + w, y + h), doc, 0, rotate=giro)
    return saida
