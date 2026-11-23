"""Resumen territorial y capa de calor agregada.

El resumen no incluye posiciones individuales. La capa de calor usa
centroides de una grilla y vive en otra ruta, fuera de /api/mapas/agregado.
Con filtros, el índice se recalcula al vuelo con la misma fórmula y no
reemplaza el resultado vigente.
"""

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.modelos import ResultadoAnalisis
from app.modulos.analitica.indice import (
    CONDICION_ACEPTADA,
    DEFINICION_INDICE,
    medir_seleccion,
    version_de_datos,
)
from app.modulos.mapas.filtros import (
    NOTA_INDICADORES,
    VERSION_CATALOGO_FILTROS,
    VERSION_CATALOGO_INDICADORES,
    Seleccion,
    predicado,
)

_NOTA_VACIA = (
    "No hay registros publicados. Las provincias salen de la cobertura configurada "
    "y los cantones se mostrarán cuando existan datos agregados."
)
_NOTA_DATOS = (
    "El índice de concentración usa las filas aceptadas de los lotes publicados. "
    "La tendencia queda vacía si no había un resultado anterior."
)
_NOTA_FILTRO = (
    "El índice y la densidad se recalculan sobre la selección. La tendencia no se compara con el resultado anterior."
)
_NOTA_AUSENCIA = "La selección no tiene registros aceptados. Es ausencia de datos, no un valor cero."

_VARIABLE = "Registros aceptados"
_UNIDAD = "registros por celda de 0,01 grados"
_PATRONES = ("puntos", "rayas", "diagonal", "solido")
_ETIQUETAS = ("Bajo", "Medio", "Alto", "Muy alto")


def resumen(db: Session, seleccion: Seleccion) -> dict:
    filtro_sql, params = predicado(seleccion)
    if seleccion.vacia:
        indicadores = _indicadores(db)
        nota = None
    else:
        medido = medir_seleccion(db, filtro_sql, params)
        indicadores = {
            "provincias": medido["provincias"],
            "registros_sin_zona": medido["registros_sin_zona"],
        }
        nota = _NOTA_FILTRO
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
    sin_zona = int(indicadores.get("registros_sin_zona") or 0)
    if not seleccion.vacia and total == 0 and sin_zona == 0:
        nota = _NOTA_AUSENCIA
    version = version_de_datos(db)
    return {
        "total_registros": total,
        "zonas_analizadas": len(ranking),
        "alta_concentracion": sum(1 for item in ranking if int(item["indice"]) >= 75),
        "registros_sin_zona": sin_zona,
        "zonas_en_cero": _zonas_en_cero(snapshot, seleccion.zonas),
        "calidad_registros": _calidad(db),
        "definicion_indice": DEFINICION_INDICE,
        "nota": nota if nota else (_NOTA_DATOS if total else _NOTA_VACIA),
        "provincias": provincias,
        "ranking": ranking,
        "version_datos": version,
        "version_catalogo_filtros": VERSION_CATALOGO_FILTROS,
        "filtros_activos": seleccion.activos(),
        "seleccion_vacia": not seleccion.vacia and total == 0 and sin_zona == 0,
        "indicadores_seleccion": _indicadores_seleccion(db, filtro_sql, params, total + sin_zona, ranking),
    }


