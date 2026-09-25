"""Automação do CorelDRAW via COM (só funciona no Windows com o Corel instalado).

O Corel é usado apenas para o que só ele faz bem: abrir .cdr, converter textos em
curvas e exportar PDF. Toda a montagem acontece depois, em Python.
"""

from __future__ import annotations

import sys
from pathlib import Path

from .config import ErroGrafica

CDR_TEXTO = 6  # cdrTextShape
CDR_GRUPO = 7  # cdrGroupShape


def conectar(config: dict):
    if sys.platform != "win32":
        raise ErroGrafica("A automação do CorelDRAW só funciona no Windows.")
    try:
        import win32com.client
    except ImportError:
        raise ErroGrafica("Falta o pacote pywin32. Rode: pip install pywin32") from None

    versao = config["corel"]["versao"]
    ultimo_erro = None
    for progid in (f"CorelDRAW.Application.{versao}", "CorelDRAW.Application"):
        try:
            app = win32com.client.Dispatch(progid)
            app.Visible = bool(config["corel"].get("visivel", True))
            return app
        except Exception as e:  # noqa: BLE001 - erro COM não tem tipo útil
            ultimo_erro = e
    raise ErroGrafica(
        f"Não consegui abrir o CorelDRAW {versao} por automação: {ultimo_erro}. "
        "Confira se o Corel está instalado e abre normalmente."
    )


def _texto_em_curvas(shapes) -> int:
    """Converte todo texto em curvas, entrando em grupos. Devolve quantos converteu."""
    convertidos = 0
    for i in range(shapes.Count, 0, -1):  # de trás pra frente: converter muda a coleção
        shape = shapes.Item(i)
        if shape.Type == CDR_TEXTO:
            shape.ConvertToCurves()
            convertidos += 1
        elif shape.Type == CDR_GRUPO:
            convertidos += _texto_em_curvas(shape.Shapes)
    return convertidos


def cdr_para_pdf(cdr: Path, pdf: Path, config: dict) -> dict:
    """Abre o .cdr, converte textos em curvas e exporta PDF. Nunca salva o .cdr original."""
    app = conectar(config)
    doc = app.OpenDocument(str(Path(cdr).resolve()))
    try:
        convertidos = 0
        for n in range(1, doc.Pages.Count + 1):
            convertidos += _texto_em_curvas(doc.Pages.Item(n).Shapes)
        doc.PDFSettings.TextAsCurves = True
        doc.PDFSettings.EmbedFonts = False
        pdf.parent.mkdir(parents=True, exist_ok=True)
        doc.PublishToPDF(str(Path(pdf).resolve()))
        return {"paginas": doc.Pages.Count, "textos_convertidos_em_curvas": convertidos}
    finally:
        doc.Dirty = False  # fecha sem perguntar e sem salvar as alterações no .cdr
        doc.Close()


def testar(config: dict) -> str:
    app = conectar(config)
    return f"CorelDRAW conectado: versão {app.VersionMajor}.{app.VersionMinor}"


def abrir(arquivo: Path, config: dict) -> None:
    """Abre um arquivo (ex.: o PDF final) no Corel para conferência humana."""
    app = conectar(config)
    app.Visible = True
    app.OpenDocument(str(Path(arquivo).resolve()))
