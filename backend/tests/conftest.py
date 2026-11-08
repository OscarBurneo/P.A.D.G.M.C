"""Entorno de prueba contra PostgreSQL/PostGIS, antes de importar la aplicación."""

import os
from collections.abc import Iterator
from pathlib import Path

os.environ["ENTORNO"] = "prueba"
os.environ["BASE_DATOS_URL"] = "postgresql+psycopg://padgmc:padgmc_prueba@localhost:5432/padgmc"
os.environ["ADMIN_IDENTIFICADOR"] = "admin"
os.environ["ADMIN_NOMBRE"] = "Administrador inicial"
os.environ["ADMIN_CORREO"] = "admin@example.com"
os.environ["ADMIN_CONTRASENA"] = "ClaveSegura123"
os.environ["ARGON2_TIME_COST"] = "1"
os.environ["ARGON2_MEMORY_COST"] = "19456"
os.environ["ARGON2_PARALLELISM"] = "1"
os.environ["COOKIE_SECURE"] = "false"
os.environ["CONFIAR_PROXY"] = "false"
os.environ["SEMBRAR_AL_INICIAR"] = "false"
os.environ["SESION_INACTIVIDAD_MINUTOS"] = "30"
os.environ["SESION_DURACION_MAXIMA_HORAS"] = "8"
os.environ["CONTRASENA_LONGITUD_MINIMA"] = "10"
os.environ["PROTEGER_ULTIMA_CUENTA_ADMIN"] = "true"
os.environ["COOKIE_SAMESITE"] = "lax"

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from alembic import command
from app.base_datos import SesionLocal
from app.configuracion import obtener_ajustes

obtener_ajustes.cache_clear()

from app.principal import app  # noqa: E402
from app.semilla import sembrar  # noqa: E402

CONTRASENA = "ClaveSegura123"
RAIZ_BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session", autouse=True)
def migracion() -> None:
    configuracion = Config(str(RAIZ_BACKEND / "alembic.ini"))
    command.upgrade(configuracion, "head")


@pytest.fixture
def db(migracion: None) -> Iterator[Session]:
    _preparar()
    sesion = SesionLocal()
    try:
        yield sesion
    finally:
        sesion.close()


@pytest.fixture
def cliente(db: Session) -> Iterator[TestClient]:
    with TestClient(app) as prueba:
        yield prueba


def _preparar() -> None:
    sesion = SesionLocal()
    try:
        sesion.execute(text("ALTER TABLE eventos_auditoria DISABLE TRIGGER auditoria_append_only"))
        sesion.execute(text("DELETE FROM eventos_auditoria"))
        sesion.execute(text("ALTER TABLE eventos_auditoria ENABLE TRIGGER auditoria_append_only"))
        sesion.execute(text("DELETE FROM sesiones"))
        sesion.execute(text("DELETE FROM usuarios"))
        sesion.execute(text("DELETE FROM rol_permiso"))
        sesion.execute(text("DELETE FROM matrices_acceso"))
        sesion.execute(text("DELETE FROM parametros"))
        sesion.execute(text("DELETE FROM ubicaciones"))
        sesion.commit()
        sembrar(sesion)
    finally:
        sesion.close()


@pytest.fixture
def admin(cliente: TestClient) -> TestClient:
    ingresar(cliente)
    return cliente


def ingresar(cliente: TestClient, identificador: str = "admin", contrasena: str = CONTRASENA) -> dict:
    respuesta = cliente.post(
        "/api/auth/iniciar-sesion",
        json={"identificador": identificador, "contrasena": contrasena},
    )
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()