def calor(db: Session, seleccion: Seleccion) -> dict:
    filtro_sql, params = predicado(seleccion)
    extra = f" AND ({filtro_sql})" if filtro_sql else ""
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
              AND {CONDICION_ACEPTADA}{extra}
            GROUP BY 1, 2
            ORDER BY 2, 1
            """
        ),
        params,
    ).all()
    total = db.execute(
        text(
            f"""
            SELECT count(*)
            FROM ubicaciones u
            JOIN lotes_importacion l ON l.id = u.lote_id
            WHERE l.estado = 'completado'
              AND {CONDICION_ACEPTADA}{extra}
            """
        ),
        params,
    ).scalar()
    celdas = [{"longitud": float(fila.x), "latitud": float(fila.y), "peso": int(fila.peso)} for fila in filas]
    total_entero = int(total or 0)
    return {
        "definicion": (
            "Centroides de una grilla de 0,01 grados sobre los registros aceptados de la selección. "
            "Cada celda agrupa varios registros y no identifica a una persona. "
            "Las filas observadas no entran."
        ),
        "total_registros": total_entero,
        "celdas": celdas,
        "version_datos": version_de_datos(db),
        "version_catalogo_filtros": VERSION_CATALOGO_FILTROS,
        "filtros_activos": seleccion.activos(),
        "seleccion_vacia": not seleccion.vacia and total_entero == 0,
        "leyenda": _leyenda(celdas, total_entero),
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


def _zonas_en_cero(snapshot: list[dict], zonas: tuple[str, ...]) -> list[str]:
    if not zonas:
        return []
    pedidas = set(zonas)
    return [
        str(item.get("nombre"))
        for item in snapshot
        if str(item.get("codigo")) in pedidas and int(item.get("registros") or 0) == 0
    ]


def _indicadores_seleccion(
    db: Session,
    filtro_sql: str,
    params: dict,
    total_seleccion: int,
    ranking: list[dict],
) -> dict:
    hay = total_seleccion > 0
    agencias = _agencias_distintas(db, filtro_sql, params) if hay else None
    densidades = [float(item["densidad"]) for item in ranking if item.get("densidad") is not None]
    densidades_km2 = [float(item["densidad_km2"]) for item in ranking if item.get("densidad_km2") is not None]
    return {
        "version": VERSION_CATALOGO_INDICADORES,
        "propuesto": True,
        "nota": NOTA_INDICADORES,
        "metricas": [
            _metrica(
                "total_registros",
                "Registros aceptados",
                "registro",
                "Conteo de filas aceptadas de la selección, incluidas las que no caen en una provincia.",
                "entero",
                "La selección vacía vale 0.",
                total_seleccion,
                True,
            ),
            _metrica(
                "agencias",
                "Agencias distintas",
                "agencia",
                "Conteo distinto de agencia no vacía en la selección.",
                "entero",
                "Sin registros, no disponible.",
                agencias,
                hay,
            ),
            _metrica(
                "provincias_con_registros",
                "Provincias con registros",
                "provincia",
                "Provincias de la capa con al menos un registro aceptado en la selección.",
                "entero",
                "Sin registros, no disponible.",
                len(ranking) if hay else None,
                hay,
            ),
            _metrica(
                "densidad_maxima",
                "Densidad máxima por agencia",
                "registros por agencia",
                "Máximo de registros / max(agencias, 1) entre las provincias de la selección.",
                "4 decimales",
                "Sin provincias con registros, no disponible.",
                max(densidades) if densidades else None,
                bool(densidades),
            ),
            _metrica(
                "densidad_km2_maxima",
                "Densidad máxima por km²",
                "registros por km²",
                "Máximo de registros / área provincial entre las provincias de la selección.",
                "4 decimales",
                "Sin provincias con registros, no disponible.",
                max(densidades_km2) if densidades_km2 else None,
                bool(densidades_km2),
            ),
        ],
    }


def _metrica(
    codigo: str,
    nombre: str,
    unidad: str,
    formula: str,
    redondeo: str,
    nulos: str,
    valor: object,
    disponible: bool,
) -> dict:
    return {
        "codigo": codigo,
        "nombre": nombre,
        "unidad": unidad,
        "formula": formula,
        "redondeo": redondeo,
        "nulos": nulos,
        "valor": valor if disponible else None,
        "disponible": disponible,
    }


def _agencias_distintas(db: Session, filtro_sql: str, params: dict) -> int:
    extra = f" AND ({filtro_sql})" if filtro_sql else ""
    total = db.execute(
        text(
            f"""
            SELECT count(DISTINCT lower(btrim(u.atributos_socio->>'agencia')))
            FROM ubicaciones u
            JOIN lotes_importacion l ON l.id = u.lote_id
            WHERE l.estado = 'completado'
              AND {CONDICION_ACEPTADA}
              AND btrim(coalesce(u.atributos_socio->>'agencia', '')) <> ''{extra}
            """
        ),
        params,
    ).scalar()
    return int(total or 0)


def _leyenda(celdas: list[dict], total: int) -> dict:
    pesos = [int(celda["peso"]) for celda in celdas]
    intervalos = _intervalos(max(pesos)) if pesos else []
    return {
        "variable": _VARIABLE,
        "unidad": _UNIDAD,
        "significado": (
            "El color muestra la intensidad relativa del peso de cada celda dentro de la selección vigente. "
            "La etiqueta, el intervalo y el patrón se leen sin depender del color."
        ),
        "cero": (
            "Una zona pedida con 0 registros aceptados. El cero significa que la provincia existe "
            "en la capa y la selección no tiene registros ahí."
        ),
        "ausencia": "No hay celdas de calor para la selección. No equivale al valor cero.",
        "ausencia_datos": total == 0 or not celdas,
        "intervalos": intervalos,
        "escala": (
            "Las franjas usan luminancia creciente y un patrón (puntos, rayas, diagonal o sólido) "
            "para distinguirse en escala de grises."
        ),
    }


def _intervalos(maximo: int) -> list[dict]:
    if maximo <= 1:
        return [_intervalo(0, 1, 1)]
    cortes = (
        max(1, maximo // 4),
        max(1, maximo // 2),
        max(1, (3 * maximo) // 4),
        maximo,
    )
    inicio = 1
    salida = []
    for indice, fin in enumerate(cortes):
        if inicio > fin:
            continue
        if salida and fin == salida[-1]["hasta"] and inicio > salida[-1]["hasta"]:
            continue
        salida.append(_intervalo(indice, inicio, fin))
        inicio = fin + 1
    return salida


def _intervalo(indice: int, desde: int, hasta: int) -> dict:
    etiqueta = _ETIQUETAS[min(indice, len(_ETIQUETAS) - 1)]
    return {
        "etiqueta": etiqueta,
        "desde": desde,
        "hasta": hasta,
        "patron": _PATRONES[min(indice, len(_PATRONES) - 1)],
        "significado": f"{etiqueta}: de {desde} a {hasta} {_UNIDAD} en esta selección.",
    }
