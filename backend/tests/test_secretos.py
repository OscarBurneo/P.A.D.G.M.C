"""HU-68: el repositorio está limpio y un secreto ficticio bloquea el escáner."""

import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]


def test_el_repositorio_no_contiene_secretos() -> None:
    resultado = subprocess.run(
        [sys.executable, str(RAIZ / "herramientas" / "escanear_secretos.py"), str(RAIZ)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert resultado.returncode == 0, resultado.stdout + resultado.stderr


def test_un_secreto_ficticio_bloquea_la_entrega() -> None:
    resultado = subprocess.run(
        [sys.executable, str(RAIZ / "herramientas" / "demostrar_bloqueo_secreto.py")],
        check=False,
        capture_output=True,
        text=True,
    )
    assert resultado.returncode == 0, resultado.stdout + resultado.stderr
    assert "Bloqueo confirmado" in resultado.stdout
