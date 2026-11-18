"""Sprint 2: importación, validación, publicación y el índice provincial."""

import csv
import io
import time
import uuid
from pathlib import Path

from alembic.config import Config
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import text
from sqlalchemy.orm import Session

from alembic import command
from app.modulos.importaciones.contrato import VERSION_CONTRATO, clave_ubicacion
from tests.conftest import CONTRASENA, RAIZ_BACKEND, ingresar

ENCABEZADO = "identificador_socio,nombre,latitud,longitud,provincia,canton,agencia,fecha"


def _csv(filas: list[tuple[str, ...]], encabezado: str = ENCABEZADO) -> bytes:
    buffer = io.StringIO()
    escritor = csv.writer(buffer)
    escritor.writerow(encabezado.split(","))
    for fila in filas:
        escritor.writerow(fila)
    return buffer.getvalue().encode()


def _fila(
    identificador: str,
    nombre: str = "Ana Pérez",
    latitud: str = "-3.99313",
    longitud: str = "-79.20422",
    provincia: str = "Loja",
    canton: str = "Loja",
    agencia: str = "Agencia Centro",
    fecha: str = "2024-03-15",
) -> tuple[str, ...]:
    return (identificador, nombre, latitud, longitud, provincia, canton, agencia, fecha)


def _cargar(cliente: TestClient, contenido: bytes, nombre: str = "socios.csv") -> dict:
    if nombre.endswith("xlsx"):
        tipo = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        tipo = "text/csv"
    respuesta = cliente.post("/api/importaciones", files={"archivo": (nombre, contenido, tipo)})
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _xlsx(filas: list[tuple[str, ...]]) -> bytes:
    libro = Workbook()
    hoja = libro.active
    hoja.append(ENCABEZADO.split(","))
    for fila in filas:
        hoja.append(list(fila))
    buffer = io.BytesIO()
    libro.save(buffer)
    return buffer.getvalue()


def test_hu07_carga_csv_y_xlsx_y_rechaza_lo_ilegible(admin: TestClient) -> None:
    csv = _cargar(admin, _csv([_fila("SOC-001")]))
    assert csv["formato"] == "csv"
    assert csv["estado_codigo"] == "pendiente"
    assert csv["contrato_version"] == VERSION_CONTRATO
    assert csv["repetido"] is False
    xlsx = _cargar(admin, _xlsx([_fila("SOC-100")]), "socios.xlsx")
    assert xlsx["formato"] == "xlsx"
    assert xlsx["validos"] == 1
    rechazado = admin.post("/api/importaciones", files={"archivo": ("socios.xls", b"abc", "application/vnd.ms-excel")})
    assert rechazado.status_code == 415
    vacio = admin.post("/api/importaciones", files={"archivo": ("vacio.csv", b"", "text/csv")})
    assert vacio.status_code == 422
    formula = Workbook()
    hoja = formula.active
    hoja.append(ENCABEZADO.split(","))
    hoja.append(["SOC-9", "=1+1", -3.99313, -79.20422, "Loja", "Loja", "Agencia Centro", "2024-03-15"])
    buffer = io.BytesIO()
    formula.save(buffer)
    cargado = _cargar(admin, buffer.getvalue(), "formula.xlsx")
    assert cargado["validos"] == 0
    assert "formato_formula" in cargado["informe"]["motivos"]


def test_hu08_revisa_encabezados_y_la_validacion_responde(admin: TestClient) -> None:
    contenido = _csv(
        [_fila("SOC-001")],
        "id_socio,nombres,lat,lng,prov,canton,sucursal,fecha_registro",
    )
    lote = _cargar(admin, contenido, "alias.csv")
    assert lote["informe"]["estructura_valida"] is True
    assert lote["informe"]["mapeo"]["latitud"] == "lat"
    consulta = admin.get("/api/validacion")
    assert consulta.status_code == 200
    assert consulta.json()["contrato_version"] == VERSION_CONTRATO
    assert any(item["lote_id"] == lote["id"] for item in consulta.json()["informes"])
    detalle = admin.get(f"/api/validacion/{lote['id']}")
    assert detalle.status_code == 200
    assert "id_socio" in detalle.json()["encabezados"]
    incompleto = _cargar(admin, b"nombre,canton\nAna,Loja\n", "corto.csv")
    assert incompleto["estado_codigo"] == "finalizado_con_errores"
    assert incompleto["informe"]["estructura_valida"] is False
    assert incompleto["informe"]["columnas_faltantes"]


