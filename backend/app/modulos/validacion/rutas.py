"""Informe de encabezados, estructura y clasificación. Sustituye el 501 del Sprint 0."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.modelos import Usuario
from app.modulos.importaciones import servicio

router = APIRouter(prefix="/api/validacion", tags=["validación"])


@router.get("")
def consultar(
    _: Usuario = Depends(exige("validacion.consultar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.informes(db)


@router.get("/{lote_id}")
def consultar_lote(
    lote_id: uuid.UUID,
    _: Usuario = Depends(exige("validacion.consultar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.informe_de_lote(db, lote_id)
