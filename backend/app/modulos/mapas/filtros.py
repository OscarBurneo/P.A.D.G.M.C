"""Catálogo de filtros propuesto para el mapa y los indicadores.

Los campos salen de los atributos que el contrato de columnas ya guarda
(provincia, cantón, agencia y fecha) y de la capa ADM1 ya cargada (zona).
Esta semántica está pendiente de aprobación: campos distintos con Y,
valores del mismo campo con O, y la zona con ST_Intersects, que incluye
el límite igual que la densidad por provincia.
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.errores import ErrorAplicacion
from app.modulos.cobertura.datos import a_codigo, normalizar

VERSION_CATALOGO_FILTROS = "0.1.0-propuesto"
VERSION_CATALOGO_INDICADORES = "0.1.0-propuesto"
MAX_VALORES = 24

NOTA_CATALOGO = (
    "Catálogo propuesto, pendiente de aprobación. Usa los atributos que el contrato "
    "de columnas ya guarda (provincia declarada, cantón, agencia y fecha) y la zona "
    "ADM1 de limites_provinciales. Campos distintos se combinan con Y. Varios valores "
    "del mismo campo se combinan con O. La zona usa ST_Intersects e incluye el límite, "
    "la misma relación que la densidad por provincia."
)

NOTA_INDICADORES = (
    "Catálogo propuesto, pendiente de aprobación. El total de registros aceptados de la "
    "selección sigue la regla de conteo vacío igual a cero. El resto de métricas se "
    "muestra como no disponible cuando no hay registros para calcularlas."
)

CLAVES_CONSULTA = frozenset({"provincia", "canton", "agencia", "zona", "fecha_desde", "fecha_hasta"})

_CAMPOS = (
    {
        "campo": "provincia",
        "etiqueta": "Provincia declarada",
        "operador": "en",
        "tipo": "texto",
        "origen": "atributos_socio.provincia_clave",
        "descripcion": "Provincia escrita en el archivo, ya normalizada. Varios valores se leen con O.",
    },
    {
        "campo": "canton",
        "etiqueta": "Cantón",
        "operador": "en",
        "tipo": "texto",
        "origen": "atributos_socio.canton_clave",
        "descripcion": "Cantón escrito en el archivo. No hay contorno cantonal: el filtro es por el texto.",
    },
    {
        "campo": "agencia",
        "etiqueta": "Agencia",
        "operador": "en",
        "tipo": "texto",
        "origen": "atributos_socio.agencia",
        "descripcion": "Agencia del registro. La comparación no distingue mayúsculas.",
    },
    {
        "campo": "fecha",
        "etiqueta": "Fecha",
        "operador": "entre",
        "tipo": "fecha",
        "origen": "atributos_socio.fecha",
        "descripcion": "Fecha del registro, inclusive. Se envía como fecha_desde y fecha_hasta (AAAA-MM-DD).",
    },
    {
        "campo": "zona",
        "etiqueta": "Zona geográfica",
        "operador": "cubre",
        "tipo": "territorio",
        "origen": "limites_provinciales",
        "descripcion": (
            "Provincia de la capa ADM1 ya cargada. El punto entra si ST_Intersects con el polígono, incluido el límite."
        ),
    },
)


@dataclass(frozen=True)
class Seleccion:
    provincias: tuple[str, ...] = ()
    cantones: tuple[str, ...] = ()
    agencias: tuple[str, ...] = ()
    zonas: tuple[str, ...] = ()
    fecha_desde: date | None = None
    fecha_hasta: date | None = None

    @property
    def vacia(self) -> bool:
        return not (
            self.provincias or self.cantones or self.agencias or self.zonas or self.fecha_desde or self.fecha_hasta
        )

    def activos(self) -> list[dict[str, object]]:
        salida: list[dict[str, object]] = []
        if self.zonas:
            salida.append(_activo("zona", "cubre", list(self.zonas)))
        if self.provincias:
            salida.append(_activo("provincia", "en", list(self.provincias)))
        if self.cantones:
            salida.append(_activo("canton", "en", list(self.cantones)))
        if self.agencias:
            salida.append(_activo("agencia", "en", list(self.agencias)))
        if self.fecha_desde and self.fecha_hasta:
            salida.append(_activo("fecha", "entre", [self.fecha_desde.isoformat(), self.fecha_hasta.isoformat()]))
        elif self.fecha_desde:
            salida.append(_activo("fecha", "desde", [self.fecha_desde.isoformat()]))
        elif self.fecha_hasta:
            salida.append(_activo("fecha", "hasta", [self.fecha_hasta.isoformat()]))
        return salida


def catalogo(db: Session) -> dict:
    return {
        "version": VERSION_CATALOGO_FILTROS,
        "propuesto": True,
        "nota": NOTA_CATALOGO,
        "combinacion": {
            "campos_distintos": "Y",
            "valores_del_mismo_campo": "O",
            "frontera": "ST_Intersects incluye el límite. Propuesta pendiente de aprobación.",
        },
        "campos": list(_CAMPOS),
        "dominios": _dominios(db),
        "indicadores": {
            "version": VERSION_CATALOGO_INDICADORES,
            "propuesto": True,
            "nota": NOTA_INDICADORES,
        },
    }


def interpretar(parametros, db: Session) -> Seleccion:
    ajenas = sorted(set(parametros.keys()) - CLAVES_CONSULTA)
    if ajenas:
        raise ErrorAplicacion(
            422,
            f"El campo «{ajenas[0]}» no está en el catálogo de filtros.",
            "filtro_no_autorizado",
        )
    fecha_desde = _fecha(parametros, "fecha_desde")
    fecha_hasta = _fecha(parametros, "fecha_hasta")
    if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
        raise ErrorAplicacion(
            422,
            "La fecha inicial no puede ser posterior a la fecha final.",
            "filtro_invalido",
        )
    return Seleccion(
        provincias=_valores(parametros, "provincia"),
        cantones=_valores(parametros, "canton"),
        agencias=_valores(parametros, "agencia"),
        zonas=_zonas(db, _valores(parametros, "zona")),
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )


def predicado(seleccion: Seleccion) -> tuple[str, dict[str, object]]:
    """Fragmento SQL y parámetros. Vacío si la selección no filtra."""

    if seleccion.vacia:
        return "", {}
    partes: list[str] = []
    params: dict[str, object] = {}
    if seleccion.provincias:
        partes.append(
            _disyuncion(
                "u.atributos_socio->>'provincia_clave'",
                "prov",
                seleccion.provincias,
                params,
                normalizar,
            )
        )
    if seleccion.cantones:
        partes.append(
            _disyuncion(
                "u.atributos_socio->>'canton_clave'",
                "canton",
                seleccion.cantones,
                params,
                normalizar,
            )
        )
    if seleccion.agencias:
        partes.append(
            _disyuncion(
                "lower(btrim(u.atributos_socio->>'agencia'))",
                "agencia",
                seleccion.agencias,
                params,
                lambda valor: valor.strip().casefold(),
            )
        )
    if seleccion.fecha_desde:
        partes.append("(u.atributos_socio->>'fecha') >= :fecha_desde")
        params["fecha_desde"] = seleccion.fecha_desde.isoformat()
    if seleccion.fecha_hasta:
        partes.append("(u.atributos_socio->>'fecha') <= :fecha_hasta")
        params["fecha_hasta"] = seleccion.fecha_hasta.isoformat()
    if seleccion.zonas:
        comparaciones = []
        for indice, zona in enumerate(seleccion.zonas):
            comparaciones.append(f"(c.codigo = :zona_{indice} OR p.nombre_clave = :zona_{indice})")
            params[f"zona_{indice}"] = zona
        partes.append(
            "EXISTS ("
            "SELECT 1 FROM limites_provinciales p "
            "LEFT JOIN cobertura_provincial c ON c.limite_id = p.id "
            "WHERE ST_Intersects(p.geometria, u.geom) "
            f"AND ({' OR '.join(comparaciones)})"
            ")"
        )
    return " AND ".join(f"({parte})" for parte in partes), params


def _activo(campo: str, operador: str, valores: list[str]) -> dict[str, object]:
    etiqueta = next(item["etiqueta"] for item in _CAMPOS if item["campo"] == campo)
    return {"campo": campo, "etiqueta": etiqueta, "operador": operador, "valores": valores}


def _valores(parametros, nombre: str) -> tuple[str, ...]:
    crudos = list(parametros.getlist(nombre))
    if any(not item.strip() for item in crudos):
        raise ErrorAplicacion(422, f"El filtro «{nombre}» no admite un valor vacío.", "filtro_invalido")
    if len(crudos) > MAX_VALORES:
        raise ErrorAplicacion(422, f"El filtro «{nombre}» admite hasta {MAX_VALORES} valores.", "filtro_invalido")
    vistos: list[str] = []
    for item in crudos:
        limpio = " ".join(item.split())
        if limpio not in vistos:
            vistos.append(limpio)
    return tuple(vistos)


def _fecha(parametros, nombre: str) -> date | None:
    crudos = list(parametros.getlist(nombre))
    if not crudos:
        return None
    if len(crudos) > 1 or not crudos[0].strip():
        raise ErrorAplicacion(422, f"El filtro «{nombre}» admite una sola fecha.", "filtro_invalido")
    try:
        return date.fromisoformat(crudos[0].strip())
    except ValueError as exc:
        raise ErrorAplicacion(
            422,
            f"La fecha «{crudos[0]}» no tiene la forma AAAA-MM-DD.",
            "filtro_invalido",
        ) from exc


def _zonas(db: Session, pedidas: tuple[str, ...]) -> tuple[str, ...]:
    if not pedidas:
        return ()
    conocidos = _zonas_conocidas(db)
    if not conocidos:
        raise ErrorAplicacion(
            409,
            "No hay capa territorial cargada para filtrar por zona.",
            "capa_territorial_ausente",
        )
    canonicas: list[str] = []
    for pedida in pedidas:
        candidatos = {pedida, a_codigo(pedida), normalizar(pedida)}
        encontrada = next((conocidos[candidato] for candidato in candidatos if candidato in conocidos), None)
        if encontrada is None:
            raise ErrorAplicacion(
                422,
                f"La zona «{pedida}» no está en la capa territorial.",
                "zona_desconocida",
            )
        if encontrada not in canonicas:
            canonicas.append(encontrada)
    return tuple(canonicas)


def _zonas_conocidas(db: Session) -> dict[str, str]:
    filas = db.execute(
        text(
            """
            SELECT c.codigo AS codigo, l.nombre AS nombre, l.nombre_clave AS nombre_clave
            FROM limites_provinciales l
            LEFT JOIN cobertura_provincial c ON c.limite_id = l.id
            """
        )
    ).all()
    conocidos: dict[str, str] = {}
    for fila in filas:
        canonica = fila.codigo or a_codigo(fila.nombre)
        for alias in {canonica, fila.nombre_clave, a_codigo(fila.nombre), normalizar(fila.nombre)}:
            if alias:
                conocidos[str(alias)] = str(canonica)
    return conocidos


def _disyuncion(expresion: str, prefijo: str, valores: tuple[str, ...], params: dict, transformar) -> str:
    partes = []
    for indice, valor in enumerate(valores):
        clave = f"{prefijo}_{indice}"
        partes.append(f"{expresion} = :{clave}")
        params[clave] = transformar(valor)
    return "(" + " OR ".join(partes) + ")"


def _dominios(db: Session) -> dict:
    filas = db.execute(
        text(
            """
            SELECT
                u.atributos_socio->>'provincia' AS provincia,
                u.atributos_socio->>'canton' AS canton,
                u.atributos_socio->>'agencia' AS agencia
            FROM ubicaciones u
            JOIN lotes_importacion l ON l.id = u.lote_id
            WHERE l.estado = 'completado'
              AND COALESCE(u.atributos_socio->>'clasificacion', 'aceptada') = 'aceptada'
            """
        )
    ).all()
    provincias = sorted({fila.provincia for fila in filas if fila.provincia})
    cantones = sorted({fila.canton for fila in filas if fila.canton})
    agencias = sorted({fila.agencia for fila in filas if fila.agencia})
    zonas = db.execute(
        text(
            """
            SELECT COALESCE(c.codigo, l.nombre_clave) AS codigo,
                   l.nombre AS nombre,
                   COALESCE(c.activa, false) AS con_agencia
            FROM limites_provinciales l
            LEFT JOIN cobertura_provincial c ON c.limite_id = l.id
            ORDER BY COALESCE(c.orden, 1000), l.nombre
            """
        )
    ).all()
    return {
        "provincia": provincias,
        "canton": cantones,
        "agencia": agencias,
        "zona": [
            {"codigo": fila.codigo, "nombre": fila.nombre, "con_agencia": bool(fila.con_agencia)} for fila in zonas
        ],
    }
