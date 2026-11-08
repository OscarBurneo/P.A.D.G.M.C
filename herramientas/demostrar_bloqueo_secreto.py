"""Demuestra que un secreto ficticio, fuera del repositorio, bloquea el escáner.

La clave se arma en tiempo de ejecución para no dejarla contigua en el código.
Es el ejemplo público de documentación de AWS, no una credencial real.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from escanear_secretos import buscar_archivo


def main() -> int:
    clave = "AKIA" + "IOSFODNN7EXAMPLE"
    with tempfile.TemporaryDirectory() as carpeta:
        ruta = Path(carpeta) / "ajuste.env"
        ruta.write_text(f"AWS_SECRET_ACCESS_KEY={clave}\n", encoding="utf-8")
        hallazgos = buscar_archivo(ruta)
    if not hallazgos:
        print("El escáner no bloqueó el secreto ficticio.")
        return 1
    print("Bloqueo confirmado ante secreto ficticio.")
    for hallazgo in hallazgos:
        print(f"{hallazgo.regla}: linea {hallazgo.linea}")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
