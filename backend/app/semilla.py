"""Datos iniciales: catálogos y la cuenta administradora tomada del entorno."""

import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.catalogo import (
    ESTADO_PENDIENTE,
    MATRIZ_INICIAL,
    PARAMETROS,
    PERMISOS,
    ROLES,
    VERSION_MATRIZ_INICIAL,
)
from app.configuracion import ajustes
from app.modelos import MatrizAcceso, Parametro, Permiso, Rol, RolPermiso, Usuario
from app.modulos.auditoria.servicio import registrar
from app.modulos.auth.servicio import ahora_utc
from app.seguridad.contrasenas import es_marcador, generar_hash, validar_politica

_CORREO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def sembrar(db: Session) -> None:
    permisos = _permisos(db)
    roles = _roles(db)
    _matriz(db, roles, permisos)
    _parametros(db)
    _admin(db, roles["administrador"])
    db.commit()


def _permisos(db: Session) -> dict[str, Permiso]:
    actuales = {permiso.codigo: permiso for permiso in db.scalars(select(Permiso)).all()}
    for codigo, nombre, modulo, descripcion in PERMISOS:
        if codigo not in actuales:
            permiso = Permiso(codigo=codigo, nombre=nombre, descripcion=descripcion, modulo=modulo)
            db.add(permiso)
            actuales[codigo] = permiso
    db.flush()
    return actuales


def _roles(db: Session) -> dict[str, Rol]:
    actuales = {rol.codigo: rol for rol in db.scalars(select(Rol)).all()}
    for codigo, nombre, descripcion in ROLES:
        if codigo not in actuales:
            rol = Rol(codigo=codigo, nombre=nombre, descripcion=descripcion)
            db.add(rol)
            actuales[codigo] = rol
    db.flush()
    return actuales


def _matriz(db: Session, roles: dict[str, Rol], permisos: dict[str, Permiso]) -> None:
    if db.scalar(select(func.count()).select_from(RolPermiso)) == 0:
        for codigo_rol, codigos in MATRIZ_INICIAL.items():
            for codigo in codigos:
                db.add(RolPermiso(rol_id=roles[codigo_rol].id, permiso_id=permisos[codigo].id))
        db.flush()
    if db.scalar(select(func.count()).select_from(MatrizAcceso)) == 0:
        contenido = {
            "roles": {codigo: list(codigos) for codigo, codigos in MATRIZ_INICIAL.items()},
            "excepciones_por_cuenta": False,
        }
        db.add(
            MatrizAcceso(
                version=VERSION_MATRIZ_INICIAL,
                vigente=True,
                estado_aprobacion=ESTADO_PENDIENTE,
                descripcion="Matriz propuesta del Sprint 0. Pendiente de aprobación del cliente.",
                contenido=contenido,
                creada_en=ahora_utc(),
            )
        )
        db.flush()


def _parametros(db: Session) -> None:
    iniciales = {
        "sesion_inactividad_minutos": ajustes.sesion_inactividad_minutos,
        "sesion_duracion_maxima_horas": ajustes.sesion_duracion_maxima_horas,
        "contrasena_longitud_minima": ajustes.contrasena_longitud_minima,
        "proteger_ultima_cuenta_administradora": ajustes.proteger_ultima_cuenta_admin,
    }
    for clave in PARAMETROS:
        if db.get(Parametro, clave) is None:
            db.add(
                Parametro(
                    clave=clave,
                    valor={"dato": iniciales[clave]},
                    actualizado_en=ahora_utc(),
                )
            )
    db.flush()


def _admin(db: Session, rol: Rol) -> None:
    identificador = ajustes.admin_identificador.strip().casefold()
    if db.scalar(select(Usuario.id).where(Usuario.identificador == identificador)):
        return
    if es_marcador(ajustes.admin_contrasena):
        raise RuntimeError(
            "Defina ADMIN_CONTRASENA en el entorno. El valor de ejemplo del repositorio no es una contraseña."
        )
    correo = ajustes.admin_correo.strip().casefold()
    if not _CORREO.fullmatch(correo):
        raise RuntimeError("ADMIN_CORREO no tiene un formato válido.")
    error = validar_politica(
        ajustes.admin_contrasena,
        identificador,
        ajustes.contrasena_longitud_minima,
    )
    if error:
        raise RuntimeError(error)
    cuenta = Usuario(
        identificador=identificador,
        correo=correo,
        nombre=ajustes.admin_nombre.strip(),
        hash_contrasena=generar_hash(ajustes.admin_contrasena),
        rol_id=rol.id,
        activo=True,
    )
    db.add(cuenta)
    db.flush()
    registrar(
        db,
        actor_tipo="servicio",
        actor_etiqueta="sistema:semilla",
        operacion="sistema.sembrar_admin",
        entidad_tipo="cuenta",
        entidad_id=str(cuenta.id),
        resultado="exito",
        despues={
            "identificador": cuenta.identificador,
            "nombre": cuenta.nombre,
            "correo": cuenta.correo,
            "rol": "administrador",
            "activo": True,
        },
        mensaje="Cuenta administradora inicial creada desde el entorno.",
    )
