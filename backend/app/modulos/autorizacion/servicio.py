"""Cambios de rol y de permisos. El efecto se lee en la siguiente solicitud."""

import uuid

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.catalogo import (
    ESTADO_PENDIENTE,
    PERMISOS_IRREVOCABLES_ADMINISTRADOR,
    PERMISOS_OBLIGATORIOS_EN_TODO_ROL,
)
from app.errores import ErrorAplicacion
from app.modelos import MatrizAcceso, Permiso, Rol, Usuario
from app.modulos.auditoria.servicio import registrar
from app.modulos.auth.servicio import a_publico, ahora_utc
from app.politica_cuentas import es_ultimo_administrador_activo, proteccion_activa


def listar_roles(db: Session) -> dict:
    roles = db.scalars(select(Rol).options(selectinload(Rol.permisos)).order_by(Rol.codigo)).all()
    return {
        "estado_aprobacion": ESTADO_PENDIENTE,
        "pendiente": "P-09",
        "matriz": _vigente(db),
        "roles": [_rol(rol) for rol in roles],
        "nota": "Propuesta MVP: permisos por rol, sin excepciones por cuenta.",
    }


def listar_permisos(db: Session) -> dict:
    permisos = db.scalars(select(Permiso).order_by(Permiso.modulo, Permiso.codigo)).all()
    return {
        "estado_aprobacion": ESTADO_PENDIENTE,
        "pendiente": "P-02",
        "matriz": _vigente(db),
        "permisos": [
            {
                "codigo": permiso.codigo,
                "nombre": permiso.nombre,
                "descripcion": permiso.descripcion,
                "modulo": permiso.modulo,
            }
            for permiso in permisos
        ],
    }


def cambiar_rol(db: Session, actor: Usuario, cuenta_id: uuid.UUID, rol_codigo: str) -> dict:
    actor_id, actor_etiqueta = actor.id, actor.identificador
    cuenta = db.scalar(select(Usuario).options(selectinload(Usuario.rol)).where(Usuario.id == cuenta_id))
    if cuenta is None:
        raise ErrorAplicacion(404, "La cuenta no existe.", "cuenta_inexistente")
    rol = db.scalar(select(Rol).where(Rol.codigo == rol_codigo.strip().casefold()))
    if rol is None:
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            str(cuenta.id),
            "rol_inexistente",
            "El rol no está en el catálogo.",
            antes={"rol": cuenta.rol.codigo},
        )
    if cuenta.rol_id == rol.id:
        return a_publico(cuenta, incluir_permisos=False)
    if proteccion_activa(db) and es_ultimo_administrador_activo(db, cuenta) and rol.codigo != "administrador":
        _fallo(
            db,
            actor_id,
            actor_etiqueta,
            str(cuenta.id),
            "ultima_cuenta_administradora",
            "No se puede cambiar el rol de la última cuenta administradora activa.",
            antes={"rol": cuenta.rol.codigo},
            despues={"rol": cuenta.rol.codigo},
            estado=409,
        )
    anterior = cuenta.rol.codigo
    cuenta.rol_id = rol.id
    cuenta.rol = rol
    cuenta.actualizado_en = ahora_utc()
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=actor_id,
        actor_etiqueta=actor_etiqueta,
        operacion="roles.asignar",
        entidad_tipo="cuenta",
        entidad_id=str(cuenta.id),
        resultado="exito",
        antes={"rol": anterior},
        despues={"rol": rol.codigo},
        mensaje="Rol actualizado. El cambio aplica en la siguiente solicitud.",
    )
    db.commit()
    return a_publico(cuenta, incluir_permisos=False)


