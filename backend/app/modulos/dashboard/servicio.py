"""Agregados del inicio. No devuelve identificadores ni nombres de personas."""

from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modulos.analitica.indice import CONDICION_ACEPTADA, version_de_datos
from app.modulos.dashboard.formulas import (
    abreviatura_mes,
    etiqueta_mes,
    mes_anterior,
    mes_de_referencia,
    meses_entre,
    mismo_mes_anio_anterior,
    promedio_movil,
    variacion,
)
from app.modulos.mapas.filtros import Seleccion, predicado

_TOP_AGENCIAS = 10
_MESES_VISIBLES = 12


def resumen(db: Session, seleccion: Seleccion, hoy: date | None = None) -> dict:
    dia = hoy or date.today()
    filas = _agrupar(db, seleccion)
    por_mes: dict[str, int] = {}
    por_provincia: dict[str, int] = {}
    por_agencia: dict[str, int] = {}
    por_mes_agencia: dict[tuple[str, str], int] = {}
    total = 0
    for periodo, provincia, agencia, registros in filas:
        total += registros
        if provincia:
            por_provincia[provincia] = por_provincia.get(provincia, 0) + registros
        if agencia:
            por_agencia[agencia] = por_agencia.get(agencia, 0) + registros
        if periodo:
            por_mes[periodo] = por_mes.get(periodo, 0) + registros
            if agencia:
                clave = (periodo, agencia)
                por_mes_agencia[clave] = por_mes_agencia.get(clave, 0) + registros
    referencia = mes_de_referencia(por_mes, dia)
    previo = mes_anterior(referencia) if referencia else None
    serie = meses_entre(min(por_mes), max(por_mes)) if por_mes else []
    conteos = [por_mes.get(periodo, 0) for periodo in serie]
    moviles = promedio_movil(conteos)
    visibles = serie[-_MESES_VISIBLES:]
    tendencia = [
        {
            "periodo": periodo,
            "etiqueta": abreviatura_mes(periodo),
            "anio": int(periodo[:4]),
            "registros": por_mes.get(periodo, 0),
            "promedio_movil": moviles[serie.index(periodo)],
            "anio_anterior": por_mes.get(mismo_mes_anio_anterior(periodo), 0),
        }
        for periodo in visibles
    ]
    provincias = _ordenadas(por_provincia)
    agencias = _ordenadas(por_agencia)
    lider_provincia = provincias[0] if provincias else None
    lider_agencia = agencias[0] if agencias else None
    ranking = [
        {
            "agencia": nombre,
            "total": cantidad,
            "porcentaje": round(100 * cantidad / total, 1) if total else 0,
            "variacion": variacion(
                por_mes_agencia.get((referencia, nombre), 0) if referencia else 0,
                por_mes_agencia.get((previo, nombre), 0) if previo else 0,
            ),
        }
        for nombre, cantidad in agencias
    ]
    return {
        "version_datos": version_de_datos(db),
        "filtros_activos": seleccion.activos(),
        "vacio": total == 0,
        "kpis": {
            "total": total,
            "mes": _kpi_mes(referencia, previo, por_mes),
            "provincia": None
            if lider_provincia is None
            else {"nombre": lider_provincia[0], "registros": lider_provincia[1]},
            "agencia": None if lider_agencia is None else {"nombre": lider_agencia[0], "registros": lider_agencia[1]},
        },
        "tendencia": tendencia,
        "provincias": [{"nombre": nombre, "registros": cantidad} for nombre, cantidad in provincias],
        "agencias": [{"nombre": nombre, "registros": cantidad} for nombre, cantidad in agencias[:_TOP_AGENCIAS]],
        "eficiencia": _eficiencia(visibles, agencias[:_TOP_AGENCIAS], por_mes_agencia),
        "ranking": ranking,
    }


def _agrupar(db: Session, seleccion: Seleccion) -> list[tuple[str | None, str, str, int]]:
    filtro_sql, params = predicado(seleccion)
    extra = f" AND ({filtro_sql})" if filtro_sql else ""
    filas = db.execute(
        text(
            f"""
            SELECT
                CASE
                    WHEN u.atributos_socio->>'fecha' ~ '^[0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}}$'
                    THEN substring(u.atributos_socio->>'fecha' from 1 for 7)
                    ELSE NULL
                END AS periodo,
                btrim(coalesce(u.atributos_socio->>'provincia', '')) AS provincia,
                btrim(coalesce(u.atributos_socio->>'agencia', '')) AS agencia,
                count(*) AS registros
            FROM ubicaciones u
            JOIN lotes_importacion l ON l.id = u.lote_id
            WHERE l.estado = 'completado'
              AND {CONDICION_ACEPTADA}{extra}
            GROUP BY 1, 2, 3
            """
        ),
        params,
    ).all()
    return [(fila.periodo, fila.provincia, fila.agencia, int(fila.registros)) for fila in filas]


def _ordenadas(conteos: dict[str, int]) -> list[tuple[str, int]]:
    return sorted(conteos.items(), key=lambda item: (-item[1], item[0].casefold()))


def _kpi_mes(referencia: str | None, previo: str | None, por_mes: dict[str, int]) -> dict | None:
    if referencia is None or previo is None:
        return None
    actual = por_mes.get(referencia, 0)
    anterior = por_mes.get(previo, 0)
    return {
        "periodo": referencia,
        "etiqueta": etiqueta_mes(referencia),
        "frente_a": etiqueta_mes(previo),
        "registros": actual,
        "anterior": anterior,
        "variacion": variacion(actual, anterior),
    }


def _eficiencia(
    meses: list[str],
    agencias: list[tuple[str, int]],
    por_mes_agencia: dict[tuple[str, str], int],
) -> dict:
    filas = []
    maximo = 0
    for nombre, _cantidad in agencias:
        valores = [por_mes_agencia.get((periodo, nombre), 0) for periodo in meses]
        maximo = max(maximo, max(valores, default=0))
        filas.append({"agencia": nombre, "valores": valores})
    return {
        "meses": [{"periodo": periodo, "etiqueta": abreviatura_mes(periodo)} for periodo in meses],
        "filas": filas,
        "maximo": maximo,
    }
