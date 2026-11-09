"""Proceso analítico de ejemplo. No sustituye a la predicción, que queda fuera del MVP."""

from dataclasses import asdict

from fastapi import APIRouter, Depends

from app.dependencias import exige
from app.modelos import Usuario
from app.modulos.analitica.interfaz import REGISTRO, VERSION_INTERFAZ, ejecutar_ejemplo

router = APIRouter(prefix="/api/analitica", tags=["analítica"])


@router.get("/procesos")
def procesos(_: Usuario = Depends(exige("analitica.ejemplo"))) -> dict:
    return {
        "version_interfaz": VERSION_INTERFAZ,
        "procesos": sorted(REGISTRO),
        "nota": "Catálogo de demostración. Las reglas analíticas reales están pendientes de aprobación (P-05).",
    }


@router.post("/ejemplo")
def ejemplo(_: Usuario = Depends(exige("analitica.ejemplo"))) -> dict:
    resultado = ejecutar_ejemplo(0)
    return asdict(resultado)
