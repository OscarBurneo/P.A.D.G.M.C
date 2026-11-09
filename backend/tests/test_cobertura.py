"""Límites ADM1, SRID 4326 y cobertura provincial configurable."""

import json
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modulos.cobertura.datos import DIRECTORIO
from tests.conftest import CONTRASENA, ingresar

CODIGOS_INICIALES = (
    "loja",
    "el-oro",
    "zamora-chinchipe",
    "pichincha",
    "santo-domingo-de-los-tsachilas",
    "manabi",
    "chimborazo",
    "guayas",
)


def test_limites_en_4326_y_galapagos_aparte(db: Session) -> None:
    srid = db.execute(text("SELECT DISTINCT ST_SRID(geometria) FROM limites_provinciales")).scalars().all()
    tipos = db.execute(text("SELECT DISTINCT ST_GeometryType(geometria) FROM limites_provinciales")).scalars().all()
    assert srid == [4326]
    assert tipos == ["ST_MultiPolygon"]
    total = db.execute(text("SELECT count(*) FROM limites_provinciales")).scalar()
    assert total == 24
    invalidos = db.execute(text("SELECT count(*) FROM limites_provinciales WHERE NOT ST_IsValid(geometria)")).scalar()
    assert invalidos == 0
    galapagos = db.execute(text("SELECT count(*) FROM limites_provinciales WHERE es_galapagos")).scalar()
    assert galapagos == 1
    columna = db.execute(
        text(
            """
            SELECT type, srid
            FROM geometry_columns
            WHERE f_table_name = 'limites_provinciales'
            """
        )
    ).one()
    assert columna.type == "MULTIPOLYGON"
    assert columna.srid == 4326


def test_cobertura_inicial_sale_del_archivo_de_configuracion(db: Session) -> None:
    configuracion = json.loads((DIRECTORIO / "cobertura_inicial.json").read_text(encoding="utf-8"))
    assert [item["codigo"] for item in configuracion] == list(CODIGOS_INICIALES)
    filas = db.execute(text("SELECT codigo, nombre, activa FROM cobertura_provincial ORDER BY orden")).all()
    assert [fila.codigo for fila in filas] == [item["codigo"] for item in configuracion]
    assert all(fila.activa for fila in filas)
    assert any(fila.nombre == "Manabí" for fila in filas)
    fuente = (DIRECTORIO / "FUENTE.md").read_text(encoding="utf-8")
    assert "CC0 1.0" in fuente
    assert "geoBoundaries" in fuente
    assert Path(DIRECTORIO / "ecuador-adm1.geojson").is_file()


def test_encuadre_continental_no_incluye_galapagos(admin: TestClient) -> None:
    respuesta = admin.get("/api/cobertura/provincias", params={"contorno": False})
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["fuente"]["licencia"].startswith("CC0")
    assert cuerpo["fuente"]["srid"] == 4326
    continental = cuerpo["encuadre_continental"]
    galapagos = cuerpo["recuadro_galapagos"]
    assert continental["oeste"] > -84
    assert continental["este"] < -74
    assert continental["sur"] > -6
    assert continental["norte"] < 2.5
    assert galapagos["oeste"] < -88
    assert len(cuerpo["provincias"]) == 24
    con_agencia = [item["codigo"] for item in cuerpo["provincias"] if item["con_agencia"]]
    assert con_agencia == list(CODIGOS_INICIALES)
    pichincha = next(item for item in cuerpo["provincias"] if item["codigo"] == "pichincha")
    assert "Quito" in pichincha["nota"]
    assert "contorno" not in pichincha
    assert "latitud" not in respuesta.text
    assert "longitud" not in respuesta.text


def test_el_contorno_viaja_en_geojson(admin: TestClient) -> None:
    respuesta = admin.get("/api/cobertura/provincias")
    assert respuesta.status_code == 200
    loja = next(item for item in respuesta.json()["provincias"] if item["codigo"] == "loja")
    assert loja["contorno"]["type"] == "MultiPolygon"
    assert loja["contorno"]["coordinates"]


def test_resumen_real_esta_vacio_y_agrupa_la_cobertura(admin: TestClient) -> None:
    respuesta = admin.get("/api/mapas/resumen")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total_registros"] == 0
    assert cuerpo["calidad_registros"] is None
    assert [item["codigo"] for item in cuerpo["provincias"]] == list(CODIGOS_INICIALES)
    assert all(item["registros"] == 0 and item["cantones"] == [] for item in cuerpo["provincias"])
    assert "coordinates" not in respuesta.text
    assert "latitud" not in respuesta.text


def test_usuario_ve_el_mapa_y_no_cambia_la_cobertura(cliente: TestClient) -> None:
    admin = cliente
    ingresar(admin)
    creado = admin.post(
        "/api/usuarios",
        json={
            "identificador": "visor",
            "correo": "visor@example.com",
            "nombre": "Visor de mapa",
            "contrasena": CONTRASENA,
            "rol_codigo": "usuario",
        },
    )
    assert creado.status_code == 201, creado.text
    with TestClient(admin.app) as visor:
        ingresar(visor, "visor")
        lectura = visor.get("/api/cobertura/provincias", params={"contorno": False})
        assert lectura.status_code == 200
        cambio = visor.patch("/api/cobertura/provincias/loja", json={"activa": False})
        assert cambio.status_code == 403


def test_la_cobertura_se_edita_sin_tocar_el_codigo(admin: TestClient) -> None:
    apagada = admin.patch("/api/cobertura/provincias/loja", json={"activa": False})
    assert apagada.status_code == 200
    assert apagada.json()["con_agencia"] is False
    listado = admin.get("/api/mapas/resumen")
    codigos = [item["codigo"] for item in listado.json()["provincias"]]
    assert "loja" not in codigos
    assert len(codigos) == 7
    nueva = admin.patch("/api/cobertura/provincias/pastaza", json={"activa": True})
    assert nueva.status_code == 200
    assert nueva.json()["con_agencia"] is True
    assert nueva.json()["codigo"] == "pastaza"
    otra = admin.get("/api/mapas/resumen").json()
    assert "pastaza" in [item["codigo"] for item in otra["provincias"]]
    desconocida = admin.patch("/api/cobertura/provincias/atlantida", json={"activa": True})
    assert desconocida.status_code == 404
