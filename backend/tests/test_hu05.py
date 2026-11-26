"""HU-05: una ubicación se valida con las reglas del contrato antes de guardarse."""

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.principal import app
from tests.conftest import CONTRASENA, ingresar
from tests.test_importaciones import _cargar, _csv, _fila

_VALIDA = {
    "identificador_socio": "HU05-1",
    "nombre": "Ana Pérez",
    "latitud": -3.99313,
    "longitud": -79.20422,
    "provincia": "Loja",
    "canton": "Loja",
    "agencia": "Agencia Centro",
    "fecha": "2024-03-15",
}


def _enviar(admin: TestClient, **cambios):
    cuerpo = {**_VALIDA, **cambios}
    return admin.post("/api/ubicaciones", json=cuerpo)


def _reglas(respuesta) -> set[str]:
    return {error["regla"] for error in respuesta.json()["errores"]}


def test_guarda_una_ubicacion_valida_y_normaliza_fecha_y_decimal(admin: TestClient, db: Session) -> None:
    respuesta = admin.post(
        "/api/ubicaciones",
        json={
            **_VALIDA,
            "identificador_socio": "HU05-NORMA",
            "latitud": "-3,98313",
            "longitud": "-79.19422",
            "fecha": "15/03/2024",
            "nombre": "  Ana   Pérez  ",
        },
    )
    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["clasificacion"] == "aceptada"
    assert cuerpo["contrato_version"] == "0.1.0-propuesto"
    assert cuerpo["ubicacion"]["fecha"] == "2024-03-15"
    assert cuerpo["ubicacion"]["nombre"] == "Ana Pérez"
    assert cuerpo["ubicacion"]["provincia"] == "Loja"
    db.rollback()
    fila = db.execute(
        text(
            """
            SELECT ST_Y(geom) AS latitud, atributos_socio->>'clasificacion' AS clasificacion, lote_id
            FROM ubicaciones
            WHERE atributos_socio->>'identificador_socio' = 'HU05-NORMA'
            """
        )
    ).one()
    assert fila.lote_id is None
    assert fila.clasificacion == "aceptada"
    assert abs(float(fila.latitud) - (-3.98313)) < 0.00001
    assert admin.get("/api/ubicaciones").json()["total_registros"] == 1


def test_no_guarda_obligatorio_tipo_formato_ni_rango(admin: TestClient, db: Session) -> None:
    vacio = _enviar(admin, nombre="  ")
    assert vacio.status_code == 422, vacio.text
    assert vacio.json()["codigo"] == "ubicacion_invalida"
    assert "obligatorio_nombre" in _reglas(vacio)
    nombre = next(error for error in vacio.json()["errores"] if error["campo"] == "nombre")
    assert nombre["mensaje"]
    assert nombre["accion"]

    tipo = _enviar(admin, identificador_socio="HU05-TIPO", latitud=["no"])
    assert tipo.status_code == 422, tipo.text
    assert "tipo_decimal" in _reglas(tipo)

    formato = _enviar(admin, identificador_socio="HU05-FMT", latitud="norte", longitud="oeste")
    assert formato.status_code == 422
    assert {"formato_latitud", "formato_longitud"} <= _reglas(formato)

    rango = _enviar(admin, identificador_socio="HU05-RANGO", latitud=91, longitud=-79.2)
    assert rango.status_code == 422
    assert "formato_latitud" in _reglas(rango)

    fecha = _enviar(admin, identificador_socio="HU05-FECHA", fecha="ayer")
    assert fecha.status_code == 422
    assert "formato_fecha" in _reglas(fecha)

    formula = _enviar(admin, identificador_socio="HU05-FORMULA", agencia="=Agencia")
    assert formula.status_code == 422
    assert any(
        error["campo"] == "agencia" and error["regla"] == "formato_formula"
        for error in formula.json()["errores"]
    )

    db.rollback()
    assert db.execute(text("SELECT count(*) FROM ubicaciones")).scalar() == 0


def test_rechaza_fuera_de_ecuador_provincia_y_duplicados(admin: TestClient, db: Session) -> None:
    fuera = _enviar(admin, identificador_socio="HU05-FUERA", latitud=40, longitud=-70)
    assert fuera.status_code == 422, fuera.text
    assert "coordenada_fuera_de_ecuador" in _reglas(fuera)

    otra = _enviar(admin, identificador_socio="HU05-OTRA", provincia="Pichincha", canton="Quito")
    assert otra.status_code == 422, otra.text
    assert "provincia_no_coincide" in _reglas(otra)

    primera = _enviar(admin, identificador_socio="HU05-DUP")
    assert primera.status_code == 201, primera.text
    repetido = _enviar(admin, identificador_socio="HU05-DUP", latitud=-3.98, longitud=-79.19)
    assert repetido.status_code == 422, repetido.text
    assert "identificador_duplicado" in _reglas(repetido)

    coincidente = _enviar(
        admin,
        identificador_socio="HU05-CERCA",
        latitud=-3.99314,
        longitud=-79.20422,
    )
    assert coincidente.status_code == 422, coincidente.text
    assert "ubicacion_coincidente" in _reglas(coincidente)

    db.rollback()
    assert db.execute(text("SELECT count(*) FROM ubicaciones")).scalar() == 1


def test_el_identificador_de_un_lote_publicado_tambien_bloquea_el_alta(admin: TestClient) -> None:
    lote = _cargar(admin, _csv([_fila("HU05-LOTE")]))
    assert admin.post(f"/api/importaciones/{lote['id']}/publicar").status_code == 200
    respuesta = _enviar(admin, identificador_socio="HU05-LOTE", latitud=-3.97, longitud=-79.18)
    assert respuesta.status_code == 422, respuesta.text
    assert "identificador_duplicado" in _reglas(respuesta)


def test_sin_permiso_de_publicar_no_guarda(admin: TestClient) -> None:
    creado = admin.post(
        "/api/usuarios",
        json={
            "identificador": "consulta",
            "correo": "consulta@example.com",
            "nombre": "Consulta",
            "contrasena": CONTRASENA,
            "rol_codigo": "usuario",
        },
    )
    assert creado.status_code == 201, creado.text
    with TestClient(app) as cliente:
        ingresar(cliente, "consulta")
        respuesta = cliente.post("/api/ubicaciones", json=_VALIDA)
    assert respuesta.status_code == 403, respuesta.text
    assert admin.get("/api/ubicaciones").json()["total_registros"] == 0
