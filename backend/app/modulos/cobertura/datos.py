"""Carga de límites versionados y de la cobertura inicial."""

import json
import unicodedata
import uuid
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.modelos import CoberturaProvincial, LimiteProvincial

DIRECTORIO = Path(__file__).resolve().parents[2] / "recursos" / "geografia"

FUENTE: dict[str, object] = {
    "nombre": "geoBoundaries gbOpen Ecuador ADM1",
    "licencia": "CC0 1.0 Universal",
    "licencia_url": "https://creativecommons.org/publicdomain/zero/1.0/",
    "proveedor": "geoBoundaries",
    "origen": "Wikimedia Commons, según el metadato de geoBoundaries",
    "identificador": "ECU-ADM1-780006",
    "anio_representado": "2011",
    "fecha_construccion": "2023-12-12",
    "url": (
        "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/"
        "releaseData/gbOpen/ECU/ADM1/geoBoundaries-ECU-ADM1_simplified.geojson"
    ),
    "cita": (
        "Runfola, D. et al. (2020) geoBoundaries: A global database of political "
        "administrative boundaries. PLoS ONE 15(4): e0231866."
    ),
    "doi": "https://doi.org/10.1371/journal.pone.0231866",
    "srid": 4326,
    "nota": (
        "El archivo del repositorio parte del GeoJSON simplificado y redondea "
        "las coordenadas a 4 decimales. Galápagos se muestra en un recuadro."
    ),
}


def normalizar(nombre: str) -> str:
    descompuesto = unicodedata.normalize("NFKD", nombre)
    sin_tildes = "".join(caracter for caracter in descompuesto if not unicodedata.combining(caracter))
    return " ".join(sin_tildes.casefold().split())


def a_codigo(nombre: str) -> str:
    return normalizar(nombre).replace(" ", "-")


def sembrar_geografia(db: Session) -> None:
    if db.scalar(select(LimiteProvincial.id).limit(1)) is None:
        _limites(db)
    if db.scalar(select(CoberturaProvincial.id).limit(1)) is None:
        _cobertura(db)
    db.flush()


def _limites(db: Session) -> None:
    alias = json.loads((DIRECTORIO / "alias_nombres.json").read_text(encoding="utf-8"))
    coleccion = json.loads((DIRECTORIO / "ecuador-adm1.geojson").read_text(encoding="utf-8"))
    for feature in coleccion["features"]:
        propiedades = feature["properties"]
        origen = str(propiedades["shapeName"])
        clave = normalizar(origen)
        nombre = str(alias.get(clave, origen))
        db.execute(
            text(
                """
                INSERT INTO limites_provinciales
                    (id, codigo, nombre, nombre_clave, codigo_iso, es_galapagos, geometria)
                VALUES (
                    :id, :codigo, :nombre, :clave, :iso, :galapagos,
                    ST_Multi(
                        ST_CollectionExtract(
                            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(:geo), 4326)),
                            3
                        )
                    )
                )
                """
            ),
            {
                "id": uuid.uuid4(),
                "codigo": str(propiedades["shapeID"]),
                "nombre": nombre,
                "clave": clave,
                "iso": str(propiedades.get("shapeISO") or "") or None,
                "galapagos": clave == "galapagos",
                "geo": json.dumps(feature["geometry"]),
            },
        )
    db.flush()


def _cobertura(db: Session) -> None:
    configuracion = json.loads((DIRECTORIO / "cobertura_inicial.json").read_text(encoding="utf-8"))
    limites = {limite.nombre_clave: limite for limite in db.scalars(select(LimiteProvincial)).all()}
    for item in configuracion:
        clave = normalizar(str(item["nombre"]))
        limite = limites.get(clave)
        if limite is None:
            disponibles = ", ".join(sorted(limites))
            raise RuntimeError(f"No hay límite para {item['nombre']}. Disponibles: {disponibles}")
        db.add(
            CoberturaProvincial(
                limite_id=limite.id,
                codigo=str(item["codigo"]),
                nombre=str(item["nombre"]),
                nota=item.get("nota"),
                activa=True,
                orden=int(item["orden"]),
            )
        )
    db.flush()
