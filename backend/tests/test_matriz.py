"""HU-02: cada celda de la matriz propuesta se prueba directo contra la API."""

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.catalogo import MATRIZ_INICIAL, PERMISOS
from app.principal import app
from app.textos import MENSAJE_PERMISO
from tests.conftest import CONTRASENA, ingresar

CLAVES_PROHIBIDAS = {
    "lat",
    "lon",
    "latitud",
    "longitud",
    "geom",
    "coordinates",
    "hash_contrasena",
    "contrasena",
    "token",
}


@pytest.fixture
def escenario(db: Session):
    with TestClient(app) as administrador, TestClient(app) as registrado:
        ingresar(administrador)
        creado = administrador.post(
            "/api/usuarios",
            json={
                "identificador": "analista",
                "correo": "analista@example.com",
                "nombre": "Analista de prueba",
                "contrasena": CONTRASENA,
                "rol_codigo": "usuario",
            },
        )
        assert creado.status_code == 201, creado.text
        yo = administrador.get("/api/auth/yo").json()
        ingresar(registrado, "analista")
        yield SimpleNamespace(
            administrador=administrador,
            usuario=registrado,
            cuenta=creado.json(),
            admin_id=yo["id"],
            db=db,
        )


def _instantanea(db: Session) -> tuple:
    db.rollback()
    cuentas = db.execute(
        text("SELECT identificador, nombre, correo, activo::text, rol_id::text FROM usuarios ORDER BY identificador")
    ).all()
    enlaces = db.execute(
        text(
            """
            SELECT r.codigo, p.codigo
            FROM rol_permiso rp
            JOIN roles r ON r.id = rp.rol_id
            JOIN permisos p ON p.id = rp.permiso_id
            ORDER BY 1, 2
            """
        )
    ).all()
    return (tuple(cuentas), tuple(enlaces))


def _ejecutar(permiso: str, rol: str, ctx) -> object:
    cliente = ctx.administrador if rol == "administrador" else ctx.usuario
    if permiso == "sesion.cerrar":
        return cliente.post("/api/auth/cerrar-sesion")
    if permiso == "usuarios.leer":
        return cliente.get("/api/usuarios")
    if permiso == "usuarios.crear":
        sufijo = rol[:3]
        return cliente.post(
            "/api/usuarios",
            json={
                "identificador": f"nueva{sufijo}",
                "correo": f"nueva{sufijo}@example.com",
                "nombre": "Cuenta nueva",
                "contrasena": CONTRASENA,
                "rol_codigo": "usuario",
            },
        )
    if permiso == "usuarios.editar":
        objetivo = ctx.cuenta["id"] if rol == "administrador" else ctx.admin_id
        return cliente.patch(f"/api/usuarios/{objetivo}", json={"nombre": "Nombre editado"})
    if permiso == "usuarios.desactivar":
        objetivo = ctx.cuenta["id"] if rol == "administrador" else ctx.admin_id
        return cliente.post(f"/api/usuarios/{objetivo}/desactivar")
    if permiso == "roles.leer":
        return cliente.get("/api/roles")
    if permiso == "roles.asignar":
        if rol == "administrador":
            return cliente.put(
                f"/api/usuarios/{ctx.cuenta['id']}/rol",
                json={"rol_codigo": "administrador"},
            )
        return cliente.put(f"/api/usuarios/{ctx.admin_id}/rol", json={"rol_codigo": "usuario"})
    if permiso == "permisos.leer":
        return cliente.get("/api/permisos")
    if permiso == "permisos.editar":
        if rol == "administrador":
            roles = cliente.get("/api/roles").json()["roles"]
            codigos = next(item["permisos"] for item in roles if item["codigo"] == "usuario")
            return cliente.put("/api/roles/usuario/permisos", json={"permisos": codigos})
        return cliente.put(
            "/api/roles/administrador/permisos",
            json={"permisos": ["sesion.cerrar", "mapas.ver"]},
        )
    if permiso == "auditoria.leer":
        return cliente.get("/api/auditoria")
    if permiso == "mapas.ver":
        return cliente.get("/api/mapas/agregado")
    if permiso == "mapas.detalle":
        return cliente.get("/api/mapas/detalle")
    if permiso == "ubicaciones.consultar":
        return cliente.get("/api/ubicaciones")
    if permiso == "parametros.leer":
        return cliente.get("/api/admin/parametros")
    if permiso == "parametros.editar":
        return cliente.patch(
            "/api/admin/parametros/sesion_duracion_maxima_horas",
            json={"valor": 8},
        )
    if permiso == "analitica.ejemplo":
        return cliente.post("/api/analitica/ejemplo")
    if permiso == "importaciones.cargar":
        return cliente.get("/api/importaciones")
    if permiso == "validacion.consultar":
        return cliente.get("/api/validacion")
    raise AssertionError(permiso)


EXITOS = {
    "sesion.cerrar": {204},
    "usuarios.leer": {200},
    "usuarios.crear": {201},
    "usuarios.editar": {200},
    "usuarios.desactivar": {200},
    "roles.leer": {200},
    "roles.asignar": {200},
    "permisos.leer": {200},
    "permisos.editar": {200},
    "auditoria.leer": {200},
    "mapas.ver": {200},
    "mapas.detalle": {200},
    "ubicaciones.consultar": {200},
    "parametros.leer": {200},
    "parametros.editar": {200},
    "analitica.ejemplo": {200},
    "importaciones.cargar": {200},
    "validacion.consultar": {501},
}


def _claves(valor: object):
    if isinstance(valor, dict):
        for clave, item in valor.items():
            yield clave.casefold()
            yield from _claves(item)
    elif isinstance(valor, list):
        for item in valor:
            yield from _claves(item)


@pytest.mark.parametrize("rol", ["administrador", "usuario"])
@pytest.mark.parametrize("permiso", [item[0] for item in PERMISOS])
def test_celda_de_la_matriz(escenario, rol: str, permiso: str) -> None:
    permitido = permiso in MATRIZ_INICIAL[rol]
    antes = None if permitido else _instantanea(escenario.db)
    respuesta = _ejecutar(permiso, rol, escenario)
    if respuesta.status_code != 204:
        cuerpo = respuesta.json()
        assert CLAVES_PROHIBIDAS.isdisjoint(_claves(cuerpo))
        assert "ClaveSegura123" not in json.dumps(cuerpo)
    if permitido:
        assert respuesta.status_code in EXITOS[permiso], respuesta.text
    else:
        assert respuesta.status_code == 403, respuesta.text
        assert respuesta.json()["detalle"] == MENSAJE_PERMISO
        assert _instantanea(escenario.db) == antes


def test_anonimo_no_entra_a_rutas_protegidas(cliente: TestClient) -> None:
    assert cliente.get("/api/mapas/agregado").status_code == 401
    assert cliente.get("/api/usuarios").status_code == 401
    assert cliente.get("/api/auth/yo").status_code == 401
