"""Índice de concentración por provincia. Es lo mínimo del catálogo analítico para HU-29 y HU-30."""

import hashlib
import uuid
from decimal import Decimal

from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

from app.modelos import CatalogoProceso, EjecucionAnalisis, ResultadoAnalisis, ZonaAnalisis
from app.modulos.cobertura.datos import FUENTE, a_codigo
from app.modulos.importaciones.contrato import VERSION_CONTRATO

CODIGO_PROCESO = "indice_concentracion"
VERSION_PROCESO = "0.1.0-propuesto"
METRICA = "indice_concentracion"
DEFINICION_INDICE = (
    "Índice de concentración propuesto: registros publicados por agencia, "
    "normalizado de 0 a 100 frente a la provincia con mayor densidad de este cálculo. "
    "La tendencia es la diferencia con el resultado anterior y queda vacía si no había un lote previo."
)


def recalcular(db: Session, actor_id: uuid.UUID) -> ResultadoAnalisis:
    proceso = _proceso(db)
    anterior = db.scalar(select(ResultadoAnalisis).where(ResultadoAnalisis.vigente.is_(True)))
    previos = _indices_previos(anterior)
    provincias = _medir(db)
    maximo = max((item["densidad"] for item in provincias if item["registros"] > 0), default=0.0)
    lotes = _lotes_contados(db)
    for item in provincias:
        if item["registros"] <= 0 or maximo <= 0:
            item["indice"] = None
            item["tendencia"] = None
            continue
        item["indice"] = int(round(100 * item["densidad"] / maximo))
        if anterior is None or item["codigo"] not in previos or previos[item["codigo"]] is None:
            item["tendencia"] = None
        else:
            item["tendencia"] = item["indice"] - int(previos[item["codigo"]])
    if anterior is not None:
        db.execute(update(ResultadoAnalisis).where(ResultadoAnalisis.vigente.is_(True)).values(vigente=False))
    indicadores = {
        "definicion": DEFINICION_INDICE,
        "formula": "densidad = registros / max(agencias, 1); indice = redondeo(100 * densidad / max(densidad))",
        "provincias": provincias,
        "total_registros": sum(item["registros"] for item in provincias),
        "lotes": lotes,
    }
    ejecucion = EjecucionAnalisis(
        proceso_id=proceso.id,
        actor_id=actor_id,
        estado="completado",
        version_datos=hashlib.sha256(",".join(lotes).encode()).hexdigest(),
        version_configuracion=VERSION_CONTRATO,
        version_catalogo=proceso.version,
        version_capa_territorial=str(FUENTE["identificador"]),
        parametros={"lotes": lotes, "tamano_metros": 5},
        motivo_fallo=None,
    )
    db.add(ejecucion)
    db.flush()
    resultado = ResultadoAnalisis(ejecucion_id=ejecucion.id, indicadores=indicadores, vigente=True)
    db.add(resultado)
    db.flush()
    for item in provincias:
        if not item["indice"] and item["indice"] != 0:
            continue
        if item["registros"] <= 0 or item["indice"] is None:
            continue
        db.add(
            ZonaAnalisis(
                resultado_id=resultado.id,
                zona=item["codigo"],
                metrica=METRICA,
                valor=Decimal(item["indice"]),
                tipo="provincia",
            )
        )
    db.flush()
    return resultado


def _proceso(db: Session) -> CatalogoProceso:
    proceso = db.scalar(select(CatalogoProceso).where(CatalogoProceso.codigo == CODIGO_PROCESO))
    if proceso is not None:
        return proceso
    proceso = CatalogoProceso(
        codigo=CODIGO_PROCESO,
        nombre="Índice de concentración provincial",
        version=VERSION_PROCESO,
        habilitado=True,
        entradas={"origen": "ubicaciones de lotes en estado completado", "metrica": METRICA},
    )
    db.add(proceso)
    db.flush()
    return proceso


def _medir(db: Session) -> list[dict[str, object]]:
    filas = db.execute(
        text(
            """
            SELECT
                l.nombre AS nombre,
                l.nombre_clave AS nombre_clave,
                c.codigo AS codigo_cobertura,
                count(u.id) AS registros,
                count(DISTINCT NULLIF(u.atributos_socio->>'agencia', '')) AS agencias
            FROM limites_provinciales l
            LEFT JOIN cobertura_provincial c ON c.limite_id = l.id
            LEFT JOIN ubicaciones u
              ON u.lote_id IN (SELECT id FROM lotes_importacion WHERE estado = 'completado')
             AND ST_Intersects(l.geometria, u.geom)
            GROUP BY l.nombre, l.nombre_clave, c.codigo, c.orden
            ORDER BY COALESCE(c.orden, 1000), l.nombre
            """
        )
    ).all()
    provincias = []
    for fila in filas:
        registros = int(fila.registros or 0)
        agencias = int(fila.agencias or 0)
        densidad = round(registros / max(agencias, 1), 4) if registros else 0.0
        provincias.append(
            {
                "codigo": fila.codigo_cobertura or a_codigo(fila.nombre),
                "nombre": fila.nombre,
                "nombre_clave": fila.nombre_clave,
                "registros": registros,
                "agencias": agencias,
                "densidad": densidad,
            }
        )
    return provincias


def _lotes_contados(db: Session) -> list[str]:
    filas = db.execute(
        text("SELECT id::text FROM lotes_importacion WHERE estado = 'completado' ORDER BY fecha, id")
    ).all()
    return [fila[0] for fila in filas]


def _indices_previos(resultado: ResultadoAnalisis | None) -> dict[str, int | None]:
    if resultado is None or not resultado.indicadores:
        return {}
    previos: dict[str, int | None] = {}
    for item in resultado.indicadores.get("provincias", []):
        previos[str(item.get("codigo"))] = item.get("indice")
    return previos
