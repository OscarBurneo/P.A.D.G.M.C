"""Genera el CSV de ejemplo del Sprint 3.

No son socios de la cooperativa. La semilla es fija para que el archivo
se pueda volver a generar bit a bit. El contrato de columnas no cambia:
identificador_socio, nombre, latitud, longitud, provincia, canton, agencia, fecha.

Uso, desde la raíz del repositorio:

    python herramientas/generar_datos_sinteticos.py
"""

import csv
import json
import random
from datetime import date
from pathlib import Path

SEMILLA = 20261123
TOTAL = 3000
FUERA = 38
VACIOS = 37
INVERTIDOS = 37
FILAS_DUPLICADAS = 38
DEFECTOS = FUERA + VACIOS + INVERTIDOS + FILAS_DUPLICADAS
MARGEN_GRADOS = 0.05

RAIZ = Path(__file__).resolve().parents[1]
GEOJSON = RAIZ / "backend" / "app" / "recursos" / "geografia" / "ecuador-adm1.geojson"
SALIDA = RAIZ / "datos" / "sinteticos" / "socios_ejemplo.csv"

ENCABEZADO = (
    "identificador_socio",
    "nombre",
    "latitud",
    "longitud",
    "provincia",
    "canton",
    "agencia",
    "fecha",
)

# shape es el shapeName del GeoJSON. El nombre es el que declara la fila.
PROVINCIAS = (
    {
        "shape": "Loja",
        "nombre": "Loja",
        "cantones": ("Loja", "Catamayo", "Gonzanamá"),
        "agencias": ("Agencia Centro", "Agencia Norte", "Agencia Sur"),
    },
    {
        "shape": "El Oro",
        "nombre": "El Oro",
        "cantones": ("Machala", "Santa Rosa", "Pasaje"),
        "agencias": ("Agencia Machala", "Agencia Santa Rosa", "Agencia Pasaje"),
    },
    {
        "shape": "Zamora Chinchipe",
        "nombre": "Zamora Chinchipe",
        "cantones": ("Zamora", "Yantzaza", "Centinela del Cóndor"),
        "agencias": ("Agencia Zamora", "Agencia Yantzaza", "Agencia Centro"),
    },
    {
        "shape": "Pichincha",
        "nombre": "Pichincha",
        "cantones": ("Quito", "Mejía", "Rumiñahui"),
        "agencias": ("Agencia Quito Norte", "Agencia Quito Sur", "Agencia Centro"),
    },
    {
        "shape": "Santo Domingo de los Tsáchilas",
        "nombre": "Santo Domingo de los Tsáchilas",
        "cantones": ("Santo Domingo", "La Concordia"),
        "agencias": ("Agencia Santo Domingo", "Agencia Concordia", "Agencia Centro"),
    },
    {
        "shape": "Manabi",
        "nombre": "Manabí",
        "cantones": ("Portoviejo", "Manta", "Chone"),
        "agencias": ("Agencia Portoviejo", "Agencia Manta", "Agencia Chone"),
    },
    {
        "shape": "Chimborazo",
        "nombre": "Chimborazo",
        "cantones": ("Riobamba", "Alausí", "Guano"),
        "agencias": ("Agencia Riobamba", "Agencia Alausí", "Agencia Centro"),
    },
    {
        "shape": "Guayas",
        "nombre": "Guayas",
        "cantones": ("Guayaquil", "Durán", "Daule"),
        "agencias": ("Agencia Guayaquil", "Agencia Durán", "Agencia Daule"),
    },
)


