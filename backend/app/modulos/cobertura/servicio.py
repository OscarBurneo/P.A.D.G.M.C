"""Consulta y edición de la cobertura. Los contornos no son ubicaciones de socios."""

import json

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.errores import ErrorAplicacion
from app.modelos import CoberturaProvincial, LimiteProvincial, Usuario
from app.modulos.auditoria.servicio import registrar
from app.modulos.cobertura.datos import FUENTE, a_codigo


def listar(db: Session, *, con_contorno: bool) -> dict:
    filas = db.execute(
        text(
            """
            SELECT
                l.codigo AS codigo_limite,
                l.nombre AS nombre_limite,
                l.nombre_clave,
                l.es_galapagos,
                c.codigo AS codigo_cobertura,
                c.nombre AS nombre_cobertura,
                c.nota,
                c.activa,
                c.orden,
                ST_XMin(l.geometria) AS oeste,
                ST_YMin(l.geometria) AS sur,
                ST_XMax(l.geometria) AS este,
                ST_YMax(l.geometria) AS norte,
                CASE WHEN :contorno THEN ST_AsGeoJSON(l.geometria, 4) ELSE NULL END AS contorno
            FROM limites_provinciales l
            LEFT JOIN cobertura_provincial c ON c.limite_id = l.id
            ORDER BY COALESCE(c.orden, 1000), l.nombre
            """
        ),
        {"contorno": con_contorno},
    ).all()
    provincias = [_provincia(fila, con_contorno) for fila in filas]
    return {
        "fuente": FUENTE,
        "encuadre_continental": _extension(db, galapagos=False),
        "recuadro_galapagos": _extension(db, galapagos=True),
        "provincias": provincias,
    }


def resumen_vacio(db: Session) -> dict:
    filas = db.execute(
        text(
            """
            SELECT c.codigo, c.nombre, c.nota, c.orden
            FROM cobertura_provincial c
            WHERE c.activa
            ORDER BY c.orden, c.nombre
            """
        )
    ).all()
    return {
        "total_registros": 0,
        "zonas_analizadas": 0,
        "alta_oportunidad": 0,
        "calidad_registros": None,
        "nota": (
            "No hay registros de socios. Las provincias salen de la cobertura configurada "
            "y los cantones se mostrarán cuando existan datos agregados."
        ),
        "provincias": [
            {
                "codigo": fila.codigo,
                "nombre": fila.nombre,
                "nota": fila.nota,
                "registros": 0,
                "cantones": [],
            }
            for fila in filas
        ],
    }


def actualizar(db: Session, actor: Usuario, codigo: str, activa: bool) -> dict:
    codigo_limpio = codigo.strip().casefold()
    limite = _limite_por_codigo(db, codigo_limpio)
    if limite is None:
        raise ErrorAplicacion(404, "La provincia no está en el catálogo de límites.", "provincia_desconocida")
    cobertura = db.scalar(select(CoberturaProvincial).where(CoberturaProvincial.limite_id == limite.id))
    anterior = bool(cobertura.activa) if cobertura is not None else False
    if cobertura is None:
        orden = db.execute(text("SELECT COALESCE(MAX(orden), 0) + 1 FROM cobertura_provincial")).scalar()
        cobertura = CoberturaProvincial(
            limite_id=limite.id,
            codigo=a_codigo(limite.nombre),
            nombre=limite.nombre,
            nota=None,
            activa=activa,
            orden=int(orden or 1),
        )
        db.add(cobertura)
    else:
        cobertura.activa = activa
    db.flush()
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=actor.id,
        actor_etiqueta=actor.identificador,
        operacion="cobertura.editar",
        entidad_tipo="provincia",
        entidad_id=cobertura.codigo,
        resultado="exito",
        antes={"activa": anterior, "nombre": cobertura.nombre},
        despues={"activa": cobertura.activa, "nombre": cobertura.nombre},
        mensaje="Se actualizó la cobertura provincial.",
    )
    db.commit()
    return {
        "codigo": cobertura.codigo,
        "nombre": cobertura.nombre,
        "con_agencia": cobertura.activa,
        "nota": cobertura.nota,
    }


def _limite_por_codigo(db: Session, codigo: str) -> LimiteProvincial | None:
    limites = db.scalars(select(LimiteProvincial)).all()
    for limite in limites:
        clave = limite.nombre_clave.replace(" ", "-")
        if limite.codigo == codigo or a_codigo(limite.nombre) == codigo or clave == codigo:
            return limite
    cobertura = db.scalar(select(CoberturaProvincial).where(CoberturaProvincial.codigo == codigo))
    if cobertura is None:
        return None
    return db.get(LimiteProvincial, cobertura.limite_id)


def _provincia(fila, con_contorno: bool) -> dict:
    con_agencia = bool(fila.activa)
    cuerpo = {
        "codigo": fila.codigo_cobertura or fila.nombre_clave.replace(" ", "-"),
        "codigo_limite": fila.codigo_limite,
        "nombre": fila.nombre_cobertura or fila.nombre_limite,
        "con_agencia": con_agencia,
        "es_galapagos": bool(fila.es_galapagos),
        "nota": fila.nota,
        "orden": fila.orden,
        "bbox": _caja(fila.oeste, fila.sur, fila.este, fila.norte),
    }
    if con_contorno and fila.contorno:
        cuerpo["contorno"] = json.loads(fila.contorno)
    return cuerpo


def _extension(db: Session, *, galapagos: bool) -> dict | None:
    fila = db.execute(
        text(
            """
            SELECT
                ST_XMin(ext) AS oeste,
                ST_YMin(ext) AS sur,
                ST_XMax(ext) AS este,
                ST_YMax(ext) AS norte
            FROM (
                SELECT ST_Extent(geometria) AS ext
                FROM limites_provinciales
                WHERE es_galapagos = :galapagos
            ) caja
            """
        ),
        {"galapagos": galapagos},
    ).one()
    if fila.oeste is None:
        return None
    return _caja(fila.oeste, fila.sur, fila.este, fila.norte)


def _caja(oeste: float, sur: float, este: float, norte: float) -> dict:
    return {
        "oeste": round(float(oeste), 4),
        "sur": round(float(sur), 4),
        "este": round(float(este), 4),
        "norte": round(float(norte), 4),
    }
