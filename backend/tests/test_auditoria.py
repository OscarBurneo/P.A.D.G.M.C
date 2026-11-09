"""HU-47: eventos de éxito y fallo, con actor y sin secretos, append-only."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.modelos import EventoAuditoria
from tests.conftest import CONTRASENA


def test_exito_y_fallo_dejan_actor_y_antes_despues(admin: TestClient, db: Session) -> None:
    creada = admin.post(
        "/api/usuarios",
        json={
            "identificador": "analista",
            "correo": "analista@example.com",
            "nombre": "Analista de prueba",
            "contrasena": CONTRASENA,
            "rol_codigo": "usuario",
        },
    )
    assert creada.status_code == 201
    admin.post(
        "/api/usuarios",
        json={
            "identificador": "analista",
            "correo": "otra@example.com",
            "nombre": "Otra",
            "contrasena": CONTRASENA,
            "rol_codigo": "usuario",
        },
    )
    admin.post(
        "/api/auth/iniciar-sesion",
        json={"identificador": "desconocido", "contrasena": CONTRASENA},
    )
    db.rollback()
    eventos = db.execute(
        text(
            """
            SELECT operacion, resultado, actor_etiqueta, coalesce(antes::text, ''),
                   coalesce(despues::text, ''), coalesce(mensaje, '')
            FROM eventos_auditoria
            """
        )
    ).all()
    operaciones = {(fila[0], fila[1]) for fila in eventos}
    assert ("usuarios.crear", "exito") in operaciones
    assert ("usuarios.crear", "fallo") in operaciones
    assert ("auth.iniciar_sesion", "fallo") in operaciones
    assert all(fila[2].strip() for fila in eventos)
    texto = "\n".join(" ".join(fila) for fila in eventos)
    assert CONTRASENA not in texto
    assert "hash_contrasena" not in texto
    exito = next(fila for fila in eventos if fila[0] == "usuarios.crear" and fila[1] == "exito")
    assert "analista" in exito[4]
    assert "usuario" in exito[4]


def test_la_aplicacion_no_puede_modificar_ni_borrar_eventos(admin: TestClient, db: Session) -> None:
    assert admin.get("/api/auditoria").status_code == 200
    rutas = admin.app.openapi()["paths"]
    for ruta, metodos in rutas.items():
        if ruta.startswith("/api/auditoria"):
            assert "delete" not in metodos
            assert "put" not in metodos
            assert "patch" not in metodos
    db.rollback()
    evento_id = db.execute(text("SELECT id FROM eventos_auditoria LIMIT 1")).scalar()
    assert evento_id is not None
    with pytest.raises(DBAPIError):
        db.execute(update(EventoAuditoria).where(EventoAuditoria.id == evento_id).values(mensaje="alterado"))
    db.rollback()
    with pytest.raises(DBAPIError):
        db.execute(text("DELETE FROM eventos_auditoria"))
    db.rollback()
    with pytest.raises(DBAPIError):
        db.execute(text("TRUNCATE eventos_auditoria"))
    db.rollback()
    sigue = db.execute(text("SELECT count(*) FROM eventos_auditoria")).scalar()
    assert sigue and sigue > 0


def test_el_codigo_de_la_aplicacion_no_desactiva_el_disparador() -> None:
    raiz = Path(__file__).resolve().parents[1] / "app"
    for ruta in raiz.rglob("*.py"):
        texto = ruta.read_text(encoding="utf-8")
        assert "DISABLE TRIGGER" not in texto
        assert "DELETE FROM eventos_auditoria" not in texto
        assert "TRUNCATE eventos_auditoria" not in texto.upper() or "impedir_truncate" in texto
