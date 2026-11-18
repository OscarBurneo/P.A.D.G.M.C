"""Contrato de columnas propuesto (P-01).

Todo el mapeo vive aquí para poder cambiarlo después de la reunión con
los stakeholders, sin buscar textos sueltos en la validación.
"""

import math

from app.errores import ErrorAplicacion
from app.modulos.cobertura.datos import normalizar

VERSION_CONTRATO = "0.1.0-propuesto"
TAMANO_METROS = 5.0
_METROS_POR_GRADO = 111_320.0


class Columna:
    def __init__(
        self,
        campo: str,
        etiqueta: str,
        tipo: str,
        obligatorio: bool,
        alias: tuple[str, ...],
        descripcion: str,
        ejemplo: str,
    ) -> None:
        self.campo = campo
        self.etiqueta = etiqueta
        self.tipo = tipo
        self.obligatorio = obligatorio
        self.alias = alias
        self.descripcion = descripcion
        self.ejemplo = ejemplo


COLUMNAS: tuple[Columna, ...] = (
    Columna(
        "identificador_socio",
        "Identificador de socio",
        "texto",
        True,
        ("identificador_socio", "identificador", "id_socio", "socio_id", "cedula", "codigo_socio"),
        "Identificador del potencial socio dentro del archivo. No es la cuenta de la plataforma.",
        "SOC-001",
    ),
    Columna(
        "nombre",
        "Nombre",
        "texto",
        True,
        ("nombre", "nombres", "nombre_socio", "razon_social"),
        "Nombre con el que se reconoce al potencial socio.",
        "Ana Pérez",
    ),
    Columna(
        "latitud",
        "Latitud",
        "decimal",
        True,
        ("latitud", "lat"),
        "Latitud en grados decimales, WGS 84. El punto es latitud y luego longitud.",
        "-3.99313",
    ),
    Columna(
        "longitud",
        "Longitud",
        "decimal",
        True,
        ("longitud", "long", "lng", "lon"),
        "Longitud en grados decimales, WGS 84.",
        "-79.20422",
    ),
    Columna(
        "provincia",
        "Provincia",
        "texto",
        True,
        ("provincia", "prov"),
        "Provincia declarada. Se contrasta con los límites ADM1, incluidas Galápagos.",
        "Loja",
    ),
    Columna(
        "canton",
        "Cantón",
        "texto",
        True,
        ("canton",),
        "Cantón declarado. Todavía no hay contorno cantonal: se guarda como texto normalizado.",
        "Loja",
    ),
    Columna(
        "agencia",
        "Agencia",
        "texto",
        True,
        ("agencia", "oficina", "sucursal"),
        "Agencia de la cooperativa asociada al registro. Entra en la densidad por provincia.",
        "Agencia Centro",
    ),
    Columna(
        "fecha",
        "Fecha",
        "fecha",
        True,
        ("fecha", "fecha_registro", "fecha_alta"),
        "Fecha del registro. Se aceptan AAAA-MM-DD, DD/MM/AAAA y DD-MM-AAAA.",
        "2024-03-15",
    ),
)


def clave_encabezado(texto: str) -> str:
    return normalizar(texto).replace(" ", "_").replace("-", "_")


def sugerir_mapeo(encabezados: list[str]) -> dict[str, str | None]:
    disponibles: dict[str, str] = {}
    for encabezado in encabezados:
        clave = clave_encabezado(encabezado)
        if clave and clave not in disponibles:
            disponibles[clave] = encabezado
    usados: set[str] = set()
    resultado: dict[str, str | None] = {}
    for columna in COLUMNAS:
        elegido = None
        for alias in (columna.campo, *columna.alias):
            clave = clave_encabezado(alias)
            if clave in disponibles and clave not in usados:
                elegido = disponibles[clave]
                usados.add(clave)
                break
        resultado[columna.campo] = elegido
    return resultado


def resolver_mapeo(encabezados: list[str], propuesto: dict | None) -> dict[str, str | None]:
    sugerido = sugerir_mapeo(encabezados)
    if not propuesto:
        return sugerido
    por_clave = {clave_encabezado(item): item for item in encabezados if clave_encabezado(item)}
    resultado: dict[str, str | None] = {}
    for columna in COLUMNAS:
        if columna.campo not in propuesto:
            resultado[columna.campo] = sugerido[columna.campo]
            continue
        valor = propuesto[columna.campo]
        if valor is None or str(valor).strip() == "":
            resultado[columna.campo] = None
            continue
        clave = clave_encabezado(str(valor))
        if clave not in por_clave:
            raise ErrorAplicacion(
                422,
                f"El encabezado «{valor}» no está en el archivo.",
                "mapeo_invalido",
            )
        resultado[columna.campo] = por_clave[clave]
    return resultado


def columnas_faltantes(mapeo: dict[str, str | None]) -> list[str]:
    return [columna.etiqueta for columna in COLUMNAS if columna.obligatorio and not mapeo.get(columna.campo)]


def columnas_publicas() -> list[dict[str, object]]:
    return [
        {
            "campo": columna.campo,
            "etiqueta": columna.etiqueta,
            "tipo": columna.tipo,
            "obligatorio": columna.obligatorio,
            "alias": list(columna.alias),
            "descripcion": columna.descripcion,
            "ejemplo": columna.ejemplo,
        }
        for columna in COLUMNAS
    ]


def clave_ubicacion(latitud: float, longitud: float) -> tuple[int, int]:
    """Celda de aproximadamente 5 m. El redondeo es la regla de coincidencia (P-04)."""

    fila = round(latitud * _METROS_POR_GRADO / TAMANO_METROS)
    columna = round(longitud * _METROS_POR_GRADO * math.cos(math.radians(latitud)) / TAMANO_METROS)
    return fila, columna
