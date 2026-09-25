import json

import pytest

from grafica import trello as mod
from grafica.config import ErroGrafica


class Resposta:
    def __init__(self, dados=None, status=200, conteudo=b""):
        self._dados, self.status_code, self._conteudo = dados, status, conteudo
        self.content = json.dumps(dados).encode() if dados is not None else conteudo
        self.text = self.content.decode(errors="ignore")

    def json(self):
        return self._dados

    def iter_content(self, _):
        yield self._conteudo

    def __enter__(self):
        return self

    def __exit__(self, *a):
        pass


LISTAS = [{"name": "A fazer", "id": "L1"}, {"name": "Em produção", "id": "L2"},
          {"name": "Dúvidas do agente", "id": "L3"}, {"name": "Pronto para imprimir", "id": "L4"}]


@pytest.fixture
def api(monkeypatch):
    chamadas = []

    def request(metodo, url, params=None, **kw):
        chamadas.append((metodo, url.replace(mod.API, ""), params))
        caminho = url.replace(mod.API, "")
        if caminho.endswith("/lists"):
            return Resposta(LISTAS)
        if caminho == "/lists/L1/cards":
            return Resposta([{"id": "c1", "shortLink": "AbC", "name": "Adesivo Loja X",
                              "desc": "5x5 cm, 100 un", "shortUrl": "https://trello.com/c/AbC",
                              "labels": []}])
        if caminho.endswith("/attachments") and metodo == "GET":
            return Resposta([{"isUpload": True, "name": "arte.pdf", "fileName": "arte.pdf",
                              "url": "https://trello.com/arquivo"}])
        if caminho.endswith("/actions"):
            return Resposta([{"memberCreator": {"fullName": "Ana"}, "date": "2",
                              "data": {"text": "na verdade são 200"}},
                             {"memberCreator": {"fullName": "Ana"}, "date": "1",
                              "data": {"text": "oi"}}])
        return Resposta({})

    monkeypatch.setattr(mod.requests, "request", request)
    monkeypatch.setattr(mod.requests, "get", lambda url, headers, **kw: Resposta(conteudo=b"%PDF"))
    for chave in ("TRELLO_KEY", "TRELLO_TOKEN", "TRELLO_BOARD"):
        monkeypatch.setenv(chave, "x")
    return chamadas


def test_baixar_pedidos(config, api):
    cartoes = mod.Trello(config).baixar_pedidos()
    assert len(cartoes) == 1
    c = cartoes[0]
    assert c["anexos"][0]["baixado"]
    assert open(c["anexos"][0]["arquivo"], "rb").read() == b"%PDF"
    assert [x["texto"] for x in c["comentarios"]] == ["oi", "na verdade são 200"]  # antigo → novo


def test_mover_usa_id_da_lista(config, api):
    mod.Trello(config).mover("AbC", "duvidas")
    assert ("PUT", "/cards/AbC", {"key": "x", "token": "x", "idList": "L3", "pos": "top"}) in api


def test_lista_inexistente_explica(config, api):
    config["trello"]["listas"]["pronto"] = "Feito"
    with pytest.raises(ErroGrafica, match="Feito"):
        mod.Trello(config).listas()


def test_sem_credenciais(config, monkeypatch):
    monkeypatch.setattr(mod, "carregar_env", lambda: None)
    for chave in ("TRELLO_KEY", "TRELLO_TOKEN", "TRELLO_BOARD"):
        monkeypatch.delenv(chave, raising=False)
    with pytest.raises(ErroGrafica, match="TRELLO_KEY"):
        mod.Trello(config)
