"""Lectura de CSV y XLSX. No ejecuta fórmulas ni macros."""

import csv
import io
import math
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook

from app.errores import ErrorAplicacion

MAX_BYTES = 20 * 1024 * 1024
MAX_FILAS = 50_000
MAX_COLUMNAS = 64


@dataclass
class ArchivoTabular:
    encabezados: list[str]
    filas: list[tuple[int, list[str]]]
    encoding: str | None
    delimitador: str | None


def leer(nombre: str, contenido: bytes) -> ArchivoTabular:
    if not contenido:
        raise ErrorAplicacion(422, "El archivo está vacío.", "archivo_invalido")
    if len(contenido) > MAX_BYTES:
        raise ErrorAplicacion(413, "El archivo supera 20 MB.", "archivo_demasiado_grande")
    formato = _formato(nombre, contenido)
    if formato == "xlsx":
        return _leer_xlsx(contenido)
    return _leer_csv(contenido)


def _formato(nombre: str, contenido: bytes) -> str:
    extension = Path(nombre or "").suffix.casefold()
    if extension not in {".csv", ".xlsx"}:
        raise ErrorAplicacion(
            415,
            "Solo se aceptan archivos CSV o XLSX. El formato XLS no está en el contrato propuesto.",
            "formato_no_admitido",
        )
    es_zip = contenido.startswith(b"PK")
    if extension == ".xlsx" and not es_zip:
        raise ErrorAplicacion(422, "El XLSX no se puede abrir.", "archivo_ilegible")
    if extension == ".csv" and es_zip:
        raise ErrorAplicacion(
            415,
            "El archivo parece una hoja de cálculo con extensión CSV.",
            "formato_no_admitido",
        )
    return "xlsx" if extension == ".xlsx" else "csv"


def _leer_csv(contenido: bytes) -> ArchivoTabular:
    texto, encoding = _decodificar(contenido)
    if "\x00" in texto:
        raise ErrorAplicacion(422, "El CSV no tiene un texto legible.", "archivo_ilegible")
    primera = texto.splitlines()[0] if texto.strip() else ""
    delimitador = _delimitador(primera)
    lector = csv.reader(io.StringIO(texto), delimiter=delimitador)
    registros = [tuple(_texto(celda) for celda in fila) for fila in lector]
    return _tabular(registros, encoding, delimitador)


def _leer_xlsx(contenido: bytes) -> ArchivoTabular:
    try:
        libro = load_workbook(io.BytesIO(contenido), read_only=True, data_only=False)
    except Exception as exc:
        raise ErrorAplicacion(422, "El XLSX no se puede abrir.", "archivo_ilegible") from exc
    try:
        if not libro.worksheets:
            raise ErrorAplicacion(422, "El XLSX no tiene hojas.", "archivo_ilegible")
        hoja = libro.worksheets[0]
        registros: list[tuple[str, ...]] = []
        for indice, fila in enumerate(hoja.iter_rows(values_only=True)):
            if indice > MAX_FILAS:
                raise ErrorAplicacion(413, "El archivo supera 50000 filas de datos.", "archivo_demasiado_grande")
            celdas = tuple(_texto(valor) for valor in fila[:MAX_COLUMNAS])
            registros.append(celdas)
        return _tabular(registros, None, None)
    finally:
        libro.close()


def _tabular(
    registros: list[tuple[str, ...]],
    encoding: str | None,
    delimitador: str | None,
) -> ArchivoTabular:
    inicio = next((indice for indice, fila in enumerate(registros) if any(celda.strip() for celda in fila)), None)
    if inicio is None:
        raise ErrorAplicacion(422, "El archivo no trae encabezados.", "archivo_invalido")
    encabezados = _encabezados(registros[inicio])
    if not any(encabezados):
        raise ErrorAplicacion(422, "El archivo no trae encabezados.", "archivo_invalido")
    filas: list[tuple[int, list[str]]] = []
    for desplazamiento, fila in enumerate(registros[inicio + 1 :], start=inicio + 2):
        if len(filas) > MAX_FILAS:
            raise ErrorAplicacion(413, "El archivo supera 50000 filas de datos.", "archivo_demasiado_grande")
        celdas = list(fila[: len(encabezados)])
        if len(celdas) < len(encabezados):
            celdas.extend([""] * (len(encabezados) - len(celdas)))
        if not any(celda.strip() for celda in celdas):
            continue
        filas.append((desplazamiento, celdas))
    return ArchivoTabular(encabezados, filas, encoding, delimitador)


def _encabezados(fila: tuple[str, ...]) -> list[str]:
    vistos: dict[str, int] = {}
    resultado: list[str] = []
    for indice, celda in enumerate(fila[:MAX_COLUMNAS]):
        nombre = celda.strip() or f"columna_{indice + 1}"
        conteo = vistos.get(nombre, 0) + 1
        vistos[nombre] = conteo
        resultado.append(nombre if conteo == 1 else f"{nombre}_{conteo}")
    return resultado


def _decodificar(contenido: bytes) -> tuple[str, str]:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return contenido.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    raise ErrorAplicacion(422, "No se pudo leer el texto del archivo.", "archivo_ilegible")


def _delimitador(primera: str) -> str:
    candidatos = (",", ";", "\t")
    return max(candidatos, key=primera.count)


def _texto(valor: object) -> str:
    if valor is None:
        return ""
    if isinstance(valor, bool):
        return "true" if valor else "false"
    if isinstance(valor, datetime):
        return valor.date().isoformat()
    if isinstance(valor, date):
        return valor.isoformat()
    if isinstance(valor, float):
        if not math.isfinite(valor):
            return ""
        return f"{valor:.8f}".rstrip("0").rstrip(".")
    if isinstance(valor, int):
        return str(valor)
    return str(valor).strip()