def punto_en_anillo(x: float, y: float, anillo: list) -> bool:
    dentro = False
    total = len(anillo)
    if total < 4:
        return False
    j = total - 1
    for i in range(total):
        xi, yi = anillo[i][0], anillo[i][1]
        xj, yj = anillo[j][0], anillo[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            dentro = not dentro
        j = i
    return dentro


def punto_en_poligono(x: float, y: float, anillos: list) -> bool:
    if not anillos or not punto_en_anillo(x, y, anillos[0]):
        return False
    return all(not punto_en_anillo(x, y, hueco) for hueco in anillos[1:])


def punto_en_geometria(x: float, y: float, geometria: dict) -> bool:
    tipo = geometria["type"]
    if tipo == "Polygon":
        return punto_en_poligono(x, y, geometria["coordinates"])
    if tipo == "MultiPolygon":
        return any(punto_en_poligono(x, y, poligono) for poligono in geometria["coordinates"])
    return False


def caja(geometria: dict) -> tuple[float, float, float, float]:
    xs: list[float] = []
    ys: list[float] = []

    def recorrer(nodo: object) -> None:
        if isinstance(nodo, list) and nodo and isinstance(nodo[0], int | float):
            xs.append(float(nodo[0]))
            ys.append(float(nodo[1]))
            return
        if isinstance(nodo, list):
            for hijo in nodo:
                recorrer(hijo)

    recorrer(geometria["coordinates"])
    return min(xs), min(ys), max(xs), max(ys)


def cargar_geometrias() -> dict[str, dict]:
    coleccion = json.loads(GEOJSON.read_text(encoding="utf-8"))
    return {feature["properties"]["shapeName"]: feature["geometry"] for feature in coleccion["features"]}


def _interior(rng: random.Random, geometria: dict) -> tuple[str, str]:
    oeste, sur, este, norte = caja(geometria)
    margen = MARGEN_GRADOS
    if este - oeste < margen * 4 or norte - sur < margen * 4:
        margen = min(este - oeste, norte - sur) / 6
    for _ in range(50_000):
        lon = round(rng.uniform(oeste + margen, este - margen), 5)
        lat = round(rng.uniform(sur + margen, norte - margen), 5)
        vecinos = (
            (lon, lat),
            (lon + margen, lat),
            (lon - margen, lat),
            (lon, lat + margen),
            (lon, lat - margen),
        )
        if all(punto_en_geometria(x, y, geometria) for x, y in vecinos):
            return f"{lat:.5f}", f"{lon:.5f}"
    raise RuntimeError("No se pudo muestrear un punto interior. Revise el margen o el polígono.")


def _fecha(rng: random.Random) -> str:
    inicio = date(2023, 1, 1).toordinal()
    fin = date(2025, 10, 31).toordinal()
    return date.fromordinal(rng.randint(inicio, fin)).isoformat()


def _fila_valida(
    rng: random.Random,
    geometrias: dict[str, dict],
    provincia: dict,
    identificador: str,
) -> tuple[str, ...]:
    latitud, longitud = _interior(rng, geometrias[provincia["shape"]])
    return (
        identificador,
        f"Persona {identificador[-6:]}",
        latitud,
        longitud,
        provincia["nombre"],
        rng.choice(provincia["cantones"]),
        rng.choice(provincia["agencias"]),
        _fecha(rng),
    )


def generar(semilla: int = SEMILLA) -> tuple[list[tuple[str, ...]], list[bool]]:
    """Devuelve las filas y una máscara: True si la fila es un defecto intencional."""

    if DEFECTOS >= TOTAL:
        raise RuntimeError("Los defectos no pueden ser todas las filas.")
    rng = random.Random(semilla)
    geometrias = cargar_geometrias()
    faltantes = [item["shape"] for item in PROVINCIAS if item["shape"] not in geometrias]
    if faltantes:
        raise RuntimeError(f"El GeoJSON no tiene estas provincias: {', '.join(faltantes)}")
    validas_objetivo = TOTAL - DEFECTOS
    validas: list[tuple[str, ...]] = []
    for indice in range(validas_objetivo):
        provincia = PROVINCIAS[indice % len(PROVINCIAS)]
        validas.append(_fila_valida(rng, geometrias, provincia, f"SIN-{indice + 1:06d}"))
    defectos: list[tuple[str, ...]] = []
    for indice in range(FUERA):
        provincia = PROVINCIAS[indice % len(PROVINCIAS)]
        latitud = 40 + (indice % 5) * 0.1
        longitud = -70 - (indice % 7) * 0.1
        defectos.append(
            (
                f"SIN-F{indice + 1:05d}",
                f"Persona fuera {indice + 1}",
                f"{latitud:.5f}",
                f"{longitud:.5f}",
                provincia["nombre"],
                provincia["cantones"][0],
                provincia["agencias"][0],
                _fecha(rng),
            )
        )
    for indice in range(VACIOS):
        provincia = PROVINCIAS[indice % len(PROVINCIAS)]
        fila = list(_fila_valida(rng, geometrias, provincia, f"SIN-V{indice + 1:05d}"))
        fila[indice % len(ENCABEZADO)] = ""
        defectos.append(tuple(fila))
    for indice in range(INVERTIDOS):
        origen = validas[indice]
        defectos.append(
            (
                f"SIN-I{indice + 1:05d}",
                f"Persona eje {indice + 1}",
                origen[3],
                origen[2],
                origen[4],
                origen[5],
                origen[6],
                origen[7],
            )
        )
    # El importador rechaza todas las copias de un identificador repetido.
    # El par usa un id que no está entre las filas válidas, para no tumbarlas.
    for indice in range(FILAS_DUPLICADAS // 2):
        provincia = PROVINCIAS[indice % len(PROVINCIAS)]
        identificador = f"SIN-D{indice + 1:05d}"
        for copia in range(2):
            latitud, longitud = _interior(rng, geometrias[provincia["shape"]])
            defectos.append(
                (
                    identificador,
                    f"Persona duplicada {indice + 1}-{copia + 1}",
                    latitud,
                    longitud,
                    provincia["nombre"],
                    provincia["cantones"][0],
                    provincia["agencias"][0],
                    _fecha(rng),
                )
            )
    filas = validas + defectos
    mascara = [False] * len(validas) + [True] * len(defectos)
    orden = list(range(len(filas)))
    rng.shuffle(orden)
    return [filas[indice] for indice in orden], [mascara[indice] for indice in orden]


def a_csv(filas: list[tuple[str, ...]]) -> bytes:
    from io import StringIO

    buffer = StringIO(newline="")
    escritor = csv.writer(buffer, lineterminator="\n")
    escritor.writerow(ENCABEZADO)
    escritor.writerows(filas)
    return buffer.getvalue().encode("utf-8")


def main() -> None:
    filas, mascara = generar()
    if len(filas) != TOTAL or sum(mascara) != DEFECTOS:
        raise RuntimeError("El generador no produjo el total o el porcentaje de defectos esperado.")
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_bytes(a_csv(filas))
    print(f"Escrito {SALIDA} ({len(filas)} filas, {sum(mascara)} defectos, semilla {SEMILLA})")


if __name__ == "__main__":
    main()
