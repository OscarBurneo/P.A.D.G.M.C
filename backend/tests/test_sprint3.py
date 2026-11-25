"""Sprint 3: filtros, leyenda y los pendientes del historial, la auditoría y el resumen."""

import time
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.test_importaciones import _cargar, _csv, _fila


def test_bug6_invalidos_cuentan_rechazadas_y_no_observadas(admin: TestClient) -> None:
    lote = _cargar(
        admin,
        _csv(
            [
                _fila("SOC-OK"),
                _fila("SOC-OBS", provincia="El Oro", latitud="-3.98500", longitud="-79.21000"),
                _fila("SOC-RECH", latitud="40.0", longitud="-70.0"),
                _fila("SOC-RECH2", latitud="41.0", longitud="-71.0"),
            ]
        ),
    )
    assert lote["validos"] == 1
    assert lote["observadas"] == 1
    assert lote["rechazadas"] == 2
    assert lote["invalidos"] == lote["rechazadas"]
    assert lote["invalidos"] != lote["observadas"]
    assert lote["total"] == lote["validos"] + lote["observadas"] + lote["rechazadas"]
    assert lote["cuadra"] is True


def test_bug4_historial_trae_actor_filtros_y_actualizado(admin: TestClient) -> None:
    lote = _cargar(admin, _csv([_fila("SOC-H")]), "historial.csv")
    assert lote["actor"] == "admin"
    assert lote["actualizado_en"]
    antes = lote["actualizado_en"]
    time.sleep(0.02)
    publicado = admin.post(f"/api/importaciones/{lote['id']}/publicar")
    assert publicado.status_code == 200, publicado.text
    assert publicado.json()["actualizado_en"] >= antes
    assert publicado.json()["actor"] == "admin"
    listado = admin.get("/api/importaciones", params={"actor": "admin", "estado": "completado", "texto": "historial"})
    assert listado.status_code == 200, listado.text
    cuerpo = listado.json()
    assert cuerpo["filtros"]["actor"] == "admin"
    assert cuerpo["filtros"]["estado"] == "completado"
    assert [item["id"] for item in cuerpo["lotes"]] == [lote["id"]]
    assert cuerpo["lotes"][0]["actor"] == "admin"
    assert cuerpo["lotes"][0]["actualizado_en"] >= antes
    vacio = admin.get("/api/importaciones", params={"actor": "nadie"})
    assert vacio.json()["lotes"] == []
    invalido = admin.get("/api/importaciones", params={"estado": "inventado"})
    assert invalido.status_code == 422
    assert invalido.json()["codigo"] == "estado_desconocido"


def test_bug5_auditoria_filtra_por_lote_o_entidad_y_pagina(admin: TestClient) -> None:
    lote = _cargar(admin, _csv([_fila("SOC-AUD")]))
    assert admin.post(f"/api/importaciones/{lote['id']}/publicar").status_code == 200
    primera = admin.get("/api/auditoria", params={"lote": lote["id"], "limite": 1, "offset": 0})
    assert primera.status_code == 200, primera.text
    cuerpo = primera.json()
    assert cuerpo["total"] >= 2
    assert cuerpo["limite"] == 1
    assert cuerpo["offset"] == 0
    assert len(cuerpo["eventos"]) == 1
    assert cuerpo["eventos"][0]["entidad_id"] == lote["id"]
    segunda = admin.get("/api/auditoria", params={"lote": lote["id"], "limite": 1, "offset": 1})
    assert segunda.json()["eventos"][0]["id"] != cuerpo["eventos"][0]["id"]
    assert segunda.json()["eventos"][0]["entidad_id"] == lote["id"]
    por_entidad = admin.get("/api/auditoria", params={"entidad": "lote", "lote": lote["id"]})
    assert por_entidad.json()["total"] == cuerpo["total"]
    assert all(evento["entidad_tipo"] == "lote" for evento in por_entidad.json()["eventos"])


