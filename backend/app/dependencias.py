"""Dependencias de sesión de base y de autorización por solicitud."""

from collections.abc import Iterator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.base_datos import SesionLocal
from app.errores import ErrorAplicacion
from app.modelos import Usuario
from app.modulos.auditoria.servicio import registrar
from app.modulos.auth.servicio import resolver_sesion
from app.textos import MENSAJE_PERMISO, MENSAJE_SESION


def obtener_db() -> Iterator[Session]:
    db = SesionLocal()
    try:
        yield db
    finally:
        db.close()


def usuario_actual(request: Request, db: Session = Depends(obtener_db)) -> Usuario:
    token = request.cookies.get(_nombre_cookie())
    usuario = resolver_sesion(db, token, tocar=True)
    if usuario is None:
        raise ErrorAplicacion(401, MENSAJE_SESION, "sesion_invalida")
    return usuario


def exige(*codigos: str):
    """Comprueba permisos en el servidor en cada solicitud."""

    def dependencia(
        request: Request,
        usuario: Usuario = Depends(usuario_actual),
        db: Session = Depends(obtener_db),
    ) -> Usuario:
        disponibles = {permiso.codigo for permiso in usuario.rol.permisos}
        if not set(codigos).issubset(disponibles):
            registrar(
                db,
                actor_tipo="usuario",
                actor_id=usuario.id,
                actor_etiqueta=usuario.identificador,
                operacion="autorizacion.denegar",
                entidad_tipo="permiso",
                entidad_id=",".join(codigos),
                resultado="fallo",
                codigo_error="permiso_denegado",
                despues={"ruta": request.url.path, "metodo": request.method},
                mensaje="Solicitud denegada por la matriz de permisos.",
            )
            db.commit()
            raise ErrorAplicacion(403, MENSAJE_PERMISO, "permiso_denegado")
        return usuario

    return dependencia


def _nombre_cookie() -> str:
    from app.configuracion import ajustes

    return ajustes.cookie_nombre
