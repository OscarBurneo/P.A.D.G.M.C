"""Identificador de correlación por solicitud."""

import uuid
from contextvars import ContextVar

_correlacion: ContextVar[str] = ContextVar("correlacion", default="")


def fijar_correlacion(valor: str) -> None:
    _correlacion.set(valor)


def obtener_correlacion() -> str:
    actual = _correlacion.get()
    if actual:
        return actual
    nuevo = str(uuid.uuid4())
    _correlacion.set(nuevo)
    return nuevo
