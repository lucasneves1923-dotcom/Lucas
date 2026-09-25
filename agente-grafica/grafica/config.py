"""Leitura do config.yaml e do .env."""

from __future__ import annotations

import os
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parent.parent
CM = 72 / 2.54  # pontos PDF por centímetro

MODOS_SANGRIA = ("espelhar", "esticar", "arte_ja_tem", "nenhuma")


class ErroGrafica(Exception):
    """Erro com mensagem pronta para mostrar ao humano (em português)."""


def cm(valor: float) -> float:
    """Converte centímetros em pontos PDF."""
    return valor * CM


def carregar_config(caminho: Path | None = None) -> dict:
    caminho = caminho or RAIZ / "config.yaml"
    with open(caminho, encoding="utf-8") as f:
        config = yaml.safe_load(f)
    for tipo, valores in config["tipos"].items():
        if valores["modo_sangria"] not in MODOS_SANGRIA:
            raise ErroGrafica(
                f"config.yaml: tipo '{tipo}' tem modo_sangria inválido "
                f"'{valores['modo_sangria']}'. Use: {', '.join(MODOS_SANGRIA)}"
            )
    return config


def pasta(config: dict, nome: str) -> Path:
    p = Path(config["pastas"][nome])
    if not p.is_absolute():
        p = RAIZ / p
    p.mkdir(parents=True, exist_ok=True)
    return p


def carregar_env(caminho: Path | None = None) -> None:
    """Lê variáveis do arquivo .env (formato CHAVE=valor) sem sobrescrever as existentes."""
    caminho = caminho or RAIZ / ".env"
    if not caminho.exists():
        return
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))
