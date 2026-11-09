"""Medición simple del percentil 95 de autenticación (HU-64 / RNF-13).

No constituye aceptación: la ficha de carga sigue pendiente (P-06).
"""

from __future__ import annotations

import argparse
import math
import statistics
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path


def percentil(muestras: list[float], p: float) -> float:
    if not muestras:
        raise ValueError("No hay muestras.")
    ordenadas = sorted(muestras)
    if len(ordenadas) == 1:
        return ordenadas[0]
    posicion = (len(ordenadas) - 1) * (p / 100)
    inferior = math.floor(posicion)
    superior = math.ceil(posicion)
    if inferior == superior:
        return ordenadas[inferior]
    peso = posicion - inferior
    return ordenadas[inferior] * (1 - peso) + ordenadas[superior] * peso


def medir(url: str, identificador: str, contrasena: str, solicitudes: int) -> list[float]:
    cuerpo = f'{{"identificador":"{identificador}","contrasena":"{contrasena}"}}'.encode()
    muestras: list[float] = []
    for _ in range(solicitudes):
        peticion = urllib.request.Request(
            url,
            data=cuerpo,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        inicio = time.perf_counter()
        try:
            with urllib.request.urlopen(peticion, timeout=30) as respuesta:
                respuesta.read()
                if respuesta.status != 200:
                    raise RuntimeError(f"Respuesta {respuesta.status}")
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"La autenticación respondió {exc.code}") from exc
        muestras.append((time.perf_counter() - inicio) * 1000)
    return muestras


def informe(muestras: list[float], url: str, nota: str) -> str:
    p95 = percentil(muestras, 95)
    return "\n".join(
        [
            "# Evidencia de percentil 95 de autenticación",
            "",
            "Esta medición **no constituye aceptación** de RNF-13. La ficha de carga (P-06) no está aprobada.",
            "",
            f"- Fecha UTC: {datetime.now(UTC).isoformat(timespec='seconds')}",
            f"- URL: `{url}`",
            f"- Muestras: {len(muestras)}",
            "- Concurrencia: 1 (secuencial)",
            f"- Mínimo: {min(muestras):.1f} ms",
            f"- Mediana: {statistics.median(muestras):.1f} ms",
            f"- p95: {p95:.1f} ms",
            f"- Máximo: {max(muestras):.1f} ms",
            "- Objetivo propuesto, no aprobado: p95 < 3000 ms.",
            "- Resultado de esta corrida: "
            + ("dentro del objetivo propuesto." if p95 < 3000 else "fuera del objetivo propuesto."),
            f"- Entorno: {nota}",
            "",
            "El script es `backend/scripts/carga_autenticacion.py`.",
            "",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Mide el tiempo de autenticación.")
    parser.add_argument("--url", required=True)
    parser.add_argument("--identificador", default="admin")
    parser.add_argument("--contrasena", required=True)
    parser.add_argument("--solicitudes", type=int, default=20)
    parser.add_argument("--guardar", type=Path)
    parser.add_argument("--nota", default="entorno local de desarrollo")
    args = parser.parse_args()
    muestras = medir(args.url, args.identificador, args.contrasena, args.solicitudes)
    texto = informe(muestras, args.url, args.nota)
    print(texto)
    if args.guardar:
        args.guardar.parent.mkdir(parents=True, exist_ok=True)
        args.guardar.write_text(texto, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