def reemplazar_permisos(db: Session, actor: Usuario, rol_codigo: str, codigos: list[str]) -> dict:
    actor_id, actor_etiqueta = actor.id, actor.identificador
    rol = db.scalar(select(Rol).options(selectinload(Rol.permisos)).where(Rol.codigo == rol_codigo.strip().casefold()))
    if rol is None:
        raise ErrorAplicacion(404, "El rol no existe.", "rol_inexistente")
    unicos: list[str] = []
    vistos: set[str] = set()
    for codigo in codigos:
        limpio = codigo.strip()
        if limpio and limpio not in vistos:
            vistos.add(limpio)
            unicos.append(limpio)
    conocidos = set(db.scalars(select(Permiso.codigo)).all())
    if any(codigo not in conocidos for codigo in unicos):
        _fallo_permiso(
            db,
            actor_id,
            actor_etiqueta,
            rol.codigo,
            "permiso_desconocido",
            "Hay permisos que no están en el catálogo.",
            antes={"permisos": sorted(permiso.codigo for permiso in rol.permisos)},
            despues={"permisos": sorted(unicos)},
        )
    if not PERMISOS_OBLIGATORIOS_EN_TODO_ROL.issubset(unicos):
        _fallo_permiso(
            db,
            actor_id,
            actor_etiqueta,
            rol.codigo,
            "cierre_de_sesion_obligatorio",
            "Toda cuenta debe poder cerrar su propia sesión.",
            antes={"permisos": sorted(permiso.codigo for permiso in rol.permisos)},
            despues={"permisos": sorted(unicos)},
            estado=409,
        )
    if rol.codigo == "administrador" and not PERMISOS_IRREVOCABLES_ADMINISTRADOR.issubset(unicos):
        _fallo_permiso(
            db,
            actor_id,
            actor_etiqueta,
            rol.codigo,
            "permisos_irrevocables",
            "No se pueden retirar los permisos que evitan bloquear la administración.",
            antes={"permisos": sorted(permiso.codigo for permiso in rol.permisos)},
            despues={"permisos": sorted(unicos)},
            estado=409,
        )
    antes = sorted(permiso.codigo for permiso in rol.permisos)
    despues = sorted(unicos)
    if antes == despues:
        return {"rol": _rol(rol), "sin_cambios": True, "matriz": _vigente(db)}
    nuevos = list(db.scalars(select(Permiso).where(Permiso.codigo.in_(despues))).all())
    rol.permisos = nuevos
    db.flush()
    version = _publicar(db)
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=actor_id,
        actor_etiqueta=actor_etiqueta,
        operacion="permisos.editar",
        entidad_tipo="rol",
        entidad_id=rol.codigo,
        resultado="exito",
        antes={"permisos": antes},
        despues={"permisos": despues, "version_matriz": version},
        mensaje="Permisos actualizados. El cambio aplica en la siguiente solicitud.",
    )
    db.commit()
    db.refresh(rol)
    return {"rol": _rol(rol), "sin_cambios": False, "matriz": _vigente(db)}


def _publicar(db: Session) -> str:
    db.execute(update(MatrizAcceso).values(vigente=False))
    total = db.scalar(select(func_count()))
    version = f"0.1.{int(total or 0)}-propuesta"
    db.add(
        MatrizAcceso(
            version=version,
            vigente=True,
            estado_aprobacion=ESTADO_PENDIENTE,
            descripcion="Cambio de permisos por rol. Pendiente de aprobación.",
            contenido=_contenido(db),
            creada_en=ahora_utc(),
        )
    )
    db.flush()
    return version


def func_count():
    from sqlalchemy import func

    return func.count(MatrizAcceso.id)


def _contenido(db: Session) -> dict:
    roles = db.scalars(select(Rol).options(selectinload(Rol.permisos))).all()
    return {
        "roles": {rol.codigo: sorted(permiso.codigo for permiso in rol.permisos) for rol in roles},
        "excepciones_por_cuenta": False,
    }


def _vigente(db: Session) -> dict | None:
    matriz = db.scalar(select(MatrizAcceso).where(MatrizAcceso.vigente.is_(True)))
    if matriz is None:
        return None
    return {
        "version": matriz.version,
        "estado_aprobacion": matriz.estado_aprobacion,
        "descripcion": matriz.descripcion,
        "contenido": matriz.contenido,
    }


def _rol(rol: Rol) -> dict:
    return {
        "codigo": rol.codigo,
        "nombre": rol.nombre,
        "descripcion": rol.descripcion,
        "permisos": sorted(permiso.codigo for permiso in rol.permisos),
    }


def _fallo(
    db: Session,
    actor_id: uuid.UUID,
    actor_etiqueta: str,
    entidad_id: str,
    codigo: str,
    mensaje: str,
    *,
    antes: dict | None = None,
    despues: dict | None = None,
    estado: int = 422,
) -> None:
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=actor_id,
        actor_etiqueta=actor_etiqueta,
        operacion="roles.asignar",
        entidad_tipo="cuenta",
        entidad_id=entidad_id,
        resultado="fallo",
        codigo_error=codigo,
        antes=antes,
        despues=despues,
        mensaje=mensaje,
    )
    db.commit()
    raise ErrorAplicacion(estado, mensaje, codigo)


def _fallo_permiso(
    db: Session,
    actor_id: uuid.UUID,
    actor_etiqueta: str,
    rol_codigo: str,
    codigo: str,
    mensaje: str,
    *,
    antes: dict | None = None,
    despues: dict | None = None,
    estado: int = 422,
) -> None:
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=actor_id,
        actor_etiqueta=actor_etiqueta,
        operacion="permisos.editar",
        entidad_tipo="rol",
        entidad_id=rol_codigo,
        resultado="fallo",
        codigo_error=codigo,
        antes=antes,
        despues=despues,
        mensaje=mensaje,
    )
    db.commit()
    raise ErrorAplicacion(estado, mensaje, codigo)
