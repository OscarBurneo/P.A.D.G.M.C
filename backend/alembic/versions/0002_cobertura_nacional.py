"""Límites provinciales de Ecuador y cobertura configurable.

Revision ID: 0002_cobertura_nacional
Revises: 0001_esquema_inicial
Create Date: 2026-11-08

La geometría es MultiPolygon en EPSG:4326. La carga del GeoJSON
(geoBoundaries gbOpen, licencia CC0) ocurre en la semilla, no aquí.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0002_cobertura_nacional"
down_revision = "0001_esquema_inicial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "limites_provinciales",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(80), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("nombre_clave", sa.String(120), nullable=False),
        sa.Column("codigo_iso", sa.String(16), nullable=True),
        sa.Column("es_galapagos", sa.Boolean, nullable=False),
        sa.UniqueConstraint("codigo", name="uq_limites_codigo"),
        sa.UniqueConstraint("nombre_clave", name="uq_limites_nombre_clave"),
    )
    op.execute("ALTER TABLE limites_provinciales ADD COLUMN geometria geometry(MultiPolygon, 4326) NOT NULL")
    op.execute("CREATE INDEX ix_limites_provinciales_geometria ON limites_provinciales USING GIST (geometria)")
    op.create_table(
        "cobertura_provincial",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("limite_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("codigo", sa.String(48), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("nota", sa.String(300), nullable=True),
        sa.Column("activa", sa.Boolean, nullable=False),
        sa.Column("orden", sa.Integer, nullable=False),
        sa.ForeignKeyConstraint(["limite_id"], ["limites_provinciales.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("codigo", name="uq_cobertura_codigo"),
        sa.UniqueConstraint("limite_id", name="uq_cobertura_limite"),
    )


def downgrade() -> None:
    op.drop_table("cobertura_provincial")
    op.execute("DROP INDEX IF EXISTS ix_limites_provinciales_geometria")
    op.drop_table("limites_provinciales")
