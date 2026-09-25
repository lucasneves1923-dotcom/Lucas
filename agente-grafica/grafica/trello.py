"""Integração com o Trello: baixar pedidos, comentar, mover e anexar arquivos.

Precisa de TRELLO_KEY, TRELLO_TOKEN e TRELLO_BOARD no arquivo .env
(veja .env.example e o README).
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import requests

from .config import ErroGrafica, carregar_env, pasta

API = "https://api.trello.com/1"


class Trello:
    def __init__(self, config: dict):
        carregar_env()
        self.key = os.environ.get("TRELLO_KEY", "")
        self.token = os.environ.get("TRELLO_TOKEN", "")
        self.board = os.environ.get("TRELLO_BOARD", "")
        faltando = [n for n, v in (("TRELLO_KEY", self.key), ("TRELLO_TOKEN", self.token),
                                   ("TRELLO_BOARD", self.board)) if not v]
        if faltando:
            raise ErroGrafica(f"Faltam no arquivo .env: {', '.join(faltando)} (veja o README)")
        self.config = config
        self._listas: dict[str, str] | None = None

    # --- HTTP -------------------------------------------------------------
    def _req(self, metodo: str, caminho: str, **kwargs):
        params = {"key": self.key, "token": self.token, **kwargs.pop("params", {})}
        r = requests.request(metodo, f"{API}{caminho}", params=params, timeout=60, **kwargs)
        if r.status_code >= 400:
            raise ErroGrafica(f"Trello respondeu {r.status_code} em {caminho}: {r.text[:200]}")
        return r.json() if r.content else None

    # --- listas -----------------------------------------------------------
    def listas(self) -> dict[str, str]:
        """Mapa apelido (entrada, em_producao, duvidas, pronto) → id da lista no quadro."""
        if self._listas is None:
            existentes = {l["name"].strip(): l["id"] for l in self._req("GET", f"/boards/{self.board}/lists")}
            self._listas = {}
            for apelido, nome in self.config["trello"]["listas"].items():
                if nome not in existentes:
                    raise ErroGrafica(
                        f"Lista '{nome}' não existe no quadro. Listas encontradas: {list(existentes)}. "
                        "Crie a lista ou corrija o nome em config.yaml → trello.listas."
                    )
                self._listas[apelido] = existentes[nome]
        return self._listas

    # --- pedidos ----------------------------------------------------------
    def baixar_pedidos(self) -> list[dict]:
        """Baixa todos os cartões da lista de entrada para trabalho/<id>/ e devolve um resumo."""
        lista = self.listas()["entrada"]
        cartoes = self._req("GET", f"/lists/{lista}/cards",
                            params={"fields": "name,desc,shortLink,shortUrl,labels"})
        resultado = []
        for c in cartoes:
            destino = pasta(self.config, "trabalho") / c["shortLink"]
            destino.mkdir(parents=True, exist_ok=True)
            anexos = []
            for a in self._req("GET", f"/cards/{c['id']}/attachments"):
                if not a.get("isUpload"):
                    anexos.append({"nome": a["name"], "link": a["url"], "baixado": False})
                    continue
                arquivo = destino / _nome_arquivo(a["fileName"] or a["name"])
                if not arquivo.exists():
                    self._baixar(a["url"], arquivo)
                anexos.append({"nome": a["name"], "arquivo": str(arquivo), "baixado": True})
            comentarios = [
                {"autor": x["memberCreator"]["fullName"], "data": x["date"], "texto": x["data"]["text"]}
                for x in self._req("GET", f"/cards/{c['id']}/actions",
                                   params={"filter": "commentCard", "limit": 50})
            ][::-1]  # do mais antigo pro mais novo
            cartao = {
                "id": c["shortLink"],
                "titulo": c["name"],
                "descricao": c["desc"],
                "etiquetas": [l["name"] for l in c.get("labels", []) if l.get("name")],
                "link": c["shortUrl"],
                "pasta": str(destino),
                "anexos": anexos,
                "comentarios": comentarios,
            }
            (destino / "cartao.json").write_text(json.dumps(cartao, ensure_ascii=False, indent=2),
                                                 encoding="utf-8")
            resultado.append(cartao)
        return resultado

    def _baixar(self, url: str, arquivo: Path) -> None:
        # Anexos do Trello exigem autenticação no cabeçalho, não na URL.
        cabecalho = {"Authorization": f'OAuth oauth_consumer_key="{self.key}", oauth_token="{self.token}"'}
        with requests.get(url, headers=cabecalho, stream=True, timeout=300) as r:
            if r.status_code >= 400:
                raise ErroGrafica(f"Não consegui baixar o anexo {url}: HTTP {r.status_code}")
            with open(arquivo, "wb") as f:
                for bloco in r.iter_content(1 << 20):
                    f.write(bloco)

    # --- ações ------------------------------------------------------------
    def comentar(self, cartao: str, texto: str) -> None:
        self._req("POST", f"/cards/{cartao}/actions/comments", params={"text": texto})

    def mover(self, cartao: str, apelido_lista: str) -> None:
        listas = self.listas()
        if apelido_lista not in listas:
            raise ErroGrafica(f"Lista desconhecida '{apelido_lista}'. Use: {', '.join(listas)}")
        self._req("PUT", f"/cards/{cartao}", params={"idList": listas[apelido_lista], "pos": "top"})

    def anexar(self, cartao: str, arquivo: Path) -> None:
        with open(arquivo, "rb") as f:
            self._req("POST", f"/cards/{cartao}/attachments",
                      files={"file": (Path(arquivo).name, f)}, params={"name": Path(arquivo).name})


def _nome_arquivo(nome: str) -> str:
    return re.sub(r'[<>:"/\\|?*]+', "_", nome).strip() or "anexo"
