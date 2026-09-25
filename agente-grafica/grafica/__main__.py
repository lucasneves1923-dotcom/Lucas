"""Linha de comando do agente da gráfica. Rode `python -m grafica --help`."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import ErroGrafica, carregar_config


def _imprimir(dados) -> None:
    print(json.dumps(dados, ensure_ascii=False, indent=2) if not isinstance(dados, str) else dados)


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # acentos no terminal do Windows

    p = argparse.ArgumentParser(prog="python -m grafica", description="Agente de acabamento da gráfica")
    sub = p.add_subparsers(dest="comando", required=True)

    s = sub.add_parser("processar", help="Processa uma ficha pedido.json e gera o PDF final")
    s.add_argument("pedido", type=Path)

    s = sub.add_parser("simular", help="Calcula a montagem na bobina sem gerar arquivo")
    s.add_argument("--largura", type=float, required=True, help="largura final da peça em cm")
    s.add_argument("--altura", type=float, required=True, help="altura final da peça em cm")
    s.add_argument("--quantidade", type=int, required=True)
    s.add_argument("--tipo", default="adesivo")
    s.add_argument("--sangria", type=float, help="cm por lado (padrão: do config)")
    s.add_argument("--espacamento", type=float, help="cm entre peças (padrão: do config)")

    s = sub.add_parser("trello", help="Operações no Trello")
    t = s.add_subparsers(dest="acao", required=True)
    t.add_parser("baixar", help="Baixa os cartões da lista de entrada para trabalho/")
    x = t.add_parser("comentar")
    x.add_argument("cartao")
    x.add_argument("texto")
    x = t.add_parser("mover")
    x.add_argument("cartao")
    x.add_argument("lista", choices=["entrada", "em_producao", "duvidas", "pronto"])
    x = t.add_parser("anexar")
    x.add_argument("cartao")
    x.add_argument("arquivo", type=Path)

    s = sub.add_parser("corel", help="Operações no CorelDRAW")
    c = s.add_subparsers(dest="acao", required=True)
    c.add_parser("testar", help="Verifica se o agente consegue controlar o Corel")
    x = c.add_parser("abrir", help="Abre um arquivo no Corel para conferência")
    x.add_argument("arquivo", type=Path)

    args = p.parse_args(argv)
    try:
        config = carregar_config()
        if args.comando == "processar":
            from .pedido import carregar_pedido
            from .processar import processar

            _imprimir(processar(carregar_pedido(args.pedido, config), config))

        elif args.comando == "simular":
            from .montagem import calcular

            if args.tipo not in config["tipos"]:
                raise ErroGrafica(f"Tipo desconhecido '{args.tipo}'. Use: {', '.join(config['tipos'])}")
            padrao = config["tipos"][args.tipo]
            if not padrao["montar"]:
                raise ErroGrafica(f"O tipo '{args.tipo}' não é montado na bobina (montar: false no config.yaml).")
            sangria = padrao["sangria_cm"] if args.sangria is None else args.sangria
            if padrao["modo_sangria"] == "nenhuma" and args.sangria is None:
                sangria = 0
            espacamento = padrao["espacamento_cm"] if args.espacamento is None else args.espacamento
            layout = calcular(args.largura + 2 * sangria, args.altura + 2 * sangria, args.quantidade,
                              config["bobina"], espacamento, padrao["girar_permitido"])
            _imprimir(layout.como_dict())

        elif args.comando == "trello":
            from .trello import Trello

            trello = Trello(config)
            if args.acao == "baixar":
                _imprimir(trello.baixar_pedidos())
            elif args.acao == "comentar":
                trello.comentar(args.cartao, args.texto)
                _imprimir("ok")
            elif args.acao == "mover":
                trello.mover(args.cartao, args.lista)
                _imprimir("ok")
            elif args.acao == "anexar":
                trello.anexar(args.cartao, args.arquivo)
                _imprimir("ok")

        elif args.comando == "corel":
            from . import corel

            if args.acao == "testar":
                _imprimir(corel.testar(config))
            else:
                corel.abrir(args.arquivo, config)
                _imprimir("ok")
    except ErroGrafica as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
