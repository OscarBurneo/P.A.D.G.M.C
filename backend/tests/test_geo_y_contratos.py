"""PostGIS, SRID 4326, contrato analítico y ausencia de h3-pg en esta imagen."""

from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modulos.analitica.interfaz import VERSION_INTERFAZ, ejecutar_ejemplo


def test_postgis_srid_y_punto_conocido(db: Session) -> None:
    version = db.execute(text("SELECT PostGIS_Version()")).scalar()
    assert version
    srid = db.execute(text("SELECT srid FROM geometry_columns WHERE f_table_name = 'ubicaciones'")).scalar()
    tipo = db.execute(text("SELECT type FROM geometry_columns WHERE f_table_name = 'ubicaciones'")).scalar()
    assert srid == 4326
    assert tipo == "POINT"
    db.execute(
        text(
            """
            INSERT INTO ubicaciones (id, geom)
            VALUES (gen_random_uuid(), ST_SetSRID(ST_MakePoint(-79.20422, -3.99313), 4326))
            """
        )
    )
    fila = db.execute(
        text("SELECT ST_X(geom) AS longitud, ST_Y(geom) AS latitud, ST_SRID(geom) AS srid FROM ubicaciones")
    ).one()
    assert fila.srid == 4326
    assert abs(fila.longitud - -79.20422) < 0.000001
    assert abs(fila.latitud - -3.99313) < 0.000001
    db.rollback()


def test_h3_no_esta_en_la_imagen_oficial_y_queda_documentado(cliente: TestClient, db: Session) -> None:
    salud = cliente.get("/api/salud")
    assert salud.status_code == 200
    cuerpo = salud.json()
    assert cuerpo["srid_referencia"] == 4326
    disponible = bool(
        db.execute(text("SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'h3')")).scalar()
    )
    assert cuerpo["h3_disponible"] is disponible
    documento = Path(__file__).resolve().parents[2] / "docs" / "ARQUITECTURA.md"
    assert "h3-pg" in documento.read_text(encoding="utf-8")


def test_proceso_de_ejemplo_no_cambia_contratos_de_auth(cliente: TestClient) -> None:
    resultado = ejecutar_ejemplo(0)
    assert resultado.total == 0
    assert resultado.version_interfaz == VERSION_INTERFAZ
    rutas = cliente.app.openapi()["paths"]
    assert "/api/auth/iniciar-sesion" in rutas
    assert "/api/auth/cerrar-sesion" in rutas
    assert "/api/auth/yo" in rutas
    assert "post" in rutas["/api/analitica/ejemplo"]


def test_agregado_no_trae_coordenadas(admin: TestClient) -> None:
    respuesta = admin.get("/api/mapas/agregado")
    assert respuesta.status_code == 200
    assert respuesta.json()["celdas_h3"] == []
    assert "latitud" not in respuesta.text
    assert "longitud" not in respuesta.text
