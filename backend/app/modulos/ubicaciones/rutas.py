"""Consulta agregada. No entrega la posición ni el identificador de cada socio."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.errores import ErrorAplicacion
from app.modelos import Usuario

router = APIRouter(prefix="/api/ubicaciones", tags=["ubicaciones"])


@router.get("")
def consultar(
    _: Usuario = Depends(exige("ubicaciones.consultar")),
    db: Session = Depends(obtener_db),
) -> dict:
    total = db.execute(
        text(
            """
            SELECT count(*)
            FROM ubicaciones u
            JOIN lotes_importacion l ON l.id = u.lote_id
            WHERE l.estado = 'completado'
            """
        )
    ).scalar()
    return {
        "total_registros": int(total or 0),
        "agregado": [],
        "nota": "Conteo de registros publicados. Esta respuesta no identifica a cada socio.",
    }


@router.post("")
def registrar(_: Usuario = Depends(exige("ubicaciones.consultar"))) -> None:
    raise ErrorAplicacion(
        501,
        "El registro de ubicaciones se implementará cuando el diccionario de datos esté aprobado.",
        "modulo_pendiente",
    )
