"""Lotes de importación, validación y el índice provincial mínimo.

Revision ID: 0003_importacion
Revises: 0002_cobertura_nacional
Create Date: 2026-11-15

El archivo en disco no es una columna: el diagrama guarda el resumen
criptográfico y RF-05-2 pide conservar el archivo al retirar el lote.
Los tipos marcados «Por definir» en el diagrama se guardan como texto o
JSON para poder versionar el contrato sin otra migración.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0003_importacion"
down_revision = "0002_cobertura_nacional"
branch_labels = None
depends_on = None

_PERMISOS_NUEVOS = (
    (
        "importaciones.publicar",
        "Publicar importaciones",
        "importaciones",
        "Confirma un lote pendiente y publica sus filas aceptadas y observadas en una sola transacción.",
    ),
    (
        "importaciones.retirar",
        "Retirar importaciones",
        "importaciones",
        "Retira un lote publicado del análisis sin borrar el archivo.",
    ),
)


def upgrade() -> None:
    op.create_table(
        "lotes_importacion",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nombre_archivo", sa.String(240), nullable=False),
        sa.Column("formato", sa.String(8), nullable=False),
        sa.Column("estado", sa.String(40), nullable=False),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("resumen_criptografico", sa.String(64), nullable=False),
        sa.Column("contrato_version", sa.String(40), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "estado IN ('pendiente', 'ejecutandose', 'completado', 'finalizado_con_errores', 'cancelado', 'retirado')",
            name="ck_lotes_estado",
        ),
    )
    op.create_index("ix_lotes_importacion_estado", "lotes_importacion", ["estado"])
    op.create_index("ix_lotes_importacion_fecha", "lotes_importacion", ["fecha"])
    op.create_index("ix_lotes_importacion_resumen", "lotes_importacion", ["resumen_criptografico"])
    op.add_column("ubicaciones", sa.Column("lote_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("ubicaciones", sa.Column("atributos_socio", postgresql.JSONB, nullable=True))
    op.create_foreign_key(
        "fk_ubicaciones_lote",
        "ubicaciones",
        "lotes_importacion",
        ["lote_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_ubicaciones_lote_id", "ubicaciones", ["lote_id"])
    op.execute("CREATE INDEX IF NOT EXISTS ix_ubicaciones_geom ON ubicaciones USING GIST (geom)")
    op.create_table(
        "intentos_carga",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lote_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False),
        sa.Column("nombre_archivo", sa.String(240), nullable=False),
        sa.Column("resumen_criptografico", sa.String(64), nullable=False),
        sa.Column("estado", sa.String(40), nullable=False),
        sa.Column("resultado", sa.String(40), nullable=False),
        sa.ForeignKeyConstraint(["lote_id"], ["lotes_importacion.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["usuarios.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_intentos_carga_lote", "intentos_carga", ["lote_id"])
    op.create_table(
        "informes_validacion",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lote_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("total_procesadas", sa.Integer, nullable=False),
        sa.Column("total_aceptadas", sa.Integer, nullable=False),
        sa.Column("total_observadas", sa.Integer, nullable=False),
        sa.Column("observaciones", postgresql.JSONB, nullable=True),
        sa.ForeignKeyConstraint(["lote_id"], ["lotes_importacion.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("lote_id", name="uq_informes_lote"),
    )
    op.create_table(
        "catalogos_proceso",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(40), nullable=False),
        sa.Column("nombre", sa.String(160), nullable=False),
        sa.Column("version", sa.String(40), nullable=False),
        sa.Column("habilitado", sa.Boolean, nullable=False),
        sa.Column("entradas", postgresql.JSONB, nullable=False),
        sa.UniqueConstraint("codigo", name="uq_catalogos_proceso_codigo"),
    )
    op.create_table(
        "ejecuciones_analisis",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("proceso_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False),
        sa.Column("estado", sa.String(40), nullable=False),
        sa.Column("version_datos", sa.String(120), nullable=False),
        sa.Column("version_configuracion", sa.String(40), nullable=False),
        sa.Column("version_catalogo", sa.String(40), nullable=False),
        sa.Column("version_capa_territorial", sa.String(80), nullable=False),
        sa.Column("parametros", postgresql.JSONB, nullable=False),
        sa.Column("motivo_fallo", sa.String(400), nullable=True),
        sa.ForeignKeyConstraint(["proceso_id"], ["catalogos_proceso.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["actor_id"], ["usuarios.id"], ondelete="RESTRICT"),
    )
    op.create_table(
        "resultados_analisis",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ejecucion_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("indicadores", postgresql.JSONB, nullable=True),
        sa.Column("vigente", sa.Boolean, nullable=False),
        sa.ForeignKeyConstraint(["ejecucion_id"], ["ejecuciones_analisis.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_resultados_ejecucion", "resultados_analisis", ["ejecucion_id"])
    op.create_index("ix_resultados_vigente", "resultados_analisis", ["vigente"])
    op.create_table(
        "zonas_analisis",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("resultado_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("zona", sa.String(80), nullable=False),
        sa.Column("metrica", sa.String(80), nullable=False),
        sa.Column("valor", sa.Numeric(14, 4), nullable=True),
        sa.Column("tipo", sa.String(40), nullable=False),
        sa.ForeignKeyConstraint(["resultado_id"], ["resultados_analisis.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_zonas_resultado", "zonas_analisis", ["resultado_id"])
    _conceder_permisos()


def downgrade() -> None:
    op.execute("DELETE FROM permisos WHERE codigo IN ('importaciones.publicar', 'importaciones.retirar')")
    op.drop_index("ix_zonas_resultado", table_name="zonas_analisis")
    op.drop_table("zonas_analisis")
    op.drop_index("ix_resultados_vigente", table_name="resultados_analisis")
    op.drop_index("ix_resultados_ejecucion", table_name="resultados_analisis")
    op.drop_table("resultados_analisis")
    op.drop_table("ejecuciones_analisis")
    op.drop_table("catalogos_proceso")
    op.drop_table("informes_validacion")
    op.drop_index("ix_intentos_carga_lote", table_name="intentos_carga")
    op.drop_table("intentos_carga")
    op.execute("DROP INDEX IF EXISTS ix_ubicaciones_geom")
    op.drop_index("ix_ubicaciones_lote_id", table_name="ubicaciones")
    op.drop_constraint("fk_ubicaciones_lote", "ubicaciones", type_="foreignkey")
    op.drop_column("ubicaciones", "atributos_socio")
    op.drop_column("ubicaciones", "lote_id")
    op.drop_index("ix_lotes_importacion_resumen", table_name="lotes_importacion")
    op.drop_index("ix_lotes_importacion_fecha", table_name="lotes_importacion")
    op.drop_index("ix_lotes_importacion_estado", table_name="lotes_importacion")
    op.drop_table("lotes_importacion")


def _conceder_permisos() -> None:
    conexion = op.get_bind()
    for codigo, nombre, modulo, descripcion in _PERMISOS_NUEVOS:
        conexion.execute(
            sa.text(
                """
                INSERT INTO permisos (id, codigo, nombre, descripcion, modulo)
                SELECT gen_random_uuid(),
                       CAST(:codigo AS varchar(80)),
                       CAST(:nombre AS varchar(160)),
                       CAST(:descripcion AS varchar(500)),
                       CAST(:modulo AS varchar(40))
                WHERE NOT EXISTS (
                    SELECT 1 FROM permisos WHERE codigo = CAST(:codigo AS varchar(80))
                )
                """
            ),
            {"codigo": codigo, "nombre": nombre, "descripcion": descripcion, "modulo": modulo},
        )
        conexion.execute(
            sa.text(
                """
                INSERT INTO rol_permiso (rol_id, permiso_id)
                SELECT r.id, p.id
                FROM roles r
                JOIN permisos p ON p.codigo = CAST(:codigo AS varchar(80))
                WHERE r.codigo = 'administrador'
                  AND NOT EXISTS (
                    SELECT 1 FROM rol_permiso rp
                    WHERE rp.rol_id = r.id AND rp.permiso_id = p.id
                  )
                """
            ),
            {"codigo": codigo},
        )
