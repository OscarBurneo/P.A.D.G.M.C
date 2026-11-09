"""Escaneo de secretos para HU-68 / RNF-34.

Recorre el árbol de trabajo y termina con código distinto de cero si encuentra
un secreto. Los valores de ejemplo y la credencial de prueba de CI están
permitidos de forma explícita; un secreto real no lo está.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

EXTENSIONES_OMITIDAS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".pdf",
    ".xlsx",
    ".xls",
    ".woff",
    ".woff2",
    ".lock",
}
DIRECTORIOS_OMITIDOS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    "dist",
    ".pytest_cache",
    ".ruff_cache",
}
VALORES_PERMITIDOS = {
    "cambiar-esto",
    "padgmc_prueba",
    "ejemplo",
    "clavesegura123",
    "placeholder",
}
PATRON_CLAVE = re.compile(r"AKIA[0-9A-Z]{16}")
PATRON_PRIVADA = re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----")
PATRON_GITHUB = re.compile(r"ghp_[A-Za-z0-9]{20,}")
PATRON_SLACK = re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}")
PATRON_ASIGNACION = re.compile(
    r"(?i)(?:^|[^A-Za-z0-9])("
    r"password|passwd|contrasena|contraseña|secret|secreto|"
    r"api[_-]?key|aws_secret_access_key"
    r")\s*[:=]\s*['\"]?([^\s'\"#]{8,})"
)
PATRON_URL = re.compile(r"[a-z][a-z0-9+.-]*://[^:\s/]+:([^@\s]{6,})@")
VALOR_SIMPLE = re.compile(r"^[A-Za-z0-9+/=_.@!-]{8,}$")


@dataclass(frozen=True)
class Hallazgo:
    regla: str
    ruta: Path
    linea: int
    detalle: str


def _permitido(valor: str) -> bool:
    limpio = valor.strip().strip("'\"")
    if limpio.startswith("$") or "${" in limpio:
        return True
    if limpio.casefold() in VALORES_PERMITIDOS:
        return True
    if any(fragmento in limpio.casefold() for fragmento in ("ejemplo", "placeholder", "cambiar-esto")):
        return True
    return False


def _parece_codigo(valor: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+", valor))


def buscar_texto(ruta: Path, texto: str) -> list[Hallazgo]:
    hallazgos: list[Hallazgo] = []
    for numero, linea in enumerate(texto.splitlines(), start=1):
        if PATRON_PRIVADA.search(linea):
            hallazgos.append(Hallazgo("clave_privada", ruta, numero, "clave privada"))
        if PATRON_CLAVE.search(linea):
            hallazgos.append(Hallazgo("aws_access_key", ruta, numero, "clave de acceso ficticia o real"))
        if PATRON_GITHUB.search(linea):
            hallazgos.append(Hallazgo("github_token", ruta, numero, "token de GitHub"))
        if PATRON_SLACK.search(linea):
            hallazgos.append(Hallazgo("slack_token", ruta, numero, "token de Slack"))
        for coincidencia in PATRON_URL.finditer(linea):
            if not _permitido(coincidencia.group(1)):
                hallazgos.append(Hallazgo("url_con_secreto", ruta, numero, "contraseña en una URL"))
        for coincidencia in PATRON_ASIGNACION.finditer(linea):
            valor = coincidencia.group(2)
            if not VALOR_SIMPLE.fullmatch(valor) or _parece_codigo(valor):
                continue
            if not _permitido(valor):
                hallazgos.append(Hallazgo("asignacion_secreta", ruta, numero, coincidencia.group(1)))
    return hallazgos


def buscar_archivo(ruta: Path) -> list[Hallazgo]:
    if ruta.suffix.casefold() in EXTENSIONES_OMITIDAS or ruta.name == ".env":
        return []
    try:
        texto = ruta.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []
    if "\0" in texto:
        return []
    return buscar_texto(ruta, texto)


def buscar_arbol(raiz: Path) -> list[Hallazgo]:
    hallazgos: list[Hallazgo] = []
    for ruta in raiz.rglob("*"):
        if not ruta.is_file():
            continue
        if any(parte in DIRECTORIOS_OMITIDOS for parte in ruta.parts):
            continue
        if ruta.stat().st_size > 1_000_000:
            continue
        hallazgos.extend(buscar_archivo(ruta))
    return hallazgos


def main() -> int:
    raiz = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    hallazgos = buscar_arbol(raiz)
    if not hallazgos:
        print(f"Sin secretos en {raiz}.")
        return 0
    print("Se detectaron posibles secretos. La entrega queda bloqueada.")
    for hallazgo in hallazgos:
        print(f"{hallazgo.regla}: {hallazgo.ruta}:{hallazgo.linea} ({hallazgo.detalle})")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
