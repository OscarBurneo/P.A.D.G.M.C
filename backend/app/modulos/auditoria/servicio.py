"""Registro de eventos. La aplicación solo inserta; no actualiza ni borra."""

import uuid
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.correlacion import obtener_correlacion
from app.modelos import EventoAuditoria

CLAVES_SECRETAS = ("contrasena", "password", "secreto", "secret", "token", "cookie", "hash")


def sanear(datos: dict[str, Any] | None) -> dict[str, Any] | None:
    if datos is None:
        return None
    limpio: dict[str, Any] = {}
    for clave, valor in datos.items():
        nombre = clave.casefold()
        if any(fragmento in nombre for fragmento in CLAVES_SECRETAS):
            continue
        if isinstance(valor, dict):
            anidado = sanear(valor)
            if anidado:
                limpio[clave] = anidado
            continue
        limpio[clave] = valor
    return limpio


def registrar(
    db: Session,
    *,
    actor_tipo: str,
    actor_etiqueta: str,
    operacion: str,
    entidad_tipo: str,
    resultado: str,
    actor_id: uuid.UUID | None = None,
    entidad_id: str | None = None,
    codigo_error: str | None = None,
    antes: dict[str, Any] | None = None,
    despues: dict[str, Any] | None = None,
    mensaje: str | None = None,
) -> EventoAuditoria:
    etiqueta = actor_etiqueta.strip()
    if not etiqueta:
        raise RuntimeError("El evento de auditoría exige un actor identificado.")
    if resultado not in {"exito", "fallo"}:
        raise RuntimeError("El resultado de auditoría debe ser exito o fallo.")
    if actor_tipo not in {"usuario", "servicio", "solicitud"}:
        raise RuntimeError("Tipo de actor de auditoría no reconocido.")
    evento = EventoAuditoria(
        actor_tipo=actor_tipo,
        actor_id=actor_id,
        actor_etiqueta=etiqueta[:120],
        operacion=operacion,
        entidad_tipo=entidad_tipo,
        entidad_id=entidad_id,
        resultado=resultado,
        codigo_error=codigo_error,
        correlacion_id=uuid.UUID(obtener_correlacion()),
        antes=sanear(antes),
        despues=sanear(despues),
        mensaje=None if mensaje is None else mensaje[:400],
    )
    db.add(evento)
    db.flush()
    return evento


def consulta(
    *,
    actor: str | None = None,
    operacion: str | None = None,
    entidad: str | None = None,
    resultado: str | None = None,
    desde: object | None = None,
    hasta: object | None = None,
) -> Select[tuple[EventoAuditoria]]:
    sentencia = select(EventoAuditoria).order_by(EventoAuditoria.fecha.desc())
    if actor:
        sentencia = sentencia.where(EventoAuditoria.actor_etiqueta.ilike(f"%{actor.strip()}%"))
    if operacion:
        sentencia = sentencia.where(EventoAuditoria.operacion == operacion.strip())
    if entidad:
        sentencia = sentencia.where(EventoAuditoria.entidad_tipo == entidad.strip())
    if resultado:
        sentencia = sentencia.where(EventoAuditoria.resultado == resultado.strip())
    if desde is not None:
        sentencia = sentencia.where(EventoAuditoria.fecha >= desde)
    if hasta is not None:
        sentencia = sentencia.where(EventoAuditoria.fecha <= hasta)
    return sentencia
