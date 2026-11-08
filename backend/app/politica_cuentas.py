"""Protección propuesta de la última cuenta administradora (P-09)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modelos import Rol, Usuario
from app.parametros_plataforma import leer_booleano


def proteccion_activa(db: Session) -> bool:
    return leer_booleano(db, "proteger_ultima_cuenta_administradora")


def es_ultimo_administrador_activo(db: Session, usuario: Usuario) -> bool:
    if not usuario.activo or usuario.rol.codigo != "administrador":
        return False
    total = db.scalar(
        select(func.count())
        .select_from(Usuario)
        .join(Rol, Usuario.rol_id == Rol.id)
        .where(Usuario.activo.is_(True), Rol.codigo == "administrador")
    )
    return int(total or 0) <= 1
