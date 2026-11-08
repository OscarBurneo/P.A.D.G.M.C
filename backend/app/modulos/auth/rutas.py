"""Inicio y cierre de sesión. La cookie es httpOnly."""

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.configuracion import ajustes
from app.dependencias import obtener_db, usuario_actual
from app.modelos import Usuario
from app.modulos.auth.servicio import (
    a_publico,
    cerrar,
    iniciar,
    solicitud_es_https,
)

router = APIRouter(prefix="/api/auth", tags=["autenticación"])


class Credenciales(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    identificador: str = Field(min_length=1, max_length=80)
    contrasena: str = Field(min_length=1, max_length=200)


def _fijar_cookie(respuesta: Response, token: str, max_age: int) -> None:
    respuesta.set_cookie(
        key=ajustes.cookie_nombre,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=ajustes.cookie_es_segura,
        samesite=ajustes.cookie_samesite,
        path="/",
    )


def _borrar_cookie(respuesta: Response) -> None:
    respuesta.delete_cookie(
        key=ajustes.cookie_nombre,
        path="/",
        httponly=True,
        secure=ajustes.cookie_es_segura,
        samesite=ajustes.cookie_samesite,
    )


@router.post("/iniciar-sesion")
def iniciar_sesion(
    datos: Credenciales,
    request: Request,
    db: Session = Depends(obtener_db),
) -> Response:
    https = solicitud_es_https(
        request.url.scheme,
        request.headers.get("x-forwarded-proto"),
        ajustes.confiar_proxy,
    )
    usuario, token, max_age = iniciar(
        db,
        datos.identificador,
        datos.contrasena,
        solicitud_https=https,
    )
    respuesta = Response(
        content=_cuerpo(a_publico(usuario, incluir_permisos=True)),
        media_type="application/json",
        status_code=200,
    )
    _fijar_cookie(respuesta, token, max_age)
    respuesta.headers["Cache-Control"] = "no-store"
    return respuesta


@router.post("/cerrar-sesion", status_code=204)
def cerrar_sesion(request: Request, db: Session = Depends(obtener_db)) -> Response:
    cerrar(db, request.cookies.get(ajustes.cookie_nombre))
    respuesta = Response(status_code=204)
    _borrar_cookie(respuesta)
    respuesta.headers["Cache-Control"] = "no-store"
    return respuesta


@router.get("/yo")
def yo(usuario: Usuario = Depends(usuario_actual)) -> dict:
    return a_publico(usuario, incluir_permisos=True)


def _cuerpo(datos: dict) -> str:
    import json
    from datetime import datetime
    from uuid import UUID

    def convertir(valor: object) -> object:
        if isinstance(valor, datetime):
            return valor.isoformat()
        if isinstance(valor, UUID):
            return str(valor)
        if isinstance(valor, dict):
            return {clave: convertir(item) for clave, item in valor.items()}
        if isinstance(valor, list):
            return [convertir(item) for item in valor]
        return valor

    return json.dumps(convertir(datos), ensure_ascii=False)
