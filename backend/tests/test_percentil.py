"""Cálculo del percentil usado por el script de carga. No sustituye a la ficha P-06."""

import importlib.util
from pathlib import Path

RUTA = Path(__file__).resolve().parents[1] / "scripts" / "carga_autenticacion.py"
spec = importlib.util.spec_from_file_location("carga_autenticacion", RUTA)
assert spec and spec.loader
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)


def test_percentil_95_de_una_serie_corta() -> None:
    assert modulo.percentil([10, 20, 30, 40, 100], 95) == 88
    assert modulo.percentil([5], 95) == 5
