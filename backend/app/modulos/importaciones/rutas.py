"""Carga, historial, publicación, cancelación y retiro."""

import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.errores import ErrorAplicacion
from app.modelos import Usuario
from app.modulos.importaciones import servicio

router = APIRouter(prefix="/api/importaciones", tags=["importaciones"])


class MapeoEntrada(BaseModel):
    mapeo: dict[str, str | None]


class RetiroEntrada(BaseModel):
    motivo: str = Field(default="", max_length=200)


@router.get("")
def listar(
    actor: str | None = None,
    estado: str | None = None,
    texto: str | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    _: Usuario = Depends(exige("importaciones.cargar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.listar(db, actor=actor, estado=estado, texto=texto, desde=desde, hasta=hasta)


@router.post("")
def cargar(
    archivo: UploadFile = File(...),
    mapeo: str | None = Form(default=None),
    usuario: Usuario = Depends(exige("importaciones.cargar")),
    db: Session = Depends(obtener_db),
) -> dict:
    contenido = archivo.file.read()
    return servicio.recibir(db, usuario, archivo.filename or "archivo.csv", contenido, _mapeo(mapeo))


@router.get("/{lote_id}")
def consultar(
    lote_id: uuid.UUID,
    _: Usuario = Depends(exige("importaciones.cargar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.detalle(db, lote_id)


@router.patch("/{lote_id}/mapeo")
def mapear(
    lote_id: uuid.UUID,
    entrada: MapeoEntrada,
    usuario: Usuario = Depends(exige("importaciones.cargar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.revalidar(db, usuario, lote_id, entrada.mapeo)


@router.post("/{lote_id}/publicar")
def publicar(
    lote_id: uuid.UUID,
    usuario: Usuario = Depends(exige("importaciones.publicar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.publicar(db, usuario, lote_id)


@router.post("/{lote_id}/cancelar")
def cancelar(
    lote_id: uuid.UUID,
    usuario: Usuario = Depends(exige("importaciones.cargar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.cancelar(db, usuario, lote_id)


@router.post("/{lote_id}/retirar")
def retirar(
    lote_id: uuid.UUID,
    entrada: RetiroEntrada | None = None,
    usuario: Usuario = Depends(exige("importaciones.retirar")),
    db: Session = Depends(obtener_db),
) -> dict:
    motivo = entrada.motivo if entrada else ""
    return servicio.retirar(db, usuario, lote_id, motivo)


def _mapeo(texto: str | None) -> dict | None:
    if texto is None or not texto.strip():
        return None
    try:
        valor = json.loads(texto)
    except json.JSONDecodeError as exc:
        raise ErrorAplicacion(422, "El mapeo no es un JSON válido.", "mapeo_invalido") from exc
    if not isinstance(valor, dict):
        raise ErrorAplicacion(422, "El mapeo debe ser un objeto de columnas.", "mapeo_invalido")
    return valor
