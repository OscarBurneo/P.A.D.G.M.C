"""HU-01 y HU-03. Reglas RG-AUTH-01 a RG-AUTH-04."""

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.configuracion import ajustes
from app.textos import MENSAJE_CREDENCIALES, MENSAJE_SESION
from tests.conftest import CONTRASENA, ingresar


def test_login_valido_crea_sesion_y_cookie(cliente: TestClient, db: Session) -> None:
    respuesta = cliente.post(
        "/api/auth/iniciar-sesion",
        json={"identificador": "Admin", "contrasena": CONTRASENA},
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["identificador"] == "admin"
    assert "administrador" == cuerpo["rol"]["codigo"]
    assert "usuarios.crear" in cuerpo["permisos"]
    assert "hash_contrasena" not in cuerpo
    cookie = respuesta.headers["set-cookie"].casefold()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "secure" not in cookie
    assert cliente.get("/api/auth/yo").status_code == 200
    hash_guardado = db.execute(text("SELECT hash_contrasena FROM usuarios WHERE identificador = 'admin'")).scalar()
    assert str(hash_guardado).startswith("$argon2id$")
    assert CONTRASENA not in str(hash_guardado)


def test_credenciales_invalidas_cuentan_el_mismo_mensaje(cliente: TestClient, db: Session) -> None:
    db.execute(
        text(
            """
            INSERT INTO usuarios (
                id, identificador, correo, nombre, hash_contrasena, rol_id, activo, creado_en, actualizado_en
            )
            SELECT gen_random_uuid(), 'inactivo', 'inactivo@example.com', 'Inactivo', hash_contrasena,
                   rol_id, false, now(), now()
            FROM usuarios WHERE identificador = 'admin'
            """
        )
    )
    db.commit()
    mensajes = set()
    for identificador, contrasena in (
        ("nadie", CONTRASENA),
        ("admin", "ClaveMala123"),
        ("inactivo", CONTRASENA),
    ):
        respuesta = cliente.post(
            "/api/auth/iniciar-sesion",
            json={"identificador": identificador, "contrasena": contrasena},
        )
        assert respuesta.status_code == 401
        assert "set-cookie" not in respuesta.headers
        mensajes.add(respuesta.json()["detalle"])
    assert mensajes == {MENSAJE_CREDENCIALES}
    sesiones = db.execute(text("SELECT count(*) FROM sesiones")).scalar()
    db.rollback()
    sesiones = db.execute(text("SELECT count(*) FROM sesiones")).scalar()
    assert sesiones == 0


def test_cierre_invalida_el_identificador(cliente: TestClient) -> None:
    ingresar(cliente)
    token = cliente.cookies.get("padgmc_sesion")
    assert token
    assert cliente.post("/api/auth/cerrar-sesion").status_code == 204
    cliente.cookies.set("padgmc_sesion", token)
    respuesta = cliente.get("/api/auth/yo")
    assert respuesta.status_code == 401
    assert respuesta.json()["detalle"] == MENSAJE_SESION


def test_inactividad_e_expiracion(cliente: TestClient, db: Session) -> None:
    ingresar(cliente)
    db.execute(text("UPDATE sesiones SET ultimo_uso_en = now() - interval '31 minutes'"))
    db.commit()
    assert cliente.get("/api/auth/yo").status_code == 401
    db.rollback()
    assert db.execute(text("SELECT motivo_revocacion FROM sesiones")).scalar() == "inactividad"

    ingresar(cliente)
    db.execute(text("UPDATE sesiones SET expira_en = now() - interval '1 minute'"))
    db.commit()
    assert cliente.get("/api/auth/yo").status_code == 401
    db.rollback()
    motivos = db.execute(text("SELECT motivo_revocacion FROM sesiones ORDER BY creada_en")).scalars().all()
    assert "expiracion" in motivos


def test_http_no_acepta_credenciales_en_produccion(cliente: TestClient) -> None:
    anterior = ajustes.entorno
    proxy = ajustes.confiar_proxy
    ajustes.entorno = "produccion"
    ajustes.confiar_proxy = False
    try:
        rechazo = cliente.post(
            "/api/auth/iniciar-sesion",
            json={"identificador": "admin", "contrasena": CONTRASENA},
        )
        assert rechazo.status_code == 400
        ajustes.confiar_proxy = True
        aceptada = cliente.post(
            "/api/auth/iniciar-sesion",
            json={"identificador": "admin", "contrasena": CONTRASENA},
            headers={"X-Forwarded-Proto": "https"},
        )
        assert aceptada.status_code == 200
        assert "secure" in aceptada.headers["set-cookie"].casefold()
    finally:
        ajustes.entorno = anterior
        ajustes.confiar_proxy = proxy
