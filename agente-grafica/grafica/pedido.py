"""Ficha de pedido (pedido.json): leitura, validação e aplicação dos padrões do config."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .config import MODOS_SANGRIA, ErroGrafica

EXTENSOES_ACEITAS = {".pdf", ".cdr", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}


@dataclass
class Item:
    arquivo: Path
    quantidade: int
    pagina: int = 1  # página do PDF/CDR (começa em 1)


@dataclass
class Pedido:
    id: str
    tipo: str
    largura_cm: float
    altura_cm: float
    itens: list[Item]
    montar: bool
    sangria_cm: float
    modo_sangria: str
    espacamento_cm: float
    girar_permitido: bool
    dpi_minimo: float
    cliente: str = ""
    observacoes: str = ""
    pasta: Path = field(default_factory=Path)

    @property
    def quantidade_total(self) -> int:
        return sum(i.quantidade for i in self.itens)


def _numero(dados: dict, chave: str, positivo: bool = True) -> float:
    valor = dados.get(chave)
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        raise ErroGrafica(f"pedido.json: '{chave}' precisa ser um número (recebi {valor!r})")
    if positivo and valor <= 0:
        raise ErroGrafica(f"pedido.json: '{chave}' precisa ser maior que zero (recebi {valor})")
    if not positivo and valor < 0:
        raise ErroGrafica(f"pedido.json: '{chave}' não pode ser negativo (recebi {valor})")
    return float(valor)


def carregar_pedido(caminho: Path, config: dict) -> Pedido:
    caminho = Path(caminho)
    try:
        dados = json.loads(caminho.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ErroGrafica(f"Ficha de pedido não encontrada: {caminho}") from None
    except json.JSONDecodeError as e:
        raise ErroGrafica(f"pedido.json com erro de formato: {e}") from None
    return montar_pedido(dados, config, caminho.parent)


def montar_pedido(dados: dict, config: dict, pasta: Path) -> Pedido:
    tipo = dados.get("tipo")
    if tipo not in config["tipos"]:
        raise ErroGrafica(
            f"pedido.json: 'tipo' deve ser um de {list(config['tipos'])} (recebi {tipo!r})"
        )
    padrao = config["tipos"][tipo]

    def opcao(chave):
        valor = dados.get(chave)
        return padrao[chave] if valor is None else valor

    itens_brutos = dados.get("itens")
    if not isinstance(itens_brutos, list) or not itens_brutos:
        raise ErroGrafica("pedido.json: 'itens' precisa ter pelo menos um arquivo com quantidade")

    itens = []
    for n, bruto in enumerate(itens_brutos, 1):
        if not bruto.get("arquivo"):
            raise ErroGrafica(f"pedido.json: item {n} está sem 'arquivo'")
        arquivo = Path(bruto["arquivo"])
        if not arquivo.is_absolute():
            arquivo = pasta / arquivo
        if not arquivo.exists():
            raise ErroGrafica(f"pedido.json: item {n}: arquivo não encontrado: {arquivo}")
        if arquivo.suffix.lower() not in EXTENSOES_ACEITAS:
            raise ErroGrafica(
                f"pedido.json: item {n}: formato {arquivo.suffix} não suportado "
                f"(aceitos: {', '.join(sorted(EXTENSOES_ACEITAS))})"
            )
        quantidade = bruto.get("quantidade")
        if isinstance(quantidade, bool) or not isinstance(quantidade, int) or quantidade < 1:
            raise ErroGrafica(
                f"pedido.json: item {n}: 'quantidade' precisa ser inteiro ≥ 1 (recebi {quantidade!r})"
            )
        pagina = bruto.get("pagina", 1)
        if isinstance(pagina, bool) or not isinstance(pagina, int) or pagina < 1:
            raise ErroGrafica(f"pedido.json: item {n}: 'pagina' precisa ser inteiro ≥ 1")
        itens.append(Item(arquivo=arquivo, quantidade=quantidade, pagina=pagina))

    modo = opcao("modo_sangria")
    if modo not in MODOS_SANGRIA:
        raise ErroGrafica(
            f"pedido.json: 'modo_sangria' deve ser um de {list(MODOS_SANGRIA)} (recebi {modo!r})"
        )

    mesclado = {**dados, "sangria_cm": opcao("sangria_cm"), "espacamento_cm": opcao("espacamento_cm")}
    return Pedido(
        id=str(dados.get("id") or pasta.name),
        tipo=tipo,
        largura_cm=_numero(dados, "largura_cm"),
        altura_cm=_numero(dados, "altura_cm"),
        itens=itens,
        montar=bool(opcao("montar")),
        sangria_cm=_numero(mesclado, "sangria_cm", positivo=False),
        modo_sangria=modo,
        espacamento_cm=_numero(mesclado, "espacamento_cm", positivo=False),
        girar_permitido=bool(opcao("girar_permitido")),
        dpi_minimo=float(padrao.get("dpi_minimo", 0)),
        cliente=str(dados.get("cliente", "")),
        observacoes=str(dados.get("observacoes", "")),
        pasta=pasta,
    )
