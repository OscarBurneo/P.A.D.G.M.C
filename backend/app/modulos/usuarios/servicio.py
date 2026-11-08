"""Alta, edición y desactivación de cuentas."""

import re
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.errores import ErrorAplicacion
from app.modelos import Rol, Sesion, Usuario
from app.modulos.auditoria.servicio import registrar
from app.modulos.auth.servicio import a_publico, ahora_utc
from app.parametros_plataforma import leer_entero
from app.politica_cuentas import es_ultimo_administrador_activo, proteccion_activa
from app.seguridad.contrasenas import generar_hash, validar_politica

_IDENTIFICADOR = re.compile(r"^[a-z0-9._@-]{3,80}$")


def listar(db: Session, texto: str | None, limite: int, offset: int) -> dict:
    sentencia = select(Usuario).options(selectinload(Usuario.rol)).order_by(Usuario.identificador)
    if texto:
        patron = f"%{texto.strip()}%"
        sentencia = sentencia.where(
            or_(
                Usuario.identificador.ilike(patron),
                Usuario.nombre.ilike(patron),
                Usuario.correo.ilike(patron),
            )
        )
    total = db.scalar(select(func.count()).select_from(sentencia.order_by(None).subquery()))
    cuentas = db.scalars(sentencia.limit(limite).offset(offset)).all()
    return {
        "total": int(total or 0),
        "cuentas": [a_publico(cuenta, incluir_permisos=False) for cuenta in cuentas],
        "diccionario": {
            "estado_aprobacion": "pendiente_de_aprobacion",
            "pendiente": "P-09",
            "campos_editables": ["nombre", "correo", "contrasena"],
        },
    }


def obtener(db: Session, cuenta_id: uuid.UUID) -> dict:
    cuenta = _cuenta(db, cuenta_id)
    return a_publico(cuenta, incluir_permisos=False)


def crear(
    db: Session,
    actor: Usuario,
    *,
    identificador: str,
    correo: str,
    nombre: str,
    contrasena: str,
    rol_codigo: str,
) -> dict:
    actor_id, actor_etiqueta = actor.id, actor.identificador
    ident = identificador.strip().casefold()
    mail = correo.strip().casefold()
    nombre_limpio = nombre.strip()
    if not _IDENTIFICADOR.fullmatch(ident):
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            "usuarios.crear",
            "cuenta",
            None,
            "identificador_invalido",
            "El identificador no cumple el formato propuesto.",
        )
    rol = _rol(db, rol_codigo)
    if rol is None:
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            "usuarios.crear",
            "rol",
            rol_codigo,
            "rol_inexistente",
            "El rol no está en el catálogo.",
        )
    minimo = leer_entero(db, "contrasena_longitud_minima")
    error_clave = validar_politica(contrasena, ident, minimo)
    if error_clave:
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            "usuarios.crear",
            "cuenta",
            ident,
            "contrasena_invalida",
            error_clave,
            detalle_publico=error_clave,
        )
    if db.scalar(select(Usuario.id).where(Usuario.identificador == ident)):
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            "usuarios.crear",
            "cuenta",
            ident,
            "identificador_duplicado",
            "El identificador ya está en uso.",
            estado=409,
        )
    if db.scalar(select(Usuario.id).where(Usuario.correo == mail)):
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            "usuarios.crear",
            "cuenta",
            mail,
            "correo_duplicado",
            "El correo ya está en uso.",
            estado=409,
        )
    cuenta = Usuario(
        identificador=ident,
        correo=mail,
        nombre=nombre_limpio,
        hash_contrasena=generar_hash(contrasena),
        rol_id=rol.id,
        activo=True,
    )
    db.add(cuenta)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            "usuarios.crear",
            "cuenta",
            ident,
            "duplicado",
            "El identificador o el correo ya están en uso.",
            estado=409,
        )
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=actor_id,
        actor_etiqueta=actor_etiqueta,
        operacion="usuarios.crear",
        entidad_tipo="cuenta",
        entidad_id=str(cuenta.id),
        resultado="exito",
        despues=_retrato(cuenta, rol.codigo),
        mensaje="Cuenta creada.",
    )
    db.commit()
    db.refresh(cuenta)
    cuenta.rol = rol
    return a_publico(cuenta, incluir_permisos=False)


