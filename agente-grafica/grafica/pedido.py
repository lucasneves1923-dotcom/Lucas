"""Ficha de pedido (pedido.json): leitura, validação e aplicação dos padrões do config."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .config import MODOS_SANGRIA, ErroGrafica
from .corte import FORMATOS

EXTENSOES_ACEITAS = {".pdf", ".cdr", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}


@dataclass
class Item:
    arquivo: Path
    quantidade: int
    largura_cm: float  # tamanho final desta arte (sem sangria)
    altura_cm: float
    pagina: int = 1  # página do PDF/CDR (começa em 1)


@dataclass
class Pedido:
    id: str
    tipo: str
    itens: list[Item]
    montar: bool
    sangria_cm: float
    modo_sangria: str
    espacamento_cm: float
    girar_permitido: bool
    dpi_minimo: float
    linha_corte: bool
    formato: str
    raio_canto_cm: float
    cliente: str = ""
    observacoes: str = ""
    pasta: Path = field(default_factory=Path)

    @property
    def quantidade_total(self) -> int:
        return sum(i.quantidade for i in self.itens)

    @property
    def tamanho_unico(self) -> bool:
        return len({(i.largura_cm, i.altura_cm) for i in self.itens}) == 1


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

    def opcao(chave, reserva=None):
        valor = dados.get(chave)
        return padrao.get(chave, reserva) if valor is None else valor

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
        tamanho = {}
        for chave in ("largura_cm", "altura_cm"):
            fonte = bruto if bruto.get(chave) is not None else dados
            if fonte.get(chave) is None:
                raise ErroGrafica(
                    f"pedido.json: item {n} está sem '{chave}' (informe no item ou no pedido)"
                )
            tamanho[chave] = _numero(fonte, chave)
        itens.append(Item(arquivo=arquivo, quantidade=quantidade, pagina=pagina, **tamanho))

    modo = opcao("modo_sangria")
    if modo not in MODOS_SANGRIA:
        raise ErroGrafica(
            f"pedido.json: 'modo_sangria' deve ser um de {list(MODOS_SANGRIA)} (recebi {modo!r})"
        )

    formato = opcao("formato", "retangulo")
    if formato not in FORMATOS:
        raise ErroGrafica(f"pedido.json: 'formato' deve ser um de {list(FORMATOS)} (recebi {formato!r})")

    mesclado = {
        **dados,
        "sangria_cm": opcao("sangria_cm"),
        "espacamento_cm": opcao("espacamento_cm"),
        "raio_canto_cm": opcao("raio_canto_cm", 0),
    }
    return Pedido(
        id=str(dados.get("id") or pasta.name),
        tipo=tipo,
        itens=itens,
        montar=bool(opcao("montar")),
        sangria_cm=_numero(mesclado, "sangria_cm", positivo=False),
        modo_sangria=modo,
        espacamento_cm=_numero(mesclado, "espacamento_cm", positivo=False),
        girar_permitido=bool(opcao("girar_permitido")),
        dpi_minimo=float(padrao.get("dpi_minimo", 0)),
        linha_corte=bool(opcao("linha_corte", False)),
        formato=formato,
        raio_canto_cm=_numero(mesclado, "raio_canto_cm", positivo=False),
        cliente=str(dados.get("cliente", "")),
        observacoes=str(dados.get("observacoes", "")),
        pasta=pasta,
    )