def test_filtros_leyenda_zona_y_combinacion(admin: TestClient, db: Session) -> None:
    catalogo = admin.get("/api/mapas/filtros")
    assert catalogo.status_code == 200, catalogo.text
    assert catalogo.json()["propuesto"] is True
    assert catalogo.json()["version"].endswith("propuesto")
    campos = {item["campo"] for item in catalogo.json()["campos"]}
    assert {"provincia", "canton", "agencia", "fecha", "zona"} <= campos
    assert "fecha" in catalogo.json()["dominios"]
    assert "canton_por_provincia" in catalogo.json()["dominios"]
    lote = _cargar(
        admin,
        _csv(
            [
                _fila("SOC-A", agencia="Agencia Centro", fecha="2024-03-15"),
                _fila("SOC-B", agencia="Agencia Norte", latitud="-3.99000", longitud="-79.20000", fecha="2024-06-01"),
                _fila(
                    "SOC-C",
                    latitud="-0.18070",
                    longitud="-78.46780",
                    provincia="Pichincha",
                    canton="Quito",
                    agencia="Agencia Norte",
                    fecha="2024-08-01",
                ),
                _fila("SOC-OBS", provincia="El Oro", latitud="-3.98500", longitud="-79.21000", canton="Catamayo"),
            ]
        ),
    )
    assert admin.post(f"/api/importaciones/{lote['id']}/publicar").status_code == 200
    opciones = admin.get("/api/mapas/filtros").json()["dominios"]
    assert "2024-03-15" in opciones["fecha"]
    assert {"provincia": "Loja", "canton": "Loja"} in opciones["canton_por_provincia"]
    assert "Quito" in {item["canton"] for item in opciones["canton_por_provincia"] if item["provincia"] == "Pichincha"}
    completo = _par(admin)
    assert completo["calor"]["total_registros"] == 3
    assert completo["resumen"]["total_registros"] + completo["resumen"]["registros_sin_zona"] == 3
    assert completo["calor"]["version_datos"] == completo["resumen"]["version_datos"]
    assert completo["calor"]["filtros_activos"] == []
    assert completo["calor"]["leyenda"]["variable"] == "Registros aceptados"
    assert completo["calor"]["leyenda"]["unidad"]
    assert completo["calor"]["leyenda"]["ausencia_datos"] is False
    assert completo["calor"]["leyenda"]["intervalos"]
    assert completo["calor"]["leyenda"]["cero"] != completo["calor"]["leyenda"]["ausencia"]
    indicador = next(
        item for item in completo["resumen"]["indicadores_seleccion"]["metricas"] if item["codigo"] == "total_registros"
    )
    assert indicador["valor"] == 3
    assert indicador["disponible"] is True

    loja = _par(admin, {"zona": "loja"})
    assert loja["calor"]["total_registros"] == 2
    assert loja["resumen"]["total_registros"] == 2
    assert loja["calor"]["version_datos"] == completo["calor"]["version_datos"]
    assert loja["calor"]["filtros_activos"][0]["campo"] == "zona"
    assert loja["calor"]["filtros_activos"][0]["operador"] == "cubre"
    assert "loja" in loja["calor"]["filtros_activos"][0]["valores"]

    combinado = _par(admin, [("zona", "loja"), ("agencia", "Agencia Norte")])
    assert combinado["calor"]["total_registros"] == 1
    assert combinado["resumen"]["indicadores_seleccion"]["metricas"][0]["valor"] == 1
    assert {item["campo"] for item in combinado["resumen"]["filtros_activos"]} == {"zona", "agencia"}

    ambos = _par(admin, [("zona", "loja"), ("zona", "pichincha")])
    assert ambos["calor"]["total_registros"] == 3

    dia = _par(admin, {"fecha_desde": "2024-06-01", "fecha_hasta": "2024-06-01"})
    assert dia["calor"]["total_registros"] == 1
    assert dia["calor"]["filtros_activos"][0]["operador"] == "entre"

    vacio = _par(admin, {"fecha_desde": "2099-01-01"})
    assert vacio["calor"]["total_registros"] == 0
    assert vacio["calor"]["celdas"] == []
    assert vacio["calor"]["leyenda"]["ausencia_datos"] is True
    assert vacio["calor"]["leyenda"]["intervalos"] == []
    assert vacio["resumen"]["seleccion_vacia"] is True
    metricas = {item["codigo"]: item for item in vacio["resumen"]["indicadores_seleccion"]["metricas"]}
    assert metricas["total_registros"]["valor"] == 0
    assert metricas["total_registros"]["disponible"] is True
    assert metricas["agencias"]["disponible"] is False
    assert metricas["agencias"]["valor"] is None

    ajeno = admin.get("/api/mapas/calor", params={"nombre": "Ana"})
    assert ajeno.status_code == 422
    assert ajeno.json()["codigo"] == "filtro_no_autorizado"
    zona = admin.get("/api/mapas/resumen", params={"zona": "atlantis"})
    assert zona.status_code == 422
    assert zona.json()["codigo"] == "zona_desconocida"
    blanco = admin.get("/api/mapas/calor", params={"provincia": ""})
    assert blanco.status_code == 422
    assert blanco.json()["codigo"] == "filtro_invalido"

    db.rollback()
    punto = db.execute(
        text(
            """
            SELECT ST_X(g) AS x, ST_Y(g) AS y
            FROM (
                SELECT ST_PointOnSurface(ST_Boundary(l.geometria)) AS g
                FROM limites_provinciales l
                JOIN cobertura_provincial c ON c.limite_id = l.id
                WHERE c.codigo = 'loja'
            ) s
            """
        )
    ).one()
    dentro = db.execute(
        text(
            """
            SELECT ST_Intersects(l.geometria, ST_SetSRID(ST_MakePoint(:x, :y), 4326))
            FROM limites_provinciales l
            JOIN cobertura_provincial c ON c.limite_id = l.id
            WHERE c.codigo = 'loja'
            """
        ),
        {"x": punto.x, "y": punto.y},
    ).scalar()
    assert dentro is True
    for latitud, longitud in ((punto.y, punto.x), (0, 0)):
        db.execute(
            text(
                """
                INSERT INTO ubicaciones (id, geom, creado_en, lote_id, atributos_socio)
                VALUES (
                    gen_random_uuid(),
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                    now(),
                    :lote,
                    '{"clasificacion": "aceptada", "agencia": "Agencia Centro", "provincia_clave": "loja"}'::jsonb
                )
                """
            ),
            {"lon": longitud, "lat": latitud, "lote": uuid.UUID(lote["id"])},
        )
    db.commit()
    con_limite = admin.get("/api/mapas/calor", params={"zona": "loja"}).json()
    assert con_limite["total_registros"] == 3


def _par(admin: TestClient, params: dict | list | None = None) -> dict:
    calor = admin.get("/api/mapas/calor", params=params)
    resumen = admin.get("/api/mapas/resumen", params=params)
    assert calor.status_code == 200, calor.text
    assert resumen.status_code == 200, resumen.text
    assert calor.json()["version_datos"] == resumen.json()["version_datos"]
    assert calor.json()["filtros_activos"] == resumen.json()["filtros_activos"]
    return {"calor": calor.json(), "resumen": resumen.json()}
