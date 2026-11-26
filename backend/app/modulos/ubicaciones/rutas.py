"""Consulta agregada y alta manual. La consulta no entrega la posición ni el identificador de cada socio."""

from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.modelos import Usuario
from app.modulos.analitica.indice import CONDICION_ACEPTADA
from app.modulos.ubicaciones.servicio import registrar as registrar_ubicacion

router = APIRouter(prefix="/api/ubicaciones", tags=["ubicaciones"])


@router.get("")
def consultar(
    _: Usuario = Depends(exige("ubicaciones.consultar")),
    db: Session = Depends(obtener_db),
) -> dict:
    total = db.execute(
        text(
            f"""
            SELECT count(*)
            FROM ubicaciones u
            LEFT JOIN lotes_importacion l ON l.id = u.lote_id
            WHERE (l.estado = 'completado' OR u.lote_id IS NULL)
              AND {CONDICION_ACEPTADA}
            """
        )
    ).scalar()
    return {
        "total_registros": int(total or 0),
        "agregado": [],
        "nota": (
            "Conteo de registros aceptados, incluidos los de alta manual. Esta respuesta no identifica a cada socio."
        ),
    }


@router.post("", status_code=201)
def registrar(
    datos: Any = Body(...),
    actor: Usuario = Depends(exige("importaciones.publicar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return registrar_ubicacion(db, actor, datos)