def editar(
    db: Session,
    actor: Usuario,
    cuenta_id: uuid.UUID,
    *,
    nombre: str | None,
    correo: str | None,
    contrasena: str | None,
) -> dict:
    actor_id, actor_etiqueta = actor.id, actor.identificador
    cuenta = _cuenta(db, cuenta_id)
    if nombre is None and correo is None and contrasena is None:
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            "usuarios.editar",
            "cuenta",
            str(cuenta.id),
            "sin_cambios",
            "No hay campos editables en la solicitud.",
        )
    antes: dict = {}
    despues: dict = {}
    if nombre is not None and nombre.strip() != cuenta.nombre:
        antes["nombre"] = cuenta.nombre
        cuenta.nombre = nombre.strip()
        despues["nombre"] = cuenta.nombre
    if correo is not None:
        mail = correo.strip().casefold()
        if mail != cuenta.correo:
            ocupado = db.scalar(select(Usuario.id).where(Usuario.correo == mail, Usuario.id != cuenta.id))
            if ocupado:
                _fallo(
                    db,
                    actor_id,
                    actor_etiqueta,
                    "usuarios.editar",
                    "cuenta",
                    str(cuenta.id),
                    "correo_duplicado",
                    "El correo ya está en uso.",
                    estado=409,
                )
            antes["correo"] = cuenta.correo
            cuenta.correo = mail
            despues["correo"] = mail
    if contrasena is not None:
        minimo = leer_entero(db, "contrasena_longitud_minima")
        error_clave = validar_politica(contrasena, cuenta.identificador, minimo)
        if error_clave:
            _fallo(
                db,
                actor_id,
                actor_etiqueta,
                "usuarios.editar",
                "cuenta",
                str(cuenta.id),
                "contrasena_invalida",
                error_clave,
                detalle_publico=error_clave,
            )
        cuenta.hash_contrasena = generar_hash(contrasena)
        despues["clave_actualizada"] = True
    if not despues:
        return a_publico(cuenta, incluir_permisos=False)
    cuenta.actualizado_en = ahora_utc()
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=actor_id,
        actor_etiqueta=actor_etiqueta,
        operacion="usuarios.editar",
        entidad_tipo="cuenta",
        entidad_id=str(cuenta.id),
        resultado="exito",
        antes=antes,
        despues=despues,
        mensaje="Cuenta actualizada.",
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            "usuarios.editar",
            "cuenta",
            str(cuenta_id),
            "duplicado",
            "El correo ya está en uso.",
            estado=409,
        )
    return a_publico(cuenta, incluir_permisos=False)


def desactivar(db: Session, actor: Usuario, cuenta_id: uuid.UUID) -> dict:
    actor_id, actor_etiqueta = actor.id, actor.identificador
    cuenta = _cuenta(db, cuenta_id)
    if not cuenta.activo:
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            "usuarios.desactivar",
            "cuenta",
            str(cuenta.id),
            "ya_desactivada",
            "La cuenta ya está desactivada.",
            estado=409,
        )
    if proteccion_activa(db) and es_ultimo_administrador_activo(db, cuenta):
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            "usuarios.desactivar",
            "cuenta",
            str(cuenta.id),
            "ultima_cuenta_administradora",
            "No se puede desactivar la última cuenta administradora activa.",
            estado=409,
            antes={"activo": True, "rol": cuenta.rol.codigo},
            despues={"activo": True, "rol": cuenta.rol.codigo},
        )
    ahora = ahora_utc()
    sesiones = db.scalars(select(Sesion).where(Sesion.usuario_id == cuenta.id, Sesion.revocada_en.is_(None))).all()
    for sesion in sesiones:
        sesion.revocada_en = ahora
        sesion.motivo_revocacion = "cuenta_desactivada"
    cuenta.activo = False
    cuenta.actualizado_en = ahora
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=actor_id,
        actor_etiqueta=actor_etiqueta,
        operacion="usuarios.desactivar",
        entidad_tipo="cuenta",
        entidad_id=str(cuenta.id),
        resultado="exito",
        antes={"activo": True},
        despues={"activo": False, "sesiones_revocadas": len(sesiones)},
        mensaje="Cuenta desactivada y sesiones revocadas.",
    )
    db.commit()
    return a_publico(cuenta, incluir_permisos=False)


def _cuenta(db: Session, cuenta_id: uuid.UUID) -> Usuario:
    cuenta = db.scalar(select(Usuario).options(selectinload(Usuario.rol)).where(Usuario.id == cuenta_id))
    if cuenta is None:
        raise ErrorAplicacion(404, "La cuenta no existe.", "cuenta_inexistente")
    return cuenta


def _rol(db: Session, codigo: str) -> Rol | None:
    return db.scalar(select(Rol).where(Rol.codigo == codigo.strip().casefold()))


def _retrato(cuenta: Usuario, rol_codigo: str) -> dict:
    return {
        "identificador": cuenta.identificador,
        "nombre": cuenta.nombre,
        "correo": cuenta.correo,
        "rol": rol_codigo,
        "activo": cuenta.activo,
    }


def _fallo(
    db: Session,
    actor_id: uuid.UUID,
    actor_etiqueta: str,
    operacion: str,
    entidad_tipo: str,
    entidad_id: str | None,
    codigo: str,
    mensaje: str,
    *,
    estado: int = 422,
    detalle_publico: str | None = None,
    antes: dict | None = None,
    despues: dict | None = None,
) -> None:
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=actor_id,
        actor_etiqueta=actor_etiqueta,
        operacion=operacion,
        entidad_tipo=entidad_tipo,
        entidad_id=entidad_id,
        resultado="fallo",
        codigo_error=codigo,
        antes=antes,
        despues=despues,
        mensaje=mensaje,
    )
    db.commit()
    raise ErrorAplicacion(estado, detalle_publico or mensaje, codigo)
