"""Esquema inicial del Sprint 0: cuentas, sesiones, RBAC, auditoría y PostGIS.

Revision ID: 0001_esquema_inicial
Revises:
Create Date: 2026-11-07
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001_esquema_inicial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(40), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("descripcion", sa.String(500), nullable=False),
        sa.UniqueConstraint("codigo", name="uq_roles_codigo"),
    )
    op.create_table(
        "permisos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(80), nullable=False),
        sa.Column("nombre", sa.String(160), nullable=False),
        sa.Column("descripcion", sa.String(500), nullable=False),
        sa.Column("modulo", sa.String(40), nullable=False),
        sa.UniqueConstraint("codigo", name="uq_permisos_codigo"),
    )
    op.create_table(
        "rol_permiso",
        sa.Column("rol_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permiso_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["rol_id"], ["roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["permiso_id"], ["permisos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("rol_id", "permiso_id"),
        sa.UniqueConstraint("rol_id", "permiso_id", name="uq_rol_permiso"),
    )
    op.create_table(
        "usuarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("identificador", sa.String(80), nullable=False),
        sa.Column("correo", sa.String(254), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("hash_contrasena", sa.String(300), nullable=False),
        sa.Column("rol_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["rol_id"], ["roles.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("identificador", name="uq_usuarios_identificador"),
        sa.UniqueConstraint("correo", name="uq_usuarios_correo"),
    )
    op.create_index("ix_usuarios_rol_id", "usuarios", ["rol_id"])
    op.create_table(
        "sesiones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hash_token", sa.String(64), nullable=False),
        sa.Column("creada_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expira_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ultimo_uso_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revocada_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("motivo_revocacion", sa.String(40), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("hash_token", name="uq_sesiones_hash_token"),
    )
    op.create_index("ix_sesiones_usuario_id", "sesiones", ["usuario_id"])
    op.create_table(
        "eventos_auditoria",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_tipo", sa.String(20), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_etiqueta", sa.String(120), nullable=False),
        sa.Column("operacion", sa.String(80), nullable=False),
        sa.Column("entidad_tipo", sa.String(40), nullable=False),
        sa.Column("entidad_id", sa.String(80), nullable=True),
        sa.Column("resultado", sa.String(10), nullable=False),
        sa.Column("codigo_error", sa.String(60), nullable=True),
        sa.Column("correlacion_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("antes", postgresql.JSONB, nullable=True),
        sa.Column("despues", postgresql.JSONB, nullable=True),
        sa.Column("mensaje", sa.String(400), nullable=True),
        sa.CheckConstraint("actor_etiqueta <> ''", name="ck_auditoria_actor"),
        sa.CheckConstraint("resultado IN ('exito', 'fallo')", name="ck_auditoria_resultado"),
        sa.CheckConstraint(
            "actor_tipo IN ('usuario', 'servicio', 'solicitud')",
            name="ck_auditoria_actor_tipo",
        ),
    )
    op.create_index("ix_eventos_auditoria_fecha", "eventos_auditoria", ["fecha"])
    op.create_index("ix_eventos_auditoria_actor_etiqueta", "eventos_auditoria", ["actor_etiqueta"])
    op.create_index("ix_eventos_auditoria_operacion", "eventos_auditoria", ["operacion"])
    op.create_index("ix_eventos_auditoria_resultado", "eventos_auditoria", ["resultado"])
    op.create_table(
        "parametros",
        sa.Column("clave", sa.String(80), primary_key=True),
        sa.Column("valor", postgresql.JSONB, nullable=False),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "matrices_acceso",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("version", sa.String(40), nullable=False),
        sa.Column("vigente", sa.Boolean, nullable=False),
        sa.Column("estado_aprobacion", sa.String(40), nullable=False),
        sa.Column("descripcion", sa.Text, nullable=False),
        sa.Column("contenido", postgresql.JSONB, nullable=False),
        sa.Column("creada_en", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("version", name="uq_matrices_version"),
    )
    op.execute(
        """
        CREATE TABLE ubicaciones (
            id UUID PRIMARY KEY,
            geom geometry(Point, 4326) NOT NULL,
            creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION impedir_cambio_auditoria()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            RAISE EXCEPTION 'Los eventos de auditoría son append-only'
                USING ERRCODE = '42501';
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER auditoria_append_only
        BEFORE UPDATE OR DELETE ON eventos_auditoria
        FOR EACH ROW
        EXECUTE FUNCTION impedir_cambio_auditoria()
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION impedir_truncate_auditoria()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            RAISE EXCEPTION 'Los eventos de auditoría son append-only'
                USING ERRCODE = '42501';
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER auditoria_no_truncate
        BEFORE TRUNCATE ON eventos_auditoria
        FOR EACH STATEMENT
        EXECUTE FUNCTION impedir_truncate_auditoria()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS auditoria_no_truncate ON eventos_auditoria")
    op.execute("DROP TRIGGER IF EXISTS auditoria_append_only ON eventos_auditoria")
    op.execute("DROP FUNCTION IF EXISTS impedir_truncate_auditoria()")
    op.execute("DROP FUNCTION IF EXISTS impedir_cambio_auditoria()")
    op.execute("DROP TABLE IF EXISTS ubicaciones")
    op.drop_table("sesiones")
    op.drop_table("eventos_auditoria")
    op.drop_table("usuarios")
    op.drop_table("rol_permiso")
    op.drop_table("matrices_acceso")
    op.drop_table("parametros")
    op.drop_table("permisos")
    op.drop_table("roles")
