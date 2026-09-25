import sys
from pathlib import Path

import pymupdf
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from grafica.config import carregar_config, cm  # noqa: E402


@pytest.fixture
def config(tmp_path):
    c = carregar_config()
    c["pastas"] = {"trabalho": str(tmp_path / "trabalho"), "saida": str(tmp_path / "saida")}
    return c


@pytest.fixture
def arte_pdf(tmp_path):
    """Arte vetorial 5x5 cm: fundo vermelho com um texto."""
    caminho = tmp_path / "arte.pdf"
    doc = pymupdf.open()
    p = doc.new_page(width=cm(5), height=cm(5))
    p.draw_rect(p.rect, color=None, fill=(1, 0, 0))
    p.insert_text((10, 30), "TESTE", fontsize=12)
    doc.save(caminho)
    return caminho


@pytest.fixture
def arte_png(tmp_path):
    """Imagem 5x5 cm a 300 dpi: metade azul, metade verde."""
    caminho = tmp_path / "arte.png"
    lado = round(5 / 2.54 * 300)
    img = Image.new("RGB", (lado, lado), (0, 0, 255))
    img.paste((0, 255, 0), (lado // 2, 0, lado, lado))
    img.save(caminho, dpi=(300, 300))
    return caminho
