import pytest

from grafica.config import ErroGrafica
from grafica.montagem import calcular

BOBINA = {"largura_cm": 127, "margem_lateral_cm": 1, "margem_inicio_fim_cm": 2,
          "comprimento_max_cm": 500, "centralizar": True}


def test_adesivo_5x5_100_unidades():
    l = calcular(5.4, 5.4, 100, BOBINA, 0.3, True)
    # 21 * 5.4 + 20 * 0.3 = 119.4 cm <= 125 úteis; 22 já não cabe
    assert l.colunas == 21
    assert l.linhas == 5
    assert l.comprimento_cm == pytest.approx(5 * 5.4 + 4 * 0.3 + 4)
    assert l.paginas == 1


def test_gira_quando_gasta_menos_bobina():
    l = calcular(10, 3, 1000, BOBINA, 0, True)
    assert l.girado
    assert l.colunas == 41  # 3 cm de largura: 41 * 3 = 123 cm
    assert l.linhas == 25


def test_nao_gira_se_proibido():
    l = calcular(10, 3, 1000, BOBINA, 0, False)
    assert not l.girado
    assert l.colunas == 12


def test_poucas_pecas_nao_passam_da_quantidade():
    l = calcular(5, 5, 3, BOBINA, 0.3, True)
    assert l.colunas == 3 and l.linhas == 1


def test_divide_em_paginas_quando_passa_do_comprimento_maximo():
    l = calcular(10, 10, 1000, BOBINA, 0, True)  # 12 por linha, 84 linhas = 840 cm
    assert l.linhas_por_pagina == 49
    assert l.paginas == 2


def test_peca_maior_que_bobina_da_erro():
    with pytest.raises(ErroGrafica, match="não cabe"):
        calcular(130, 130, 1, BOBINA, 0, True)


def test_peca_larga_cabe_girada():
    l = calcular(200, 100, 1, BOBINA, 0, True)
    assert l.girado and l.colunas == 1


def test_prateleiras_encaixa_pequenas_ao_lado_das_grandes():
    from grafica.montagem import calcular_prateleiras
    m = calcular_prateleiras([(60, 40, 2), (4, 4, 10)], BOBINA, 0, True)
    # as duas de 60 ocupam 120 dos 125 cm; cabe 1 pequena ao lado, as outras 9 vão pra faixa de baixo
    assert m.detalhes["faixas"] == 2
    assert len(m.posicoes) == 12
    assert m.alturas_paginas_cm == [pytest.approx(2 + 40 + 4 + 2)]


def test_prateleiras_deita_peca_comprida():
    from grafica.montagem import calcular_prateleiras
    m = calcular_prateleiras([(3, 100, 1)], BOBINA, 0, True)
    assert m.posicoes[0].girado and m.posicoes[0].h_cm == 3


def test_prateleiras_peca_que_nao_cabe():
    from grafica.montagem import calcular_prateleiras
    with pytest.raises(ErroGrafica, match="item 2"):
        calcular_prateleiras([(5, 5, 1), (130, 130, 1)], BOBINA, 0, True)


def test_prateleiras_quebra_pagina():
    from grafica.montagem import calcular_prateleiras
    m = calcular_prateleiras([(125, 100, 6), (5, 5, 1)], BOBINA, 0, False)
    assert m.detalhes["paginas"] == 2
    assert all(a <= 500 for a in m.alturas_paginas_cm)
