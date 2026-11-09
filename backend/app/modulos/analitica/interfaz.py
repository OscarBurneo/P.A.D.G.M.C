"""Interfaz estable para incorporar procesos sin tocar autenticación, carga ni mapas.

Regla RG-AN-01. Versión de la interfaz: 1.
"""

from dataclasses import dataclass
from typing import Protocol

VERSION_INTERFAZ = "1"


@dataclass(frozen=True)
class ContextoProceso:
    version_interfaz: str
    registros_validos: int


@dataclass(frozen=True)
class ResultadoProceso:
    codigo: str
    version_interfaz: str
    total: int
    unidad: str
    detalle: str


class ProcesoAnalitico(Protocol):
    codigo: str

    def ejecutar(self, contexto: ContextoProceso) -> ResultadoProceso: ...


class ProcesoConteoEjemplo:
    """Cuenta registros válidos. No lee credenciales ni altera otros módulos."""

    codigo = "ejemplo.conteo"

    def ejecutar(self, contexto: ContextoProceso) -> ResultadoProceso:
        return ResultadoProceso(
            codigo=self.codigo,
            version_interfaz=contexto.version_interfaz,
            total=contexto.registros_validos,
            unidad="registros",
            detalle="Proceso de ejemplo sobre el contrato analítico. No hay datos de socios en el Sprint 0.",
        )


REGISTRO: dict[str, ProcesoAnalitico] = {ProcesoConteoEjemplo.codigo: ProcesoConteoEjemplo()}


def ejecutar_ejemplo(registros_validos: int = 0) -> ResultadoProceso:
    contexto = ContextoProceso(version_interfaz=VERSION_INTERFAZ, registros_validos=registros_validos)
    return REGISTRO["ejemplo.conteo"].ejecutar(contexto)
