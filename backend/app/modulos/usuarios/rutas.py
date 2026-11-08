"""Rutas de cuentas. La desactivación es una operación aparte de la edición."""

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.modelos import Usuario
from app.modulos.usuarios import servicio

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


class CuentaNueva(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    identificador: str = Field(min_length=3, max_length=80)
    correo: EmailStr
    nombre: str = Field(min_length=2, max_length=120)
    contrasena: str = Field(min_length=1, max_length=200)
    rol_codigo: str = Field(min_length=2, max_length=40)


class CuentaEdicion(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    nombre: str | None = Field(default=None, min_length=2, max_length=120)
    correo: EmailStr | None = None
    contrasena: str | None = Field(default=None, min_length=1, max_length=200)


@router.get("")
def listar(
    q: str | None = None,
    limite: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: Usuario = Depends(exige("usuarios.leer")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.listar(db, q, limite, offset)


@router.post("", status_code=201)
def crear(
    datos: CuentaNueva,
    actor: Usuario = Depends(exige("usuarios.crear")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.crear(
        db,
        actor,
        identificador=datos.identificador,
        correo=str(datos.correo),
        nombre=datos.nombre,
        contrasena=datos.contrasena,
        rol_codigo=datos.rol_codigo,
    )


@router.get("/{cuenta_id}")
def detalle(
    cuenta_id: uuid.UUID,
    _: Usuario = Depends(exige("usuarios.leer")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.obtener(db, cuenta_id)


@router.patch("/{cuenta_id}")
def editar(
    cuenta_id: uuid.UUID,
    datos: CuentaEdicion,
    actor: Usuario = Depends(exige("usuarios.editar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.editar(
        db,
        actor,
        cuenta_id,
        nombre=datos.nombre,
        correo=str(datos.correo) if datos.correo else None,
        contrasena=datos.contrasena,
    )


@router.post("/{cuenta_id}/desactivar")
def desactivar(
    cuenta_id: uuid.UUID,
    actor: Usuario = Depends(exige("usuarios.desactivar")),
    db: Session = Depends(obtener_db),
) -> dict:
    return servicio.desactivar(db, actor, cuenta_id)
