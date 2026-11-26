"""Agregados del dashboard: KPIs, variación, promedio móvil y filtros."""

from datetime import date

from fastapi.testclient import TestClient

from app.modulos.dashboard.formulas import mes_de_referencia, promedio_movil, variacion
from tests.test_importaciones import _cargar, _csv, _fila


def test_variacion_y_promedio_movil() -> None:
    assert variacion(12, 10) == 20.0
    assert variacion(8, 10) == -20.0
    assert variacion(4, 0) is None
    assert promedio_movil([2, 0, 4, 6]) == [None, None, 2.0, round(10 / 3, 1)]
    assert mes_de_referencia({"2024-04": 3}, date(2026, 11, 1)) == "2024-04"
    assert mes_de_referencia({"2026-11": 2, "2026-10": 9}, date(2026, 11, 1)) == "2026-11"
    assert mes_de_referencia({}, date(2026, 11, 1)) is None


def test_dashboard_agrega_kpis_tendencia_y_filtra(admin: TestClient) -> None:
    lote = _cargar(
        admin,
        _csv(
            [
                _fila("D-1", provincia="Loja", canton="Loja", agencia="Agencia Centro", fecha="2024-03-10"),
                _fila(
                    "D-2",
                    provincia="Loja",
                    canton="Loja",
                    agencia="Agencia Centro",
                    latitud="-3.98313",
                    longitud="-79.19422",
                    fecha="2024-03-20",
                ),
                _fila(
                    "D-3",
                    provincia="Loja",
                    canton="Catamayo",
                    agencia="Agencia Norte",
                    latitud="-3.99000",
                    longitud="-79.20000",
                    fecha="2024-04-02",
                ),
                _fila(
                    "D-4",
                    provincia="Loja",
                    canton="Catamayo",
                    agencia="Agencia Norte",
                    latitud="-3.98000",
                    longitud="-79.19000",
                    fecha="2024-04-18",
                ),
                _fila(
                    "D-5",
                    provincia="Loja",
                    canton="Catamayo",
                    agencia="Agencia Norte",
                    latitud="-4.00000",
                    longitud="-79.21000",
                    fecha="2024-04-28",
                ),
                _fila(
                    "D-6",
                    provincia="Pichincha",
                    canton="Quito",
                    agencia="Agencia Quito Norte",
                    latitud="-0.18070",
                    longitud="-78.46780",
                    fecha="2024-04-15",
                ),
                _fila(
                    "D-7",
                    provincia="Loja",
                    canton="Loja",
                    agencia="Agencia Centro",
                    latitud="-4.00313",
                    longitud="-79.21422",
                    fecha="2023-04-01",
                ),
            ]
        ),
    )
    assert admin.post(f"/api/importaciones/{lote['id']}/publicar").status_code == 200
    respuesta = admin.get("/api/dashboard/resumen")
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["vacio"] is False
    assert cuerpo["kpis"]["total"] == 7
    assert cuerpo["kpis"]["mes"]["periodo"] == "2024-04"
    assert cuerpo["kpis"]["mes"]["registros"] == 4
    assert cuerpo["kpis"]["mes"]["anterior"] == 2
    assert cuerpo["kpis"]["mes"]["variacion"] == 100.0
    assert cuerpo["kpis"]["provincia"] == {"nombre": "Loja", "registros": 6}
    assert cuerpo["kpis"]["agencia"] == {"nombre": "Agencia Centro", "registros": 3}
    abril = next(punto for punto in cuerpo["tendencia"] if punto["periodo"] == "2024-04")
    assert abril["anio_anterior"] == 1
    assert abril["promedio_movil"] == round((0 + 2 + 4) / 3, 1)
    assert "ana" not in respuesta.text.casefold()
    assert "d-1" not in respuesta.text.casefold()
    loja = admin.get("/api/dashboard/resumen", params={"provincia": "Loja"})
    assert loja.status_code == 200, loja.text
    assert loja.json()["kpis"]["total"] == 6
    assert all(fila["nombre"] != "Pichincha" for fila in loja.json()["provincias"])
    catamayo = admin.get("/api/dashboard/resumen", params={"provincia": "Loja", "canton": "Catamayo"})
    assert catamayo.json()["kpis"]["total"] == 3
    assert catamayo.json()["kpis"]["agencia"]["nombre"] == "Agencia Norte"


def test_dashboard_vacio(admin: TestClient) -> None:
    respuesta = admin.get("/api/dashboard/resumen")
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["vacio"] is True
    assert cuerpo["kpis"]["total"] == 0
    assert cuerpo["kpis"]["mes"] is None
    assert cuerpo["tendencia"] == []
    assert cuerpo["ranking"] == []
