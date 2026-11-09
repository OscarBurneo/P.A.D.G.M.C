"""HU-40, HU-41, HU-42 y HU-70."""

import json

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.principal import app
from app.textos import MENSAJE_CREDENCIALES, MENSAJE_PERMISO
from tests.conftest import CONTRASENA, ingresar


def _crear(cliente: TestClient, identificador: str = "analista", rol: str = "usuario") -> dict:
    respuesta = cliente.post(
        "/api/usuarios",
        json={
            "identificador": identificador,
            "correo": f"{identificador}@example.com",
            "nombre": "Analista de prueba",
            "contrasena": CONTRASENA,
            "rol_codigo": rol,
        },
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def test_alta_consulta_edicion_y_duplicado(admin: TestClient, db: Session) -> None:
    cliente = admin
    cuenta = _crear(cliente)
    assert cuenta["identificador"] == "analista"
    assert "hash_contrasena" not in json.dumps(cuenta)
    listado = cliente.get("/api/usuarios").json()
    assert listado["diccionario"]["estado_aprobacion"] == "pendiente_de_aprobacion"
    editada = cliente.patch(f"/api/usuarios/{cuenta['id']}", json={"nombre": "Analista editado"})
    assert editada.status_code == 200
    assert editada.json()["nombre"] == "Analista editado"
    duplicada = cliente.post(
        "/api/usuarios",
        json={
            "identificador": "analista",
            "correo": "otra@example.com",
            "nombre": "Otra",
            "contrasena": CONTRASENA,
            "rol_codigo": "usuario",
        },
    )
    assert duplicada.status_code == 409
    invalida = cliente.patch(f"/api/usuarios/{cuenta['id']}", json={"nombre": "A"})
    assert invalida.status_code == 422
    db.rollback()
    nombre = db.execute(text("SELECT nombre FROM usuarios WHERE identificador = 'analista'")).scalar()
    assert nombre == "Analista editado"
    total = db.execute(text("SELECT count(*) FROM usuarios WHERE identificador = 'analista'")).scalar()
    assert total == 1


def test_sin_permiso_no_modifica(db: Session) -> None:
    with TestClient(app) as admin, TestClient(app) as limitado:
        ingresar(admin)
        cuenta = _crear(admin)
        ingresar(limitado, "analista")
        antes = db.execute(text("SELECT count(*) FROM usuarios")).scalar()
        db.rollback()
        antes = db.execute(text("SELECT count(*) FROM usuarios")).scalar()
        respuesta = limitado.post(
            "/api/usuarios",
            json={
                "identificador": "intruso",
                "correo": "intruso@example.com",
                "nombre": "Intruso",
                "contrasena": CONTRASENA,
                "rol_codigo": "administrador",
            },
        )
        assert respuesta.status_code == 403
        assert respuesta.json()["detalle"] == MENSAJE_PERMISO
        edicion = limitado.patch(f"/api/usuarios/{cuenta['id']}", json={"nombre": "Hackeado"})
        assert edicion.status_code == 403
        db.rollback()
        assert db.execute(text("SELECT count(*) FROM usuarios")).scalar() == antes
        assert (
            db.execute(text("SELECT nombre FROM usuarios WHERE identificador = 'analista'")).scalar()
            == "Analista de prueba"
        )


def test_cambio_de_rol_es_inmediato_y_protege_la_ultima_cuenta(db: Session) -> None:
    with TestClient(app) as admin, TestClient(app) as persona:
        ingresar(admin)
        cuenta = _crear(admin)
        yo = admin.get("/api/auth/yo").json()
        ingresar(persona, "analista")
        assert persona.get("/api/usuarios").status_code == 403
        cambio = admin.put(f"/api/usuarios/{cuenta['id']}/rol", json={"rol_codigo": "administrador"})
        assert cambio.status_code == 200
        assert persona.get("/api/usuarios").status_code == 200
        regreso = admin.put(f"/api/usuarios/{cuenta['id']}/rol", json={"rol_codigo": "usuario"})
        assert regreso.status_code == 200
        assert persona.get("/api/usuarios").status_code == 403
        bloqueo = admin.put(f"/api/usuarios/{yo['id']}/rol", json={"rol_codigo": "usuario"})
        assert bloqueo.status_code == 409
        assert admin.get("/api/auth/yo").json()["rol"]["codigo"] == "administrador"


def test_permisos_por_rol_aplican_en_la_siguiente_solicitud(db: Session) -> None:
    del db
    with TestClient(app) as admin, TestClient(app) as persona:
        ingresar(admin)
        _crear(admin)
        ingresar(persona, "analista")
        assert persona.get("/api/auditoria").status_code == 403
        roles = admin.get("/api/roles").json()
        assert roles["estado_aprobacion"] == "pendiente_de_aprobacion"
        assert roles["matriz"]["version"] == "0.1.0-propuesta"
        actuales = next(rol["permisos"] for rol in roles["roles"] if rol["codigo"] == "usuario")
        ampliados = sorted(set(actuales) | {"auditoria.leer"})
        cambio = admin.put("/api/roles/usuario/permisos", json={"permisos": ampliados})
        assert cambio.status_code == 200
        assert persona.get("/api/auditoria").status_code == 200
        admin.put("/api/roles/usuario/permisos", json={"permisos": actuales})
        assert persona.get("/api/auditoria").status_code == 403
        irrevocable = admin.put("/api/roles/administrador/permisos", json={"permisos": ["sesion.cerrar", "mapas.ver"]})
        assert irrevocable.status_code == 409


def test_desactivar_revoca_todas_las_sesiones_y_bloquea_el_login(db: Session) -> None:
    with (
        TestClient(app) as admin,
        TestClient(app) as sesion_a,
        TestClient(app) as sesion_b,
    ):
        ingresar(admin)
        cuenta = _crear(admin)
        ingresar(sesion_a, "analista")
        ingresar(sesion_b, "analista")
        denegada = sesion_a.post(f"/api/usuarios/{cuenta['id']}/desactivar")
        assert denegada.status_code == 403
        assert sesion_b.get("/api/auth/yo").status_code == 200
        hecha = admin.post(f"/api/usuarios/{cuenta['id']}/desactivar")
        assert hecha.status_code == 200
        assert hecha.json()["activo"] is False
        assert sesion_a.get("/api/auth/yo").status_code == 401
        assert sesion_b.get("/api/auth/yo").status_code == 401
        reingreso = sesion_a.post(
            "/api/auth/iniciar-sesion",
            json={"identificador": "analista", "contrasena": CONTRASENA},
        )
        assert reingreso.status_code == 401
        assert reingreso.json()["detalle"] == MENSAJE_CREDENCIALES
        db.rollback()
        revocadas = db.execute(
            text(
                """
                SELECT count(*) FROM sesiones s
                JOIN usuarios u ON u.id = s.usuario_id
                WHERE u.identificador = 'analista' AND s.motivo_revocacion = 'cuenta_desactivada'
                """
            )
        ).scalar()
        assert revocadas == 2
        ultima = admin.post(f"/api/usuarios/{admin.get('/api/auth/yo').json()['id']}/desactivar")
        assert ultima.status_code == 409
        assert admin.get("/api/auth/yo").status_code == 200


def test_sal_distinta_para_la_misma_contrasena(cliente: TestClient, db: Session) -> None:
    ingresar(cliente)
    _crear(cliente, "analista")
    _crear(cliente, "otra")
    db.rollback()
    hashes = (
        db.execute(text("SELECT hash_contrasena FROM usuarios WHERE identificador IN ('analista', 'otra')"))
        .scalars()
        .all()
    )
    assert len(hashes) == 2
    assert hashes[0] != hashes[1]
    assert all(str(item).startswith("$argon2id$") for item in hashes)


def test_parametro_invalido_no_reemplaza_el_vigente(cliente: TestClient) -> None:
    ingresar(cliente)
    antes = cliente.get("/api/admin/parametros").json()
    texto = json.dumps(antes)
    assert "ClaveSegura123" not in texto
    assert "padgmc_prueba" not in texto
    assert antes["perfil_hash"]["algoritmo"] == "argon2id"
    assert antes["perfil_hash"]["estado_aprobacion"] == "pendiente_de_aprobacion"
    rechazo = cliente.patch("/api/admin/parametros/sesion_inactividad_minutos", json={"valor": 1})
    assert rechazo.status_code == 422
    despues = cliente.get("/api/admin/parametros").json()
    vigente = next(item["valor"] for item in despues["parametros"] if item["clave"] == "sesion_inactividad_minutos")
    assert vigente == 30
