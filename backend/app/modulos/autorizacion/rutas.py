"""Consulta y cambio de roles y permisos."""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.modelos import Usuario
from app.modulos.autorizacion import servicio

router = APIRouter(tags=["autorización"])


class CambioRol(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    rol_codigo: str = Field(min_length=2, max_length=40)


class CambioPermisos(BaseModel):
    model_config = ConfigDict(extra="forbid")
    permisos: list[str] = Field(min_length=1)


@router.get("/api/roles")
def roles(
    _: Usuario = Depends(exige("roles.leer")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.listar_roles(db)


@router.get("/api/permisos")
def permisos(
    _: Usuario = Depends(exige("permisos.leer")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.listar_permisos(db)


@router.put("/api/usuarios/{cuenta_id}/rol")
def asignar_rol(
    cuenta_id: uuid.UUID,
    datos: CambioRol,
    actor: Usuario = Depends(exige("roles.asignar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.cambiar_rol(db, actor, cuenta_id, datos.rol_codigo)


@router.put("/api/roles/{rol_codigo}/permisos")
def editar_permisos(
    rol_codigo: str,
    datos: CambioPermisos,
    actor: Usuario = Depends(exige("permisos.editar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.reemplazar_permisos(db, actor, rol_codigo, datos.permisos)
