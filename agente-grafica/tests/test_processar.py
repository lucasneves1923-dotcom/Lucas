import json

import pymupdf
import pytest

from grafica.config import ErroGrafica, cm
from grafica.pedido import carregar_pedido
from grafica.processar import processar


def _pedido(tmp_path, config, **dados):
    caminho = tmp_path / "pedido.json"
    caminho.write_text(json.dumps(dados), encoding="utf-8")
    return carregar_pedido(caminho, config)


def test_adesivo_pdf_montado_na_bobina(tmp_path, config, arte_pdf):
    ped = _pedido(tmp_path, config, id="t1", tipo="adesivo", largura_cm=5, altura_cm=5,
                  itens=[{"arquivo": arte_pdf.name, "quantidade": 100}])
    r = processar(ped, config)
    doc = pymupdf.open(r["arquivo_final"])
    assert doc.page_count == 1
    assert doc[0].rect.width == pytest.approx(cm(127))
    assert doc[0].rect.height == pytest.approx(cm(32.2))
    assert r["montagem"]["colunas"] == 21
    # Texto continua vetorial (não virou imagem): 100 cópias do texto no PDF final
    assert doc[0].get_text().count("TESTE") == 100


def test_sangria_espelhada_copia_a_cor_da_borda(tmp_path, config, arte_png):
    ped = _pedido(tmp_path, config, id="t2", tipo="banner", largura_cm=5, altura_cm=5,
                  sangria_cm=1, itens=[{"arquivo": arte_png.name, "quantidade": 2}])
    r = processar(ped, config)
    doc = pymupdf.open(r["arquivo_final"])
    pagina = doc[0]
    assert pagina.rect.width == pytest.approx(cm(7))
    pix = pagina.get_pixmap(dpi=50)
    esquerda = pix.pixel(2, pix.height // 2)       # sangria esquerda: espelho da metade azul
    direita = pix.pixel(pix.width - 3, pix.height // 2)  # sangria direita: espelho da verde
    # a sangria é gerada em CMYK, então o azul/verde RGB puros perdem um pouco de saturação
    assert esquerda[2] > esquerda[1] + 60 and esquerda[2] > esquerda[0] + 60  # azul
    assert direita[1] > direita[2] + 60 and direita[1] > direita[0] + 60  # verde
    assert "Imprimir cópias" in r["resumo"]


def test_varios_modelos_na_mesma_bobina(tmp_path, config, arte_pdf, arte_png):
    ped = _pedido(tmp_path, config, id="t3", tipo="adesivo", largura_cm=5, altura_cm=5,
                  itens=[{"arquivo": arte_pdf.name, "quantidade": 30},
                         {"arquivo": arte_png.name, "quantidade": 20}])
    r = processar(ped, config)
    assert r["quantidade"] == 50
    assert pymupdf.open(r["arquivo_final"])[0].get_text().count("TESTE") == 30


def test_proporcao_errada_da_erro_explicando(tmp_path, config, arte_pdf):
    ped = _pedido(tmp_path, config, id="t4", tipo="adesivo", largura_cm=10, altura_cm=5,
                  itens=[{"arquivo": arte_pdf.name, "quantidade": 10}])
    with pytest.raises(ErroGrafica, match="proporção"):
        processar(ped, config)


def test_imagem_com_resolucao_baixa_e_recusada(tmp_path, config, arte_png):
    # PNG de 5 cm a 300 dpi esticado para 50 cm = 30 dpi
    ped = _pedido(tmp_path, config, id="t5", tipo="adesivo", largura_cm=50, altura_cm=50,
                  itens=[{"arquivo": arte_png.name, "quantidade": 1}])
    with pytest.raises(ErroGrafica, match="resolução baixa"):
        processar(ped, config)


def test_arte_que_ja_tem_sangria(tmp_path, config, arte_pdf):
    # arte de 5x5 = 4.6x4.6 final + 0.2 de sangria de cada lado
    ped = _pedido(tmp_path, config, id="t6", tipo="adesivo", largura_cm=4.6, altura_cm=4.6,
                  modo_sangria="arte_ja_tem", itens=[{"arquivo": arte_pdf.name, "quantidade": 10}])
    r = processar(ped, config)
    assert r["tamanho_com_sangria_cm"] == [5.0, 5.0]


@pytest.mark.parametrize("campo,valor,erro", [
    ("tipo", "camiseta", "tipo"),
    ("largura_cm", 0, "largura_cm"),
    ("itens", [], "itens"),
    ("modo_sangria", "borrar", "modo_sangria"),
])
def test_ficha_invalida(tmp_path, config, arte_pdf, campo, valor, erro):
    dados = dict(id="x", tipo="adesivo", largura_cm=5, altura_cm=5,
                 itens=[{"arquivo": arte_pdf.name, "quantidade": 1}])
    dados[campo] = valor
    with pytest.raises(ErroGrafica, match=erro):
        _pedido(tmp_path, config, **dados)
