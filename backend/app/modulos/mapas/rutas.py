"""Respuestas geográficas del Sprint 0.

La matriz de atributos está pendiente (P-02). Ninguna respuesta incluye
coordenadas individuales ni identificadores de socios.
"""

from fastapi import APIRouter, Depends

from app.dependencias import exige
from app.modelos import Usuario

router = APIRouter(prefix="/api/mapas", tags=["mapas"])

_NOTA = (
    "No hay registros de socios en el Sprint 0. Esta respuesta no incluye coordenadas individuales ni datos personales."
)


@router.get("/agregado")
def agregado(_: Usuario = Depends(exige("mapas.ver"))) -> dict:
    return {
        "total_registros": 0,
        "celdas_h3": [],
        "resolucion_h3": None,
        "nota": _NOTA,
    }


@router.get("/detalle")
def detalle(_: Usuario = Depends(exige("mapas.detalle"))) -> dict:
    return {
        "elementos": [],
        "nota": _NOTA,
        "estado_matriz": "pendiente_de_aprobacion",
    }
