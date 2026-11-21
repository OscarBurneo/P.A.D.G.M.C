"""Resumen territorial y capa de calor agregada.

El resumen no incluye posiciones individuales. La capa de calor usa
centroides de una grilla y vive en otra ruta, fuera de /api/mapas/agregado.
"""

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.modelos import ResultadoAnalisis
from app.modulos.analitica.indice import CONDICION_ACEPTADA, DEFINICION_INDICE

_NOTA_VACIA = (
    "No hay registros publicados. Las provincias salen de la cobertura configurada "
    "y los cantones se mostrarán cuando existan datos agregados."
)
_NOTA_DATOS = (
    "El índice de concentración usa las filas aceptadas de los lotes publicados. "
    "La tendencia queda vacía si no había un resultado anterior."
)


def resumen(db: Session) -> dict:
    cobertura = db.execute(
        text(
            """
            SELECT c.codigo, c.nombre, c.nota
            FROM cobertura_provincial c
            WHERE c.activa
            ORDER BY c.orden, c.nombre
            """
        )
    ).all()
    indicadores = _indicadores(db)
    snapshot = [item for item in indicadores.get("provincias") or [] if isinstance(item, dict)]
    por_codigo = {str(item.get("codigo")): item for item in snapshot}
    provincias = []
    for fila in cobertura:
        medida = por_codigo.get(fila.codigo, {})
        registros = int(medida.get("registros") or 0)
        provincias.append(
            {
                "codigo": fila.codigo,
                "nombre": fila.nombre,
                "nota": fila.nota,
                "registros": registros,
                "cantones": [],
                "agencias": int(medida.get("agencias") or 0),
                "densidad": medida.get("densidad") if registros else None,
                "densidad_km2": medida.get("densidad_km2") if registros else None,
                "indice": medida.get("indice"),
                "tendencia": medida.get("tendencia"),
            }
        )
    ranking = [
        {
            "codigo": item["codigo"],
            "nombre": item["nombre"],
            "registros": int(item["registros"]),
            "agencias": int(item["agencias"]),
            "densidad": item["densidad"],
            "densidad_km2": item.get("densidad_km2"),
            "indice": item["indice"],
            "tendencia": item["tendencia"],
        }
        for item in sorted(
            (item for item in snapshot if int(item.get("registros") or 0) > 0 and item.get("indice") is not None),
            key=lambda item: (-int(item["indice"]), -int(item["registros"]), str(item["nombre"])),
        )
    ]
    total = sum(int(item.get("registros") or 0) for item in snapshot)
    return {
        "total_registros": total,
        "zonas_analizadas": len(ranking),
        "alta_concentracion": sum(1 for item in ranking if int(item["indice"]) >= 75),
        "registros_sin_zona": int(indicadores.get("registros_sin_zona") or 0),
        "calidad_registros": _calidad(db),
        "definicion_indice": DEFINICION_INDICE,
        "nota": _NOTA_DATOS if total else _NOTA_VACIA,
        "provincias": provincias,
        "ranking": ranking,
    }


def calor(db: Session) -> dict:
    filas = db.execute(
        text(
            f"""
            SELECT
                round(ST_X(u.geom)::numeric, 2) AS x,
                round(ST_Y(u.geom)::numeric, 2) AS y,
                count(*) AS peso
            FROM ubicaciones u
            JOIN lotes_importacion l ON l.id = u.lote_id
            WHERE l.estado = 'completado'
              AND {CONDICION_ACEPTADA}
            GROUP BY 1, 2
            ORDER BY 2, 1
            """
        )
    ).all()
    total = db.execute(
        text(
            f"""
            SELECT count(*)
            FROM ubicaciones u
            JOIN lotes_importacion l ON l.id = u.lote_id
            WHERE l.estado = 'completado'
              AND {CONDICION_ACEPTADA}
            """
        )
    ).scalar()
    return {
        "definicion": (
            "Centroides de una grilla de 0,01 grados sobre los registros aceptados. "
            "Cada celda agrupa varios registros y no identifica a una persona. "
            "Las filas observadas no entran."
        ),
        "total_registros": int(total or 0),
        "celdas": [{"longitud": float(fila.x), "latitud": float(fila.y), "peso": int(fila.peso)} for fila in filas],
    }


def _indicadores(db: Session) -> dict:
    vigente = db.scalar(select(ResultadoAnalisis).where(ResultadoAnalisis.vigente.is_(True)))
    if vigente is None or not isinstance(vigente.indicadores, dict):
        return {}
    return vigente.indicadores


def _calidad(db: Session) -> float | None:
    fila = db.execute(
        text(
            """
            SELECT i.total_aceptadas, i.total_procesadas
            FROM lotes_importacion l
            JOIN informes_validacion i ON i.lote_id = l.id
            WHERE l.estado = 'completado'
            ORDER BY l.fecha DESC
            LIMIT 1
            """
        )
    ).first()
    if fila is None or not fila.total_procesadas:
        return None
    return round(100 * fila.total_aceptadas / fila.total_procesadas, 1)
