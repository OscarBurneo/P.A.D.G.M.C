"""Sesiones en base de datos. El identificador de sesión no se reutiliza tras el cierre."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.configuracion import ajustes
from app.errores import ErrorAplicacion
from app.modelos import Rol, Sesion, Usuario
from app.modulos.auditoria.servicio import registrar
from app.parametros_plataforma import leer_entero
from app.seguridad.contrasenas import verificar
from app.textos import MENSAJE_CREDENCIALES, MENSAJE_HTTPS


def ahora_utc() -> datetime:
    return datetime.now(UTC)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _cargar_usuario(db: Session, identificador: str) -> Usuario | None:
    return db.scalar(
        select(Usuario)
        .options(selectinload(Usuario.rol).selectinload(Rol.permisos))
        .where(Usuario.identificador == identificador.casefold())
    )


def _revocar(sesion: Sesion, motivo: str) -> None:
    if sesion.revocada_en is None:
        sesion.revocada_en = ahora_utc()
        sesion.motivo_revocacion = motivo


def resolver_sesion(db: Session, token: str | None, *, tocar: bool) -> Usuario | None:
    """Devuelve la cuenta si la sesión sigue vigente. Si caducó, la revoca y confirma el cambio."""

    if not token:
        return None
    sesion = db.scalar(
        select(Sesion)
        .options(joinedload(Sesion.usuario).selectinload(Usuario.rol).selectinload(Rol.permisos))
        .where(Sesion.hash_token == hash_token(token))
    )
    if sesion is None or sesion.revocada_en is not None:
        return None
    ahora = ahora_utc()
    if ahora >= sesion.expira_en:
        _revocar(sesion, "expiracion")
        db.commit()
        return None
    limite = timedelta(minutes=leer_entero(db, "sesion_inactividad_minutos"))
    if ahora - sesion.ultimo_uso_en > limite:
        _revocar(sesion, "inactividad")
        db.commit()
        return None
    if not sesion.usuario.activo:
        _revocar(sesion, "cuenta_desactivada")
        db.commit()
        return None
    if tocar:
        sesion.ultimo_uso_en = ahora
        db.commit()
    return sesion.usuario


def iniciar(db: Session, identificador: str, contrasena: str, *, solicitud_https: bool) -> tuple[Usuario, str, int]:
    if ajustes.entorno == "produccion" and not solicitud_https:
        raise ErrorAplicacion(400, MENSAJE_HTTPS, "https_requerido")

    ident = identificador.strip().casefold()
    usuario = _cargar_usuario(db, ident)
    clave_ok = verificar(usuario.hash_contrasena if usuario else None, contrasena)
    if usuario is None or not clave_ok or not usuario.activo:
        if usuario is not None and clave_ok and not usuario.activo:
            codigo = "cuenta_inactiva"
        else:
            codigo = "credenciales_invalidas"
        registrar(
            db,
            actor_tipo="usuario" if usuario is not None else "solicitud",
            actor_id=usuario.id if usuario is not None else None,
            actor_etiqueta=ident or "identificador-vacio",
            operacion="auth.iniciar_sesion",
            entidad_tipo="cuenta",
            entidad_id=str(usuario.id) if usuario is not None else None,
            resultado="fallo",
            codigo_error=codigo,
            mensaje="Intento de acceso rechazado.",
        )
        db.commit()
        raise ErrorAplicacion(401, MENSAJE_CREDENCIALES, "credenciales_invalidas")

    token = secrets.token_urlsafe(32)
    horas = leer_entero(db, "sesion_duracion_maxima_horas")
    ahora = ahora_utc()
    sesion = Sesion(
        usuario_id=usuario.id,
        hash_token=hash_token(token),
        creada_en=ahora,
        expira_en=ahora + timedelta(hours=horas),
        ultimo_uso_en=ahora,
    )
    db.add(sesion)
    db.flush()
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=usuario.id,
        actor_etiqueta=usuario.identificador,
        operacion="auth.iniciar_sesion",
        entidad_tipo="sesion",
        entidad_id=str(sesion.id),
        resultado="exito",
        mensaje="Sesión creada.",
    )
    db.commit()
    return usuario, token, horas * 3600


def cerrar(db: Session, token: str | None) -> None:
    if not token:
        return
    sesion = db.scalar(select(Sesion).options(joinedload(Sesion.usuario)).where(Sesion.hash_token == hash_token(token)))
    if sesion is None or sesion.revocada_en is not None:
        return
    _revocar(sesion, "cierre")
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=sesion.usuario_id,
        actor_etiqueta=sesion.usuario.identificador,
        operacion="auth.cerrar_sesion",
        entidad_tipo="sesion",
        entidad_id=str(sesion.id),
        resultado="exito",
        mensaje="Sesión invalidada.",
    )
    db.commit()


def a_publico(usuario: Usuario, *, incluir_permisos: bool) -> dict:
    datos: dict = {
        "id": usuario.id,
        "identificador": usuario.identificador,
        "nombre": usuario.nombre,
        "correo": usuario.correo,
        "activo": usuario.activo,
        "rol": {"codigo": usuario.rol.codigo, "nombre": usuario.rol.nombre},
        "creado_en": usuario.creado_en,
    }
    if incluir_permisos:
        datos["permisos"] = sorted(permiso.codigo for permiso in usuario.rol.permisos)
    return datos


def solicitud_es_https(scheme: str, encabezado: str | None, confiar_proxy: bool) -> bool:
    if scheme == "https":
        return True
    if not confiar_proxy or not encabezado:
        return False
    return encabezado.split(",")[0].strip().casefold() == "https"


def id_publico(valor: uuid.UUID) -> str:
    return str(valor)
