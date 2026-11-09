"""Límites provinciales y provincias con agencia."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.modelos import Usuario
from app.modulos.cobertura import servicio

router = APIRouter(prefix="/api/cobertura", tags=["cobertura"])


class CambioCobertura(BaseModel):
    model_config = ConfigDict(extra="forbid")
    activa: bool


@router.get("/provincias")
def provincias(
    contorno: bool = True,
    _: Usuario = Depends(exige("mapas.ver")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.listar(db, con_contorno=contorno)


@router.patch("/provincias/{codigo}")
def actualizar(
    codigo: str,
    datos: CambioCobertura,
    actor: Usuario = Depends(exige("parametros.editar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.actualizar(db, actor, codigo, datos.activa)
