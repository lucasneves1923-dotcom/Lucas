"""Montagem (imposição): distribui as peças na largura da bobina gastando o mínimo de material.

- Todas as peças do mesmo tamanho → grade (`calcular`), testando a peça girada e sem girar.
- Tamanhos diferentes → prateleiras (`calcular_prateleiras`): as peças mais altas primeiro,
  cada uma entra na primeira faixa onde ainda cabe.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import pymupdf

from . import corte
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


@dataclass
class Posicao:
    pagina: int
    x_cm: float      # canto superior esquerdo na página
    y_cm: float
    w_cm: float      # tamanho ocupado (já girado, com sangria)
    h_cm: float
    girado: bool
    item: int        # índice do item do pedido


@dataclass
class Montagem:
    posicoes: list[Posicao]
    alturas_paginas_cm: list[float]
    resumo: str
    detalhes: dict


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
        comprimento = linhas * h + (linhas - paginas) * e + 2 * margem * paginas
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


def posicoes_grade(layout: Layout, quantidades: list[int], bobina: dict, espacamento_cm: float) -> Montagem:
    """Transforma o layout em grade em posições, na ordem dos itens."""
    e = espacamento_cm
    w, h = layout.peca_largura_cm, layout.peca_altura_cm
    margem = bobina["margem_inicio_fim_cm"]
    largura_grade = layout.colunas * w + (layout.colunas - 1) * e
    x0 = _x_inicial(largura_grade, bobina)
    por_pagina = layout.colunas * layout.linhas_por_pagina

    sequencia = [i for i, qtd in enumerate(quantidades) for _ in range(qtd)]
    posicoes, alturas = [], []
    for n, item in enumerate(sequencia):
        pagina, resto = divmod(n, por_pagina)
        linha, coluna = divmod(resto, layout.colunas)
        posicoes.append(Posicao(pagina, x0 + coluna * (w + e), margem + linha * (h + e), w, h,
                                layout.girado, item))
    for pagina in range(layout.paginas):
        linhas = math.ceil(min(por_pagina, len(sequencia) - pagina * por_pagina) / layout.colunas)
        alturas.append(2 * margem + linhas * h + (linhas - 1) * e)
    return Montagem(posicoes, alturas, layout.resumo(), layout.como_dict())


def calcular_prateleiras(
    tamanhos: list[tuple[float, float, int]],
    bobina: dict,
    espacamento_cm: float,
    girar_permitido: bool,
) -> Montagem:
    """Monta peças de tamanhos diferentes. `tamanhos` = [(largura, altura, quantidade)] com sangria."""
    util = bobina["largura_cm"] - 2 * bobina["margem_lateral_cm"]
    margem = bobina["margem_inicio_fim_cm"]
    maximo_util = bobina["comprimento_max_cm"] - 2 * margem
    e = espacamento_cm

    pecas = []
    for i, (w, h, qtd) in enumerate(tamanhos):
        opcoes = [(w, h, False)]
        if girar_permitido and w != h:
            opcoes.append((h, w, True))
        # Deitada (lado maior na largura da bobina) quando cabe: faixas mais baixas.
        cabem = [o for o in opcoes if o[0] <= util + 1e-9 and o[1] <= maximo_util + 1e-9]
        if not cabem:
            raise ErroGrafica(
                f"A peça de {w:g} x {h:g} cm (item {i + 1}) não cabe na bobina "
                f"({util:g} cm úteis de largura)"
                + ("" if girar_permitido else " — e girar está desativado para este pedido") + "."
            )
        ow, oh, girado = min(cabem, key=lambda o: o[1])
        pecas += [(ow, oh, girado, i)] * qtd
    pecas.sort(key=lambda p: (-p[1], p[3]))

    # Cada prateleira: [altura, largura_usada, [(x, w, h, girado, item)]]
    prateleiras: list[list] = []
    for w, h, girado, item in pecas:
        for p in prateleiras:
            x = p[1] + (e if p[2] else 0)
            if x + w <= util + 1e-9:
                p[2].append((x, w, h, girado, item))
                p[1] = x + w
                break
        else:
            prateleiras.append([h, w, [(0.0, w, h, girado, item)]])

    posicoes, alturas = [], []
    y = 0.0
    paginas_prat: list[list] = [[]]
    for p in prateleiras:
        if paginas_prat[-1] and y + e + p[0] > maximo_util + 1e-9:
            paginas_prat.append([])
            y = 0.0
        y_prat = y + (e if paginas_prat[-1] else 0)
        paginas_prat[-1].append((y_prat, p))
        y = y_prat + p[0]

    for pagina, lista in enumerate(paginas_prat):
        largura_max = max(p[1] for _, p in lista)
        x0 = _x_inicial(largura_max, bobina)
        for y_prat, p in lista:
            for x, w, h, girado, item in p[2]:
                posicoes.append(Posicao(pagina, x0 + x, margem + y_prat, w, h, girado, item))
        ultimo_y, ultima = lista[-1]
        alturas.append(2 * margem + ultimo_y + ultima[0])

    comprimento = sum(alturas)
    area_pecas = sum(p.w_cm * p.h_cm for p in posicoes)
    aproveitamento = 100 * area_pecas / (bobina["largura_cm"] * comprimento)
    resumo = (
        f"{len(posicoes)} peças de {len(tamanhos)} tamanhos diferentes em {len(prateleiras)} faixas: "
        f"{comprimento:.1f} cm de bobina de {bobina['largura_cm']:g} cm "
        f"({len(alturas)} página(s), aproveitamento {aproveitamento:.0f}%)"
    )
    detalhes = {
        "quantidade": len(posicoes),
        "faixas": len(prateleiras),
        "bobina_cm": bobina["largura_cm"],
        "comprimento_cm": round(comprimento, 2),
        "paginas": len(alturas),
        "aproveitamento": round(aproveitamento, 1),
        "resumo": resumo,
    }
    return Montagem(posicoes, alturas, resumo, detalhes)


def _x_inicial(largura_ocupada: float, bobina: dict) -> float:
    if bobina.get("centralizar", True):
        return (bobina["largura_cm"] - largura_ocupada) / 2
    return bobina["margem_lateral_cm"]


def gerar_pdf(
    pecas: list[pymupdf.Document],
    montagem: Montagem,
    bobina: dict,
    config: dict,
    contorno: dict | None = None,
) -> pymupdf.Document:
    """Desenha as peças nas posições. `contorno` = {sangria_cm, formato, raio_cm} liga a linha de corte."""
    saida = pymupdf.open()
    paginas = [saida.new_page(width=cm(bobina["largura_cm"]), height=cm(a))
               for a in montagem.alturas_paginas_cm]
    contornos: list[list[corte.Contorno]] = [[] for _ in paginas]

    for p in montagem.posicoes:
        ret = pymupdf.Rect(cm(p.x_cm), cm(p.y_cm), cm(p.x_cm + p.w_cm), cm(p.y_cm + p.h_cm))
        paginas[p.pagina].show_pdf_page(ret, pecas[p.item], 0, rotate=90 if p.girado else 0)
        if contorno:
            s = cm(contorno["sangria_cm"])
            contornos[p.pagina].append(corte.Contorno(
                ret.x0 + s, ret.y0 + s, ret.width - 2 * s, ret.height - 2 * s,
                contorno["formato"], cm(contorno.get("raio_cm", 0)),
            ))

    for pagina, lista in zip(paginas, contornos, strict=True):
        corte.desenhar(saida, pagina, lista, config)
    return saida
