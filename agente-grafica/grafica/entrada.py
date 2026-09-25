"""Transforma qualquer arte (PDF, CDR ou imagem) em uma página PDF no tamanho exato da peça."""

from __future__ import annotations


import pymupdf

from . import corel
from .config import ErroGrafica, cm
from .pedido import Item, Pedido

EXTENSOES_IMAGEM = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}


def _abrir_fonte(item: Item, pedido: Pedido, config: dict, avisos: list[str]) -> pymupdf.Document:
    ext = item.arquivo.suffix.lower()
    if ext == ".pdf":
        return pymupdf.open(item.arquivo)
    if ext == ".cdr":
        destino = pedido.pasta / "_convertidos" / (item.arquivo.stem + ".pdf")
        info = corel.cdr_para_pdf(item.arquivo, destino, config)
        avisos.append(
            f"{item.arquivo.name}: convertido pelo CorelDRAW "
            f"({info['textos_convertidos_em_curvas']} texto(s) convertidos em curvas)"
        )
        return pymupdf.open(destino)
    if ext in EXTENSOES_IMAGEM:
        doc = pymupdf.open()
        with pymupdf.open(item.arquivo) as img:
            largura_px, altura_px = img[0].rect.width, img[0].rect.height
        pagina = doc.new_page(width=largura_px, height=altura_px)
        pagina.insert_image(pagina.rect, filename=str(item.arquivo))
        return doc
    raise ErroGrafica(f"Formato não suportado: {item.arquivo.name}")


def _pixels(item: Item) -> tuple[int, int] | None:
    if item.arquivo.suffix.lower() not in EXTENSOES_IMAGEM:
        return None
    pix = pymupdf.Pixmap(str(item.arquivo))
    return pix.width, pix.height


def normalizar(item: Item, pedido: Pedido, config: dict, avisos: list[str]) -> pymupdf.Document:
    """Devolve um PDF de 1 página com a arte no tamanho final (ou final + sangria, se a arte já tem)."""
    sangria = pedido.sangria_cm if pedido.modo_sangria == "arte_ja_tem" else 0
    largura_cm = pedido.largura_cm + 2 * sangria
    altura_cm = pedido.altura_cm + 2 * sangria

    fonte = _abrir_fonte(item, pedido, config, avisos)
    if item.pagina > fonte.page_count:
        raise ErroGrafica(
            f"{item.arquivo.name}: pedi a página {item.pagina}, mas o arquivo tem {fonte.page_count}"
        )
    pagina = fonte[item.pagina - 1]
    ret = pagina.rect

    proporcao_arte = ret.width / ret.height
    proporcao_pedida = largura_cm / altura_cm
    tolerancia = config["qualidade"]["tolerancia_proporcao"]
    if abs(proporcao_arte / proporcao_pedida - 1) > tolerancia:
        arte_cm = f"{ret.width / cm(1):.2f} x {ret.height / cm(1):.2f} cm"
        dica = ""
        if abs(proporcao_arte * proporcao_pedida - 1) <= tolerancia:
            dica = " A arte parece estar girada 90° em relação ao pedido."
        if pedido.modo_sangria == "arte_ja_tem":
            dica += (
                f" Como o modo é 'arte_ja_tem', esperei a arte com a sangria incluída "
                f"({largura_cm:.2f} x {altura_cm:.2f} cm)."
            )
        raise ErroGrafica(
            f"{item.arquivo.name}: a proporção da arte ({arte_cm}) não bate com o tamanho "
            f"pedido ({largura_cm:.2f} x {altura_cm:.2f} cm).{dica}"
        )

    px = _pixels(item)
    if px:
        dpi = px[0] / (largura_cm / 2.54)
        if dpi < pedido.dpi_minimo:
            raise ErroGrafica(
                f"{item.arquivo.name}: resolução baixa — {dpi:.0f} dpi no tamanho final "
                f"(mínimo para {pedido.tipo}: {pedido.dpi_minimo:.0f} dpi)."
            )
        avisos.append(f"{item.arquivo.name}: imagem com {dpi:.0f} dpi no tamanho final")

    saida = pymupdf.open()
    nova = saida.new_page(width=cm(largura_cm), height=cm(altura_cm))
    nova.show_pdf_page(nova.rect, fonte, item.pagina - 1, keep_proportion=False)
    return saida
