"""Pipeline completo de um pedido: normalizar arte → sangria → montagem → PDF final + relatório."""

from __future__ import annotations

import json
import re

import pymupdf

from . import entrada, montagem, sangria
from .config import pasta
from .pedido import Pedido


def _nome_seguro(texto: str) -> str:
    return re.sub(r"[^\w\-]+", "_", texto, flags=re.UNICODE).strip("_")[:60] or "pedido"


def processar(pedido: Pedido, config: dict) -> dict:
    avisos: list[str] = []
    bobina = config["bobina"]

    pecas = []
    for item in pedido.itens:
        peca = entrada.normalizar(item, pedido, config, avisos)
        peca = sangria.aplicar(peca, pedido.sangria_cm, pedido.modo_sangria, config)
        pecas.append((peca, item.quantidade))

    tem_sangria = pedido.modo_sangria != "nenhuma" and pedido.sangria_cm > 0
    s = pedido.sangria_cm if tem_sangria else 0
    largura_peca = pedido.largura_cm + 2 * s
    altura_peca = pedido.altura_cm + 2 * s

    nome = _nome_seguro(f"{pedido.cliente}_{pedido.id}" if pedido.cliente else pedido.id)
    destino = pasta(config, "saida") / f"{nome}_{pedido.tipo}_{pedido.largura_cm:g}x{pedido.altura_cm:g}cm.pdf"

    relatorio = {
        "pedido": pedido.id,
        "cliente": pedido.cliente,
        "tipo": pedido.tipo,
        "tamanho_final_cm": [pedido.largura_cm, pedido.altura_cm],
        "sangria_cm": s,
        "modo_sangria": pedido.modo_sangria,
        "tamanho_com_sangria_cm": [round(largura_peca, 4), round(altura_peca, 4)],
        "quantidade": pedido.quantidade_total,
        "arquivo_final": str(destino),
        "avisos": avisos,
    }

    if pedido.montar:
        layout = montagem.calcular(
            largura_peca, altura_peca, pedido.quantidade_total,
            bobina, pedido.espacamento_cm, pedido.girar_permitido,
        )
        final = montagem.gerar_pdf(pecas, layout, bobina, pedido.espacamento_cm)
        relatorio["montagem"] = layout.como_dict()
        relatorio["resumo"] = layout.resumo()
    else:
        # Sem montagem (ex.: banner): uma página por arte; o operador imprime N cópias.
        final = pymupdf.open()
        for peca, _ in pecas:
            final.insert_pdf(peca)
        copias = ", ".join(f"{i.arquivo.name}: {i.quantidade}" for i in pedido.itens)
        relatorio["resumo"] = (
            f"{len(pecas)} arte(s) de {largura_peca:g} x {altura_peca:g} cm (com sangria). "
            f"Imprimir cópias — {copias}"
        )

    final.set_metadata({"title": f"Pedido {pedido.id}", "creator": "agente-grafica"})
    final.save(destino, garbage=3, deflate=True)
    relatorio_path = destino.with_suffix(".relatorio.json")
    relatorio_path.write_text(json.dumps(relatorio, ensure_ascii=False, indent=2), encoding="utf-8")
    relatorio["relatorio"] = str(relatorio_path)
    return relatorio
