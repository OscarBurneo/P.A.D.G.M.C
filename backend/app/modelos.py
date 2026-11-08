"""Tablas del Sprint 0."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.base_datos import Base


def _id() -> uuid.UUID:
    return uuid.uuid4()


def _ahora() -> datetime:

    return datetime.now(UTC)


class Rol(Base):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_id)
    codigo: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    permisos: Mapped[list["Permiso"]] = relationship(
        secondary="rol_permiso",
        back_populates="roles",
    )
    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="rol")


class Permiso(Base):
    __tablename__ = "permisos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_id)
    codigo: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    modulo: Mapped[str] = mapped_column(String(40), nullable=False)
    roles: Mapped[list[Rol]] = relationship(secondary="rol_permiso", back_populates="permisos")


class RolPermiso(Base):
    __tablename__ = "rol_permiso"
    __table_args__ = (UniqueConstraint("rol_id", "permiso_id", name="uq_rol_permiso"),)

    rol_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    permiso_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("permisos.id", ondelete="CASCADE"),
        primary_key=True,
    )


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_id)
    identificador: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    correo: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    hash_contrasena: Mapped[str] = mapped_column(String(300), nullable=False)
    rol_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_ahora)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_ahora)
    rol: Mapped[Rol] = relationship(back_populates="usuarios")
    sesiones: Mapped[list["Sesion"]] = relationship(back_populates="usuario")


class Sesion(Base):
    __tablename__ = "sesiones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_id)
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    hash_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_ahora)
    expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ultimo_uso_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revocada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    motivo_revocacion: Mapped[str | None] = mapped_column(String(40), nullable=True)
    usuario: Mapped[Usuario] = relationship(back_populates="sesiones")


class EventoAuditoria(Base):
    __tablename__ = "eventos_auditoria"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_id)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_ahora, index=True)
    actor_tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    actor_etiqueta: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    operacion: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entidad_tipo: Mapped[str] = mapped_column(String(40), nullable=False)
    entidad_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    resultado: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    codigo_error: Mapped[str | None] = mapped_column(String(60), nullable=True)
    correlacion_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    antes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    despues: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    mensaje: Mapped[str | None] = mapped_column(String(400), nullable=True)


class Parametro(Base):
    __tablename__ = "parametros"

    clave: Mapped[str] = mapped_column(String(80), primary_key=True)
    valor: Mapped[dict] = mapped_column(JSONB, nullable=False)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_ahora)


class LimiteProvincial(Base):
    """Contorno ADM1. La geometría se lee y escribe con SQL, no con el ORM."""

    __tablename__ = "limites_provinciales"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_id)
    codigo: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    nombre_clave: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    codigo_iso: Mapped[str | None] = mapped_column(String(16), nullable=True)
    es_galapagos: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class CoberturaProvincial(Base):
    """Provincias donde la cooperativa tiene agencia. Es configuración, no código."""

    __tablename__ = "cobertura_provincial"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_id)
    limite_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("limites_provinciales.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    codigo: Mapped[str] = mapped_column(String(48), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    nota: Mapped[str | None] = mapped_column(String(300), nullable=True)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    orden: Mapped[int] = mapped_column(Integer, nullable=False)


class MatrizAcceso(Base):
    __tablename__ = "matrices_acceso"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_id)
    version: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    vigente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    estado_aprobacion: Mapped[str] = mapped_column(String(40), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    contenido: Mapped[dict] = mapped_column(JSONB, nullable=False)
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_ahora)
