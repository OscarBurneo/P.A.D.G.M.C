"""El CSV de ejemplo se regenera con la misma semilla y el contrato de 8 columnas."""

import importlib.util
from pathlib import Path

RUTA = Path(__file__).resolve().parents[2] / "herramientas" / "generar_datos_sinteticos.py"
SPEC = importlib.util.spec_from_file_location("generar_datos_sinteticos", RUTA)
generador = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(generador)


def test_el_csv_de_ejemplo_es_reproducible_y_marca_los_defectos() -> None:
    filas, mascara = generador.generar()
    otra, otra_mascara = generador.generar()
    assert filas == otra
    assert mascara == otra_mascara
    assert len(filas) == generador.TOTAL == 3000
    assert sum(mascara) == generador.DEFECTOS == 150
    assert generador.a_csv(filas) == generador.SALIDA.read_bytes()
    geometrias = generador.cargar_geometrias()
    por_nombre = {item["nombre"]: item["shape"] for item in generador.PROVINCIAS}
    for fila, defectuosa in zip(filas, mascara, strict=True):
        assert len(fila) == 8
        if defectuosa:
            continue
        latitud = float(fila[2])
        longitud = float(fila[3])
        assert generador.punto_en_geometria(longitud, latitud, geometrias[por_nombre[fila[4]]])
    texto = generador.SALIDA.read_text(encoding="utf-8").splitlines()[0]
    assert texto == "identificador_socio,nombre,latitud,longitud,provincia,canton,agencia,fecha"
