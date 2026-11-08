"""Parámetros de negocio. Los secretos de despliegue no pasan por aquí."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.modelos import Usuario
from app.modulos.admin import servicio

router = APIRouter(prefix="/api/admin", tags=["administración"])


class CambioParametro(BaseModel):
    model_config = ConfigDict(extra="forbid")
    valor: object


@router.get("/parametros")
def listar(
    _: Usuario = Depends(exige("parametros.leer")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.listar(db)


@router.get("/perfil-hash")
def perfil_hash(_: Usuario = Depends(exige("parametros.leer"))) -> dict:
    return servicio.perfil_hash()


@router.patch("/parametros/{clave}")
def actualizar(
    clave: str,
    datos: CambioParametro,
    actor: Usuario = Depends(exige("parametros.editar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.actualizar(db, actor, clave, datos.valor)
