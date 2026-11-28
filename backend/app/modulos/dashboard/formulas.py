"""Fórmulas del dashboard. Parten de conteos ya agregados, sin filas individuales."""

from datetime import date

_MESES = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)
_ABREVIATURAS = ("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")


def periodo_de(hoy: date) -> str:
    return f"{hoy.year:04d}-{hoy.month:02d}"


def mes_anterior(periodo: str) -> str:
    anio, mes = (int(parte) for parte in periodo.split("-"))
    if mes == 1:
        return f"{anio - 1:04d}-12"
    return f"{anio:04d}-{mes - 1:02d}"


def mismo_mes_anio_anterior(periodo: str) -> str:
    anio, mes = periodo.split("-")
    return f"{int(anio) - 1:04d}-{mes}"


def etiqueta_mes(periodo: str) -> str:
    anio, mes = periodo.split("-")
    return f"{_MESES[int(mes) - 1].capitalize()} {anio}"


def abreviatura_mes(periodo: str) -> str:
    mes = int(periodo.split("-")[1])
    return _ABREVIATURAS[mes - 1]


def meses_entre(inicio: str, fin: str) -> list[str]:
    anio, mes = (int(parte) for parte in inicio.split("-"))
    anio_fin, mes_fin = (int(parte) for parte in fin.split("-"))
    salida: list[str] = []
    while (anio, mes) <= (anio_fin, mes_fin):
        salida.append(f"{anio:04d}-{mes:02d}")
        mes += 1
        if mes == 13:
            mes = 1
            anio += 1
    return salida


def variacion(actual: int, anterior: int) -> float | None:
    if anterior <= 0:
        return None
    return round(100 * (actual - anterior) / anterior, 1)


def promedio_movil(serie: list[int]) -> list[float | None]:
    salida: list[float | None] = []
    for indice in range(len(serie)):
        if indice < 2:
            salida.append(None)
            continue
        ventana = serie[indice - 2 : indice + 1]
        salida.append(round(sum(ventana) / 3, 1))
    return salida


def mes_de_referencia(conteos: dict[str, int], hoy: date) -> str | None:
    if not conteos:
        return None
    actual = periodo_de(hoy)
    if conteos.get(actual, 0) > 0:
        return actual
    return max(conteos)