def test_hu10_hu11_obligatorios_y_normalizacion(admin: TestClient, db: Session) -> None:
    lote = _cargar(
        admin,
        _csv(
            [
                _fila("SOC-010", nombre="  Ana   Pérez  ", latitud=" -3,99313 ", fecha="15/03/2024"),
                ("SOC-011", "", "-4.10000", "-79.40000", "Loja", "Loja", "Agencia Centro", "2024-03-15"),
                _fila("SOC-012", latitud="-4.20000", longitud="-79.50000", fecha="no-es-fecha"),
            ]
        ),
    )
    assert lote["validos"] == 1
    assert lote["rechazadas"] == 2
    motivos = {item["fila"]: item["motivos"] for item in lote["informe"]["muestra"]}
    assert "obligatorio_nombre" in motivos[3]
    assert "formato_fecha" in motivos[4]
    publicado = admin.post(f"/api/importaciones/{lote['id']}/publicar")
    assert publicado.status_code == 200, publicado.text
    db.rollback()
    fila = db.execute(text("SELECT atributos_socio FROM ubicaciones")).one()
    assert fila.atributos_socio["nombre"] == "Ana Pérez"
    assert fila.atributos_socio["fecha"] == "2024-03-15"


def test_hu49_coordenadas_dentro_de_ecuador_y_galapagos(admin: TestClient) -> None:
    lote = _cargar(
        admin,
        _csv(
            [
                _fila("SOC-LOJA"),
                _fila("SOC-QUITO", latitud="-0.18070", longitud="-78.46780", provincia="Pichincha", canton="Quito"),
                _fila(
                    "SOC-GAL",
                    latitud="-0.8104",
                    longitud="-89.4369",
                    provincia="Galápagos",
                    canton="San Cristóbal",
                ),
                _fila("SOC-MAR", latitud="-2", longitud="-83", provincia="Loja"),
                _fila(
                    "SOC-CRUCE",
                    latitud="-0.19070",
                    longitud="-78.46780",
                    provincia="Loja",
                    canton="Quito",
                ),
            ]
        ),
    )
    assert lote["validos"] == 3
    assert lote["observadas"] == 1
    assert lote["rechazadas"] == 1
    assert "coordenada_fuera_de_ecuador" in lote["informe"]["motivos"]
    assert "provincia_no_coincide" in lote["informe"]["motivos"]


def test_hu12_hu50_hu52_clasificacion_duplicados_y_cuadre(admin: TestClient) -> None:
    base_lat = -3.99313
    cerca = base_lat
    for metros in (1, 2, 3, 4):
        candidata = base_lat + metros / 111_320
        if clave_ubicacion(candidata, -79.20422) == clave_ubicacion(base_lat, -79.20422):
            cerca = candidata
            break
    lote = _cargar(
        admin,
        _csv(
            [
                _fila("SOC-A"),
                _fila("SOC-B", latitud=f"{cerca:.8f}"),
                _fila("SOC-C", latitud="-3.98000", longitud="-79.21000"),
                _fila("SOC-D", latitud="-4.10000", longitud="-79.30000"),
                _fila("SOC-D", latitud="-4.11000", longitud="-79.31000"),
            ]
        ),
    )
    assert lote["total"] == lote["validos"] + lote["observadas"] + lote["rechazadas"]
    assert lote["cuadra"] is True
    assert lote["informe"]["cuadra"] is True
    assert lote["validos"] == 1
    assert lote["observadas"] == 2
    assert lote["rechazadas"] == 2
    publicado = admin.post(f"/api/importaciones/{lote['id']}/publicar")
    assert publicado.status_code == 200, publicado.text
    repetido = _cargar(admin, _csv([_fila("SOC-A", latitud="-4.20000", longitud="-79.40000")]))
    assert repetido["rechazadas"] == 1
    assert "identificador_duplicado" in repetido["informe"]["motivos"]
    cercano = _cargar(
        admin,
        _csv([_fila("SOC-Z", latitud=f"{cerca:.8f}")]),
    )
    assert cercano["observadas"] == 1
    assert cercano["estado_codigo"] == "pendiente"


def test_hu09_cancelar_antes_de_procesar(admin: TestClient, db: Session) -> None:
    lote = _cargar(admin, _csv([_fila("SOC-090")]))
    cancelado = admin.post(f"/api/importaciones/{lote['id']}/cancelar")
    assert cancelado.status_code == 200
    assert cancelado.json()["estado_codigo"] == "cancelado"
    publicado = admin.post(f"/api/importaciones/{lote['id']}/publicar")
    assert publicado.status_code == 409
    db.rollback()
    assert db.execute(text("SELECT count(*) FROM ubicaciones")).scalar() == 0


