"""Normaliza cada fila y la clasifica como aceptada, observada o rechazada."""

import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modulos.cobertura.datos import normalizar
from app.modulos.importaciones.contrato import (
    COLUMNAS,
    clave_ubicacion,
    columnas_faltantes,
    resolver_mapeo,
)
from app.modulos.importaciones.lectura import ArchivoTabular

_MOTIVOS = {
    "coordenada_fuera_de_ecuador": "La coordenada no cae dentro del Ecuador, incluidas Galápagos.",
    "identificador_duplicado": "El identificador ya está en el archivo o en un lote publicado.",
    "ubicacion_coincidente": "La ubicación, redondeada a unos 5 m, coincide con otro identificador del mismo cantón.",
    "provincia_no_coincide": "El punto cae en otra provincia distinta de la declarada.",
    "formato_formula": "La celda trae una fórmula. No se ejecuta.",
}


@dataclass
class FilaClasificada:
    numero: int
    clasificacion: str = "aceptada"
    motivos: list[str] = field(default_factory=list)
    identificador: str | None = None
    identificador_clave: str | None = None
    nombre: str | None = None
    latitud: float | None = None
    longitud: float | None = None
    provincia: str | None = None
    provincia_clave: str | None = None
    provincia_detectada: str | None = None
    canton: str | None = None
    canton_clave: str | None = None
    agencia: str | None = None
    fecha: str | None = None

    def atributos(self) -> dict[str, object]:
        return {
            "identificador_socio": self.identificador,
            "identificador_clave": self.identificador_clave,
            "nombre": self.nombre,
            "provincia": self.provincia,
            "provincia_clave": self.provincia_clave,
            "provincia_detectada": self.provincia_detectada,
            "canton": self.canton,
            "canton_clave": self.canton_clave,
            "agencia": self.agencia,
            "fecha": self.fecha,
            "clasificacion": self.clasificacion,
            "motivos": self.motivos,
        }


@dataclass
class ResultadoClasificacion:
    estructura_valida: bool
    encabezados: list[str]
    mapeo: dict[str, str | None]
    columnas_faltantes: list[str]
    filas: list[FilaClasificada]
    encoding: str | None
    delimitador: str | None

    def conteos(self) -> dict[str, int]:
        aceptadas = sum(1 for fila in self.filas if fila.clasificacion == "aceptada")
        observadas = sum(1 for fila in self.filas if fila.clasificacion == "observada")
        rechazadas = sum(1 for fila in self.filas if fila.clasificacion == "rechazada")
        return {
            "procesadas": len(self.filas),
            "aceptadas": aceptadas,
            "observadas": observadas,
            "rechazadas": rechazadas,
        }


def clasificar(db: Session, archivo: ArchivoTabular, mapeo_propuesto: dict | None) -> ResultadoClasificacion:
    mapeo = resolver_mapeo(archivo.encabezados, mapeo_propuesto)
    faltantes = columnas_faltantes(mapeo)
    if faltantes:
        return ResultadoClasificacion(
            False,
            archivo.encabezados,
            mapeo,
            faltantes,
            [],
            archivo.encoding,
            archivo.delimitador,
        )
    indice = {campo: archivo.encabezados.index(nombre) for campo, nombre in mapeo.items() if nombre}
    provincias = _catalogo_provincias(db)
    filas = [_fila(numero, celdas, indice, provincias) for numero, celdas in archivo.filas]
    _marcar_territorio(db, filas)
    _marcar_identificadores(db, filas)
    _marcar_ubicaciones(db, filas)
    for fila in filas:
        duros = [
            motivo
            for motivo in fila.motivos
            if not motivo.startswith("ubicacion_coincidente") and motivo != "provincia_no_coincide"
        ]
        if duros:
            fila.clasificacion = "rechazada"
        elif any(motivo in {"ubicacion_coincidente", "provincia_no_coincide"} for motivo in fila.motivos):
            fila.clasificacion = "observada"
        else:
            fila.clasificacion = "aceptada"
    return ResultadoClasificacion(
        True,
        archivo.encabezados,
        mapeo,
        [],
        filas,
        archivo.encoding,
        archivo.delimitador,
    )


def observaciones_de(resultado: ResultadoClasificacion, limite: int = 200) -> dict[str, object]:
    conteo: Counter[str] = Counter()
    muestra: list[dict[str, object]] = []
    for fila in resultado.filas:
        if fila.clasificacion == "aceptada":
            continue
        for motivo in fila.motivos:
            conteo[motivo] += 1
        if len(muestra) < limite:
            muestra.append(
                {
                    "fila": fila.numero,
                    "clasificacion": fila.clasificacion,
                    "motivos": fila.motivos,
                }
            )
    return {
        "estructura_valida": resultado.estructura_valida,
        "encabezados": resultado.encabezados,
        "mapeo": resultado.mapeo,
        "columnas_faltantes": resultado.columnas_faltantes,
        "total_rechazadas": resultado.conteos()["rechazadas"],
        "motivos": dict(conteo),
        "muestra": muestra,
        "muestra_truncada": resultado.conteos()["rechazadas"] + resultado.conteos()["observadas"] > len(muestra),
        "encoding": resultado.encoding,
        "delimitador": resultado.delimitador,
        "mensajes": _MOTIVOS,
    }


