"""Permiso para ver las coordenadas individuales del mapa.

Revision ID: 0005_mapas_ver_puntos
Revises: 0004_lote_actualizado_en
Create Date: 2026-11-28

mapas.ver sigue sirviendo el calor y los agregados. Las coordenadas de cada
registro quedan en mapas.ver_puntos, concedido solo al rol administrador.
"""

import sqlalchemy as sa

from alembic import op

revision = "0005_mapas_ver_puntos"
down_revision = "0004_lote_actualizado_en"
branch_labels = None
depends_on = None

_CODIGO = "mapas.ver_puntos"
_NOMBRE = "Ver puntos del mapa"
_MODULO = "mapas"
_DESCRIPCION = "Consulta las coordenadas de cada registro aceptado, sin nombre ni identificador."


def upgrade() -> None:
    conexion = op.get_bind()
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
        {"codigo": _CODIGO, "nombre": _NOMBRE, "descripcion": _DESCRIPCION, "modulo": _MODULO},
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
        {"codigo": _CODIGO},
    )


def downgrade() -> None:
    op.execute("DELETE FROM permisos WHERE codigo = 'mapas.ver_puntos'")