def test_hu51_publicacion_sin_resultados_parciales(admin: TestClient, db: Session, monkeypatch) -> None:
    lote = _cargar(
        admin,
        _csv(
            [
                _fila("SOC-510"),
                _fila(
                    "SOC-511",
                    latitud="-0.18070",
                    longitud="-78.46780",
                    provincia="Pichincha",
                    canton="Quito",
                ),
            ]
        ),
    )

    def fallar(*_args, **_kwargs):
        raise RuntimeError("fallo forzado")

    monkeypatch.setattr("app.modulos.importaciones.servicio.insertar_ubicaciones", fallar)
    respuesta = admin.post(f"/api/importaciones/{lote['id']}/publicar")
    assert respuesta.status_code == 409
    assert respuesta.json()["codigo"] == "publicacion_abortada"
    db.rollback()
    assert db.execute(text("SELECT count(*) FROM ubicaciones")).scalar() == 0
    estado = db.execute(
        text("SELECT estado FROM lotes_importacion WHERE id = :id"),
        {"id": uuid.UUID(lote["id"])},
    ).scalar()
    assert estado == "pendiente"
    monkeypatch.undo()
    correcto = admin.post(f"/api/importaciones/{lote['id']}/publicar")
    assert correcto.status_code == 200, correcto.text
    assert correcto.json()["estado_codigo"] == "completado"
    db.rollback()
    total = db.execute(
        text("SELECT count(*) FROM ubicaciones WHERE lote_id = :id"),
        {"id": uuid.UUID(lote["id"])},
    ).scalar()
    assert total == 2


def test_rnf31_cancelado_se_vuelve_a_cargar_y_se_puede_publicar(admin: TestClient, db: Session) -> None:
    contenido = _csv([_fila("SOC-R31")])
    primero = _cargar(admin, contenido)
    cancelado = admin.post(f"/api/importaciones/{primero['id']}/cancelar")
    assert cancelado.status_code == 200
    assert cancelado.json()["estado_codigo"] == "cancelado"
    segundo = _cargar(admin, contenido)
    assert segundo["repetido"] is False
    assert segundo["id"] != primero["id"]
    assert segundo["estado_codigo"] == "pendiente"
    publicado = admin.post(f"/api/importaciones/{segundo['id']}/publicar")
    assert publicado.status_code == 200, publicado.text
    assert publicado.json()["estado_codigo"] == "completado"
    assert publicado.json()["id"] == segundo["id"]
    db.rollback()
    estados = db.execute(text("SELECT estado FROM lotes_importacion ORDER BY fecha")).scalars().all()
    assert estados == ["cancelado", "completado"]
    hashes = db.execute(text("SELECT count(DISTINCT resumen_criptografico) FROM lotes_importacion")).scalar()
    assert hashes == 1


def test_rnf31_completado_sigue_devolviendo_el_lote_previo(admin: TestClient, db: Session) -> None:
    contenido = _csv([_fila("SOC-R31B")])
    primero = _cargar(admin, contenido)
    publicado = admin.post(f"/api/importaciones/{primero['id']}/publicar")
    assert publicado.status_code == 200, publicado.text
    segundo = _cargar(admin, contenido)
    assert segundo["repetido"] is True
    assert segundo["id"] == primero["id"]
    assert segundo["estado_codigo"] == "completado"
    assert segundo["intentos"] == 2
    db.rollback()
    assert db.execute(text("SELECT count(*) FROM lotes_importacion")).scalar() == 1
    assert db.execute(text("SELECT count(*) FROM intentos_carga")).scalar() == 2


def test_rnf31_finalizado_con_errores_sigue_siendo_idempotente(admin: TestClient, db: Session) -> None:
    contenido = b"nombre,canton\nAna,Loja\n"
    primero = _cargar(admin, contenido, "corto-rnf.csv")
    assert primero["estado_codigo"] == "finalizado_con_errores"
    segundo = _cargar(admin, contenido, "corto-rnf.csv")
    assert segundo["repetido"] is True
    assert segundo["id"] == primero["id"]
    db.rollback()
    assert db.execute(text("SELECT count(*) FROM lotes_importacion")).scalar() == 1


