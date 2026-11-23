"""Fecha de actualización del lote de importación.

Revision ID: 0004_lote_actualizado_en
Revises: 0003_importacion
Create Date: 2026-11-23

El historial ya exponía actualizado_en, pero copiaba la fecha de alta.
Esta columna se mueve cuando el lote se revalida, publica, cancela o retira.
"""

import sqlalchemy as sa

from alembic import op

revision = "0004_lote_actualizado_en"
down_revision = "0003_importacion"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lotes_importacion",
        sa.Column("actualizado_en", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE lotes_importacion SET actualizado_en = fecha WHERE actualizado_en IS NULL")
    op.alter_column("lotes_importacion", "actualizado_en", nullable=False)
    op.create_index("ix_lotes_importacion_actualizado_en", "lotes_importacion", ["actualizado_en"])


def downgrade() -> None:
    op.drop_index("ix_lotes_importacion_actualizado_en", table_name="lotes_importacion")
    op.drop_column("lotes_importacion", "actualizado_en")
