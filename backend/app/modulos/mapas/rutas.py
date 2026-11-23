"""Respuestas geográficas del Sprint 0.

La matriz de atributos está pendiente (P-02). Ninguna respuesta incluye
coordenadas individuales ni identificadores de socios.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.modelos import Usuario
from app.modulos.analitica.indice import CONDICION_ACEPTADA
from app.modulos.mapas.consulta import calor, resumen
from app.modulos.mapas.filtros import catalogo, interpretar

router = APIRouter(prefix="/api/mapas", tags=["mapas"])

_NOTA = "Esta respuesta no incluye la posición de cada socio ni datos personales."


@router.get("/agregado")
def agregado(
    _: Usuario = Depends(exige("mapas.ver")),
    db: Session = Depends(obtener_db),
) -> dict:
    total = db.execute(
        text(
            f"""
            SELECT count(*)
            FROM ubicaciones u
            JOIN lotes_importacion l ON l.id = u.lote_id
            WHERE l.estado = 'completado'
              AND {CONDICION_ACEPTADA}
            """
        )
    ).scalar()
    return {
        "total_registros": int(total or 0),
        "celdas_h3": [],
        "resolucion_h3": None,
        "nota": _NOTA,
    }


@router.get("/filtros")
def filtros_mapa(
    _: Usuario = Depends(exige("mapas.ver")),
    db: Session = Depends(obtener_db),
) -> dict:
    return catalogo(db)


@router.get("/resumen")
def resumen_mapa(
    request: Request,
    _: Usuario = Depends(exige("mapas.ver")),
    db: Session = Depends(obtener_db),
) -> dict:
    return resumen(db, interpretar(request.query_params, db))


@router.get("/calor")
def calor_mapa(
    request: Request,
    _: Usuario = Depends(exige("mapas.ver")),
    db: Session = Depends(obtener_db),
) -> dict:
    return calor(db, interpretar(request.query_params, db))


@router.get("/detalle")
def detalle(_: Usuario = Depends(exige("mapas.detalle"))) -> dict:
    return {
        "elementos": [],
        "nota": _NOTA,
        "estado_matriz": "pendiente_de_aprobacion",
    }