def test_rnf31_retirado_abre_un_lote_nuevo(admin: TestClient, db: Session) -> None:
    """Retirado no conserva la idempotencia.

    El lote ya no cuenta en el análisis y publicar exige un pendiente, igual que
    un cancelado. El mismo SHA-256 abre un lote nuevo. No hay UNIQUE sobre el
    hash: solo el índice ix_lotes_importacion_resumen.
    """
    contenido = _csv([_fila("SOC-R31C")])
    primero = _cargar(admin, contenido)
    assert admin.post(f"/api/importaciones/{primero['id']}/publicar").status_code == 200
    retirado = admin.post(f"/api/importaciones/{primero['id']}/retirar", json={"motivo": "Reemplazo de la carga"})
    assert retirado.status_code == 200, retirado.text
    assert retirado.json()["estado_codigo"] == "retirado"
    segundo = _cargar(admin, contenido)
    assert segundo["repetido"] is False
    assert segundo["id"] != primero["id"]
    assert segundo["estado_codigo"] == "pendiente"
    publicado = admin.post(f"/api/importaciones/{segundo['id']}/publicar")
    assert publicado.status_code == 200, publicado.text
    assert publicado.json()["estado_codigo"] == "completado"
    definiciones = (
        db.execute(
            text(
                """
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'lotes_importacion'
              AND indexdef ILIKE '%resumen_criptografico%'
            """
            )
        )
        .scalars()
        .all()
    )
    assert definiciones
    assert all("UNIQUE" not in definicion.upper() for definicion in definiciones)


def test_carga_identica_devuelve_el_lote_previo(admin: TestClient, db: Session) -> None:
    contenido = _csv([_fila("SOC-700")])
    primero = _cargar(admin, contenido)
    segundo = _cargar(admin, contenido)
    assert segundo["repetido"] is True
    assert segundo["id"] == primero["id"]
    assert segundo["intentos"] == 2
    db.rollback()
    assert db.execute(text("SELECT count(*) FROM lotes_importacion")).scalar() == 1
    assert db.execute(text("SELECT count(*) FROM intentos_carga")).scalar() == 2


def test_hu16_hu13_estado_e_historial(admin: TestClient) -> None:
    _cargar(admin, _csv([_fila("SOC-130")]), "primero.csv")
    _cargar(
        admin,
        _csv(
            [
                _fila(
                    "SOC-131",
                    latitud="-0.18070",
                    longitud="-78.46780",
                    provincia="Pichincha",
                    canton="Quito",
                )
            ]
        ),
        "segundo.csv",
    )
    listado = admin.get("/api/importaciones")
    assert listado.status_code == 200
    cuerpo = listado.json()
    assert len(cuerpo["lotes"]) == 2
    assert cuerpo["lotes"][0]["nombre"] == "segundo.csv"
    assert {"nombre", "fuente", "validos", "observadas", "estado", "actualizado_en"} <= set(cuerpo["lotes"][0])
    detalle = admin.get(f"/api/importaciones/{cuerpo['lotes'][1]['id']}")
    assert detalle.status_code == 200
    assert detalle.json()["estado_codigo"] in {"pendiente", "finalizado_con_errores", "completado"}
    assert detalle.json()["nombre"] == "primero.csv"


def test_hu14_retirar_conserva_el_archivo_y_sale_del_analisis(admin: TestClient, db: Session) -> None:
    lote = _cargar(admin, _csv([_fila("SOC-140")]))
    publicado = admin.post(f"/api/importaciones/{lote['id']}/publicar")
    assert publicado.status_code == 200, publicado.text
    antes = admin.get("/api/mapas/resumen").json()
    assert antes["total_registros"] == 1
    ruta = Path("/tmp/padgmc-importaciones-prueba") / f"{lote['id']}.csv"
    assert ruta.is_file()
    retirado = admin.post(f"/api/importaciones/{lote['id']}/retirar", json={"motivo": "Carga de prueba"})
    assert retirado.status_code == 200, retirado.text
    assert retirado.json()["estado_codigo"] == "retirado"
    assert retirado.json()["cuenta_en_analisis"] is False
    assert ruta.is_file()
    despues = admin.get("/api/mapas/resumen").json()
    assert despues["total_registros"] == 0
    assert despues["ranking"] == []
    db.rollback()
    assert db.execute(text("SELECT count(*) FROM ubicaciones")).scalar() == 1


def test_hu46_la_importacion_queda_en_auditoria(admin: TestClient) -> None:
    lote = _cargar(admin, _csv([_fila("SOC-460")]))
    admin.post(f"/api/importaciones/{lote['id']}/publicar")
    admin.post(f"/api/importaciones/{lote['id']}/retirar", json={"motivo": "Revisión"})
    eventos = admin.get("/api/auditoria", params={"limite": 200}).json()["eventos"]
    operaciones = {evento["operacion"] for evento in eventos}
    assert {"importacion.cargar", "importacion.publicar", "importacion.retirar"} <= operaciones
    for evento in eventos:
        if not str(evento["operacion"]).startswith("importacion."):
            continue
        assert evento["actor_etiqueta"] == "admin"
        assert "contrasena" not in str(evento).casefold()


