"""Respuestas geográficas del Sprint 0.

La matriz de atributos está pendiente (P-02). Ninguna respuesta incluye
coordenadas individuales ni identificadores de socios.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.modelos import Usuario
from app.modulos.cobertura.servicio import resumen_vacio

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


@router.get("/resumen")
def resumen(
    _: Usuario = Depends(exige("mapas.ver")),
    db: Session = Depends(obtener_db),
) -> dict:
    return resumen_vacio(db)


@router.get("/detalle")
def detalle(_: Usuario = Depends(exige("mapas.detalle"))) -> dict:
    return {
        "elementos": [],
        "nota": _NOTA,
        "estado_matriz": "pendiente_de_aprobacion",
    }