def _fila(
    numero: int,
    celdas: list[str],
    indice: dict[str, int],
    provincias: dict[str, str],
) -> FilaClasificada:
    fila = FilaClasificada(numero=numero)
    crudos = {columna.campo: _valor(celdas, indice, columna.campo) for columna in COLUMNAS}
    if any(valor.startswith("=") for valor in crudos.values()):
        fila.motivos.append("formato_formula")
    fila.identificador = _texto(crudos["identificador_socio"])
    fila.identificador_clave = normalizar(fila.identificador) if fila.identificador else None
    fila.nombre = _texto(crudos["nombre"])
    fila.latitud = _decimal(crudos["latitud"])
    fila.longitud = _decimal(crudos["longitud"])
    fila.canton = _texto(crudos["canton"])
    fila.canton_clave = normalizar(fila.canton) if fila.canton else None
    fila.agencia = _texto(crudos["agencia"])
    fila.fecha = _fecha(crudos["fecha"])
    declarada = _texto(crudos["provincia"])
    clave_provincia = normalizar(declarada) if declarada else None
    if clave_provincia in provincias:
        fila.provincia_clave = clave_provincia
        fila.provincia = provincias[clave_provincia]
    elif declarada:
        fila.provincia = declarada
    _obligatorios(fila, crudos)
    if crudos["latitud"] and not crudos["latitud"].startswith("=") and fila.latitud is None:
        fila.motivos.append("formato_latitud")
    if crudos["longitud"] and not crudos["longitud"].startswith("=") and fila.longitud is None:
        fila.motivos.append("formato_longitud")
    if fila.latitud is not None and not -90 <= fila.latitud <= 90:
        fila.motivos.append("formato_latitud")
        fila.latitud = None
    if fila.longitud is not None and not -180 <= fila.longitud <= 180:
        fila.motivos.append("formato_longitud")
        fila.longitud = None
    if crudos["fecha"] and not crudos["fecha"].startswith("=") and fila.fecha is None:
        fila.motivos.append("formato_fecha")
    return fila


def _obligatorios(fila: FilaClasificada, crudos: dict[str, str]) -> None:
    pares = (
        ("identificador_socio", fila.identificador),
        ("nombre", fila.nombre),
        ("latitud", crudos["latitud"]),
        ("longitud", crudos["longitud"]),
        ("provincia", fila.provincia),
        ("canton", fila.canton),
        ("agencia", fila.agencia),
        ("fecha", crudos["fecha"]),
    )
    for campo, valor in pares:
        if not str(valor or "").strip():
            fila.motivos.append(f"obligatorio_{campo}")


def _valor(celdas: list[str], indice: dict[str, int], campo: str) -> str:
    posicion = indice.get(campo)
    if posicion is None or posicion >= len(celdas):
        return ""
    return celdas[posicion].strip()


def _texto(valor: str) -> str | None:
    limpio = " ".join(valor.replace("=", " ").split()) if valor.startswith("=") else " ".join(valor.split())
    if valor.startswith("="):
        return None
    return limpio or None


def _decimal(valor: str) -> float | None:
    if not valor or valor.startswith("="):
        return None
    texto = valor.replace(" ", "")
    if "," in texto and "." in texto:
        return None
    if texto.count(",") == 1:
        texto = texto.replace(",", ".")
    try:
        numero = float(texto)
    except ValueError:
        return None
    if not math.isfinite(numero):
        return None
    return numero


def _fecha(valor: str) -> str | None:
    if not valor or valor.startswith("="):
        return None
    texto = valor.strip()
    if texto.isdigit():
        serial = int(texto)
        if 20_000 <= serial <= 80_000:
            return (date(1899, 12, 30) + timedelta(days=serial)).isoformat()
    for formato in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(texto[:10] if formato == "%Y-%m-%d" else texto, formato).date().isoformat()
        except ValueError:
            continue
    if "T" in texto:
        try:
            return datetime.fromisoformat(texto.replace("Z", "+00:00")).date().isoformat()
        except ValueError:
            return None
    return None


def _catalogo_provincias(db: Session) -> dict[str, str]:
    filas = db.execute(text("SELECT nombre, nombre_clave FROM limites_provinciales")).all()
    return {fila.nombre_clave: fila.nombre for fila in filas}


