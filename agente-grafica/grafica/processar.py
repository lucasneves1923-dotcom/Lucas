"""Pipeline completo de um pedido: normalizar arte → sangria → montagem → PDF final + relatório."""

from __future__ import annotations

import json
import re

import pymupdf

from . import corte, entrada, montagem, sangria
from .config import cm, pasta
from .pedido import Pedido


def _nome_seguro(texto: str) -> str:
    return re.sub(r"[^\w\-]+", "_", texto, flags=re.UNICODE).strip("_")[:60] or "pedido"


def _cm(v: float) -> float:
    return round(v, 4)


def processar(pedido: Pedido, config: dict) -> dict:
    avisos: list[str] = []
    bobina = config["bobina"]

    pecas = []
    for item in pedido.itens:
        peca = entrada.normalizar(item, pedido, config, avisos)
        pecas.append(sangria.aplicar(peca, pedido.sangria_cm, pedido.modo_sangria, config))

    tem_sangria = pedido.modo_sangria != "nenhuma" and pedido.sangria_cm > 0
    s = pedido.sangria_cm if tem_sangria else 0
    tamanhos = [(i.largura_cm + 2 * s, i.altura_cm + 2 * s, i.quantidade) for i in pedido.itens]

    primeiro = pedido.itens[0]
    medida = (f"{primeiro.largura_cm:g}x{primeiro.altura_cm:g}cm" if pedido.tamanho_unico
              else "tamanhos-variados")
    nome = _nome_seguro(f"{pedido.cliente}_{pedido.id}" if pedido.cliente else pedido.id)
    destino = pasta(config, "saida") / f"{nome}_{pedido.tipo}_{medida}.pdf"

    contorno = None
    if pedido.linha_corte:
        contorno = {"sangria_cm": s, "formato": pedido.formato, "raio_cm": pedido.raio_canto_cm}

    relatorio = {
        "pedido": pedido.id,
        "cliente": pedido.cliente,
        "tipo": pedido.tipo,
        "itens": [
            {"arquivo": i.arquivo.name, "quantidade": i.quantidade,
             "tamanho_final_cm": [i.largura_cm, i.altura_cm],
             "tamanho_com_sangria_cm": [_cm(w), _cm(h)]}
            for i, (w, h, _) in zip(pedido.itens, tamanhos, strict=True)
        ],
        "sangria_cm": s,
        "modo_sangria": pedido.modo_sangria,
        "linha_corte": (f"{pedido.formato} ({config['corte']['nome_cor']})"
                        if pedido.linha_corte else "não"),
        "quantidade": pedido.quantidade_total,
        "arquivo_final": str(destino),
        "avisos": avisos,
    }

    if pedido.montar:
        if pedido.tamanho_unico:
            w, h, _ = tamanhos[0]
            layout = montagem.calcular(w, h, pedido.quantidade_total, bobina,
                                       pedido.espacamento_cm, pedido.girar_permitido)
            arranjo = montagem.posicoes_grade(layout, [i.quantidade for i in pedido.itens],
                                              bobina, pedido.espacamento_cm)
        else:
            arranjo = montagem.calcular_prateleiras(tamanhos, bobina, pedido.espacamento_cm,
                                                    pedido.girar_permitido)
        final = montagem.gerar_pdf(pecas, arranjo, bobina, config, contorno)
        relatorio["montagem"] = arranjo.detalhes
        relatorio["resumo"] = arranjo.resumo
    else:
        # Sem montagem (ex.: banner): uma página por arte; o operador imprime N cópias.
        final = pymupdf.open()
        for peca in pecas:
            final.insert_pdf(peca)
        if contorno:
            for pagina in final:
                r, sp = pagina.rect, cm(s)
                corte.desenhar(final, pagina, [corte.Contorno(
                    sp, sp, r.width - 2 * sp, r.height - 2 * sp,
                    pedido.formato, cm(pedido.raio_canto_cm))], config)
        copias = ", ".join(
            f"{i.arquivo.name} ({_cm(w):g} x {_cm(h):g} cm com sangria): {i.quantidade}"
            for i, (w, h, _) in zip(pedido.itens, tamanhos, strict=True)
        )
        relatorio["resumo"] = f"{len(pecas)} arte(s), uma por página. Imprimir cópias — {copias}"

    final.set_metadata({"title": f"Pedido {pedido.id}", "creator": "agente-grafica"})
    final.save(destino, garbage=3, deflate=True)
    relatorio_path = destino.with_suffix(".relatorio.json")
    relatorio_path.write_text(json.dumps(relatorio, ensure_ascii=False, indent=2), encoding="utf-8")
    relatorio["relatorio"] = str(relatorio_path)
    return relatorio
