"""Consulta de auditoría. No hay rutas de edición ni borrado."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.modelos import EventoAuditoria, Usuario
from app.modulos.auditoria.servicio import consulta

router = APIRouter(prefix="/api/auditoria", tags=["auditoría"])


def _evento(evento: EventoAuditoria) -> dict:
    return {
        "id": evento.id,
        "fecha": evento.fecha,
        "actor_tipo": evento.actor_tipo,
        "actor_id": evento.actor_id,
        "actor_etiqueta": evento.actor_etiqueta,
        "operacion": evento.operacion,
        "entidad_tipo": evento.entidad_tipo,
        "entidad_id": evento.entidad_id,
        "resultado": evento.resultado,
        "codigo_error": evento.codigo_error,
        "correlacion_id": evento.correlacion_id,
        "antes": evento.antes,
        "despues": evento.despues,
        "mensaje": evento.mensaje,
    }


@router.get("")
def listar(
    actor: str | None = None,
    operacion: str | None = None,
    entidad: str | None = None,
    resultado: str | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    limite: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: Usuario = Depends(exige("auditoria.leer")),
    db: Session = Depends(obtener_db),
) -> dict:
    sentencia = consulta(
        actor=actor,
        operacion=operacion,
        entidad=entidad,
        resultado=resultado,
        desde=desde,
        hasta=hasta,
    )
    total = db.scalar(select(func.count()).select_from(sentencia.order_by(None).subquery()))
    eventos = db.scalars(sentencia.limit(limite).offset(offset)).all()
    return {
        "total": total,
        "eventos": [_evento(evento) for evento in eventos],
        "aviso": "Los eventos son append-only. La aplicación no puede modificarlos ni borrarlos.",
    }


@router.get("/{evento_id}")
def detalle(
    evento_id: uuid.UUID,
    _: Usuario = Depends(exige("auditoria.leer")),
    db: Session = Depends(obtener_db),
) -> dict:
    evento = db.get(EventoAuditoria, evento_id)
    if evento is None:
        from app.errores import ErrorAplicacion

        raise ErrorAplicacion(404, "El evento no existe.", "evento_inexistente")
    return _evento(evento)