def _marcar_territorio(db: Session, filas: list[FilaClasificada]) -> None:
    candidatos = [
        {"n": indice, "lon": fila.longitud, "lat": fila.latitud}
        for indice, fila in enumerate(filas)
        if fila.latitud is not None and fila.longitud is not None
    ]
    encontrados: dict[int, list[tuple[str, str]]] = defaultdict(list)
    if candidatos:
        consulta = db.execute(
            text(
                """
                SELECT (elem->>'n')::int AS n, l.nombre_clave, l.nombre
                FROM jsonb_array_elements(CAST(:puntos AS jsonb)) AS elem
                JOIN limites_provinciales l
                  ON ST_Intersects(
                    l.geometria,
                    ST_SetSRID(ST_MakePoint((elem->>'lon')::float8, (elem->>'lat')::float8), 4326)
                  )
                """
            ),
            {"puntos": json.dumps(candidatos)},
        ).all()
        for fila in consulta:
            encontrados[fila.n].append((fila.nombre_clave, fila.nombre))
    for indice, fila in enumerate(filas):
        if fila.latitud is None or fila.longitud is None:
            continue
        opciones = encontrados.get(indice, [])
        if not opciones:
            fila.motivos.append("coordenada_fuera_de_ecuador")
            continue
        preferida = next((item for item in opciones if item[0] == fila.provincia_clave), opciones[0])
        fila.provincia_detectada = preferida[1]
        if fila.provincia_clave is None or preferida[0] != fila.provincia_clave:
            fila.motivos.append("provincia_no_coincide")
            if fila.provincia_clave is None:
                fila.provincia_clave = preferida[0]
                fila.provincia = preferida[1]


def _marcar_identificadores(db: Session, filas: list[FilaClasificada]) -> None:
    conteo = Counter(fila.identificador_clave for fila in filas if fila.identificador_clave)
    repetidos = {clave for clave, total in conteo.items() if total > 1}
    publicados = _identificadores_publicados(db, set(conteo))
    for fila in filas:
        if fila.identificador_clave and (
            fila.identificador_clave in repetidos or fila.identificador_clave in publicados
        ):
            fila.motivos.append("identificador_duplicado")


def _identificadores_publicados(db: Session, claves: set[str]) -> set[str]:
    if not claves:
        return set()
    filas = db.execute(
        text(
            """
            SELECT DISTINCT u.atributos_socio->>'identificador_clave' AS clave
            FROM ubicaciones u
            JOIN lotes_importacion l ON l.id = u.lote_id
            WHERE l.estado = 'completado'
              AND u.atributos_socio->>'identificador_clave' IN (
                SELECT valor FROM jsonb_array_elements_text(CAST(:claves AS jsonb)) AS valor
              )
            """
        ),
        {"claves": json.dumps(sorted(claves))},
    ).all()
    return {fila.clave for fila in filas if fila.clave}


def _marcar_ubicaciones(db: Session, filas: list[FilaClasificada]) -> None:
    grupos: dict[tuple[str, int, int], set[str]] = defaultdict(set)
    for fila in filas:
        if fila.latitud is None or fila.longitud is None or not fila.canton_clave or not fila.identificador_clave:
            continue
        grupos[(fila.canton_clave, *clave_ubicacion(fila.latitud, fila.longitud))].add(fila.identificador_clave)
    publicados = _celdas_publicadas(db)
    for fila in filas:
        if fila.latitud is None or fila.longitud is None or not fila.canton_clave or not fila.identificador_clave:
            continue
        clave = (fila.canton_clave, *clave_ubicacion(fila.latitud, fila.longitud))
        identificadores = set(grupos.get(clave, set()))
        identificadores.update(publicados.get(clave, set()))
        identificadores.discard(fila.identificador_clave)
        if identificadores:
            fila.motivos.append("ubicacion_coincidente")


def _celdas_publicadas(db: Session) -> dict[tuple[str, int, int], set[str]]:
    filas = db.execute(
        text(
            """
            SELECT
                ST_Y(u.geom) AS latitud,
                ST_X(u.geom) AS longitud,
                u.atributos_socio->>'canton_clave' AS canton,
                u.atributos_socio->>'identificador_clave' AS identificador
            FROM ubicaciones u
            JOIN lotes_importacion l ON l.id = u.lote_id
            WHERE l.estado = 'completado'
            """
        )
    ).all()
    grupos: dict[tuple[str, int, int], set[str]] = defaultdict(set)
    for fila in filas:
        if fila.latitud is None or fila.longitud is None or not fila.canton or not fila.identificador:
            continue
        clave = (fila.canton, *clave_ubicacion(float(fila.latitud), float(fila.longitud)))
        grupos[clave].add(fila.identificador)
    return grupos