def test_permiso_impide_importar_publicar_y_retirar(admin: TestClient) -> None:
    creado = admin.post(
        "/api/usuarios",
        json={
            "identificador": "visor2",
            "correo": "visor2@example.com",
            "nombre": "Visor",
            "contrasena": CONTRASENA,
            "rol_codigo": "usuario",
        },
    )
    assert creado.status_code == 201, creado.text
    with TestClient(admin.app) as visor:
        ingresar(visor, "visor2")
        carga = visor.post("/api/importaciones", files={"archivo": ("socios.csv", _csv([_fila("SOC-1")]), "text/csv")})
        assert carga.status_code == 403
        assert visor.get("/api/validacion").status_code == 403
        assert visor.post("/api/importaciones/00000000-0000-0000-0000-000000000000/publicar").status_code == 403
        assert visor.post("/api/importaciones/00000000-0000-0000-0000-000000000000/retirar").status_code == 403


def test_hu29_hu30_hu22_indice_ranking_y_calor(admin: TestClient) -> None:
    primero = _cargar(
        admin,
        _csv(
            [
                _fila("SOC-290"),
                _fila("SOC-291", agencia="Agencia Norte", latitud="-3.99000", longitud="-79.20000"),
            ]
        ),
    )
    publicado = admin.post(f"/api/importaciones/{primero['id']}/publicar")
    assert publicado.status_code == 200, publicado.text
    resumen = admin.get("/api/mapas/resumen").json()
    assert resumen["total_registros"] == 2
    assert resumen["ranking"]
    assert resumen["ranking"][0]["codigo"] == "loja"
    assert resumen["ranking"][0]["registros"] == 2
    assert resumen["ranking"][0]["agencias"] == 2
    assert resumen["ranking"][0]["densidad"] == 1
    assert resumen["ranking"][0]["indice"] == 100
    assert resumen["ranking"][0]["tendencia"] is None
    assert "latitud" not in admin.get("/api/mapas/agregado").text
    calor = admin.get("/api/mapas/calor")
    assert calor.status_code == 200
    assert calor.json()["total_registros"] == 2
    assert calor.json()["celdas"]
    assert all("peso" in celda for celda in calor.json()["celdas"])
    segundo = _cargar(
        admin,
        _csv(
            [
                _fila(
                    "SOC-292",
                    latitud="-0.18070",
                    longitud="-78.46780",
                    provincia="Pichincha",
                    canton="Quito",
                    agencia="Agencia Norte",
                )
            ]
        ),
    )
    assert admin.post(f"/api/importaciones/{segundo['id']}/publicar").status_code == 200
    otro = admin.get("/api/mapas/resumen").json()
    loja = next(item for item in otro["ranking"] if item["codigo"] == "loja")
    assert loja["tendencia"] is not None
    assert otro["total_registros"] == 3
    indices = [item["indice"] for item in otro["ranking"]]
    assert indices == sorted(indices, reverse=True)


def test_hu64_diez_mil_filas(admin: TestClient) -> None:
    lineas = [ENCABEZADO]
    for indice in range(10_000):
        fila = indice // 100
        columna = indice % 100
        latitud = -4.05 + fila * 0.001
        longitud = -79.45 + columna * 0.001
        lineas.append(
            f"SOC-{indice},Persona {indice},{latitud:.5f},{longitud:.5f},Loja,Loja,Agencia {columna % 5},2024-03-15"
        )
    inicio = time.perf_counter()
    respuesta = admin.post(
        "/api/importaciones",
        files={"archivo": ("grande.csv", "\n".join(lineas).encode(), "text/csv")},
    )
    duracion = time.perf_counter() - inicio
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 10_000
    assert cuerpo["total"] == cuerpo["validos"] + cuerpo["observadas"] + cuerpo["rechazadas"]
    assert cuerpo["validos"] > 8_000
    assert duracion < 30, duracion


def test_hu67_contrato_documentado_y_migracion_reversible() -> None:
    documento = Path(__file__).resolve().parents[2] / "docs" / "contrato-columnas.md"
    texto = documento.read_text(encoding="utf-8")
    for campo in (
        "identificador_socio",
        "nombre",
        "latitud",
        "longitud",
        "provincia",
        "canton",
        "agencia",
        "fecha",
    ):
        assert campo in texto
    from app.base_datos import motor

    configuracion = Config(str(RAIZ_BACKEND / "alembic.ini"))
    motor.dispose()
    try:
        command.downgrade(configuracion, "0002_cobertura_nacional")
        command.upgrade(configuracion, "head")
    finally:
        command.upgrade(configuracion, "head")
