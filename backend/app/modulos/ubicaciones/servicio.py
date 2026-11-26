"""Alta manual de una ubicación. Reutiliza la clasificación del lote CSV."""

import json

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.errores import ErrorAplicacion
from app.modelos import Usuario
from app.modulos.auditoria.servicio import registrar as auditar
from app.modulos.importaciones.clasificacion import clasificar
from app.modulos.importaciones.contrato import COLUMNAS, VERSION_CONTRATO
from app.modulos.importaciones.lectura import ArchivoTabular

_DETALLE = "La ubicación no se guardó. Corrija los campos indicados."

# campo, mensaje, acción correctiva. La regla es la misma clave que usa la importación.
_REGLAS: dict[str, tuple[str, str, str]] = {
    "obligatorio_identificador_socio": (
        "identificador_socio",
        "El identificador es obligatorio.",
        "Escriba el identificador del potencial socio.",
    ),
    "obligatorio_nombre": (
        "nombre",
        "El nombre es obligatorio.",
        "Escriba el nombre con el que se reconoce al potencial socio.",
    ),
    "obligatorio_latitud": (
        "latitud",
        "La latitud es obligatoria.",
        "Escriba la latitud en grados decimales, WGS 84.",
    ),
    "obligatorio_longitud": (
        "longitud",
        "La longitud es obligatoria.",
        "Escriba la longitud en grados decimales, WGS 84.",
    ),
    "obligatorio_provincia": (
        "provincia",
        "La provincia es obligatoria.",
        "Escriba la provincia declarada, por ejemplo Loja.",
    ),
    "obligatorio_canton": (
        "canton",
        "El cantón es obligatorio.",
        "Escriba el cantón declarado.",
    ),
    "obligatorio_agencia": (
        "agencia",
        "La agencia es obligatoria.",
        "Escriba la agencia asociada al registro.",
    ),
    "obligatorio_fecha": (
        "fecha",
        "La fecha es obligatoria.",
        "Escriba la fecha como AAAA-MM-DD, DD/MM/AAAA o DD-MM-AAAA.",
    ),
    "formato_latitud": (
        "latitud",
        "La latitud tiene que ser un número entre -90 y 90.",
        "Use punto o coma como separador decimal, no los dos a la vez.",
    ),
    "formato_longitud": (
        "longitud",
        "La longitud tiene que ser un número entre -180 y 180.",
        "Use punto o coma como separador decimal, no los dos a la vez.",
    ),
    "formato_fecha": (
        "fecha",
        "La fecha no tiene un formato reconocido.",
        "Use AAAA-MM-DD, DD/MM/AAAA o DD-MM-AAAA.",
    ),
    "formato_formula": (
        "cuerpo",
        "Un campo empieza por = y se trata como fórmula.",
        "Quite el signo =. El sistema no ejecuta fórmulas.",
    ),
    "coordenada_fuera_de_ecuador": (
        "latitud",
        "La coordenada no cae dentro del Ecuador, incluidas Galápagos.",
        "Revise latitud y longitud en WGS 84. El orden es latitud y luego longitud.",
    ),
    "identificador_duplicado": (
        "identificador_socio",
        "El identificador ya está registrado.",
        "Use un identificador que no esté en un lote publicado ni en otra alta manual.",
    ),
    "ubicacion_coincidente": (
        "latitud",
        "La ubicación, redondeada a unos 5 m, coincide con otro identificador del mismo cantón.",
        "Separe el punto o use el identificador que ya está en esa celda.",
    ),
    "provincia_no_coincide": (
        "provincia",
        "El punto cae en otra provincia distinta de la declarada.",
        "Corrija la provincia para que coincida con la coordenada, o corrija la coordenada.",
    ),
    "tipo_cuerpo": (
        "cuerpo",
        "El cuerpo tiene que ser un objeto con los campos del contrato.",
        "Envíe un JSON con los ocho campos del contrato de columnas.",
    ),
    "tipo_texto": (
        "cuerpo",
        "El campo tiene que ser texto.",
        "Envíe el valor como texto, no como número, lista ni objeto.",
    ),
    "tipo_decimal": (
        "cuerpo",
        "El campo tiene que ser un número.",
        "Envíe un número o un texto decimal, no una lista ni un objeto.",
    ),
}


def registrar(db: Session, actor: Usuario, datos: object) -> dict:
    if not isinstance(datos, dict):
        _rechazar(db, actor, [_error("cuerpo", "tipo_cuerpo")])
    textos, errores_tipo = _textos(datos)
    archivo = ArchivoTabular(
        encabezados=[columna.campo for columna in COLUMNAS],
        filas=[(1, [textos[columna.campo] for columna in COLUMNAS])],
        encoding=None,
        delimitador=None,
    )
    fila = clasificar(db, archivo, None).filas[0]
    errores = _combinar(errores_tipo, _errores_de(fila, textos))
    if errores or fila.clasificacion != "aceptada":
        _rechazar(db, actor, errores or [_error("cuerpo", "ubicacion_invalida")])
    identificador = _insertar(db, fila)
    auditar(
        db,
        actor_tipo="usuario",
        actor_id=actor.id,
        actor_etiqueta=actor.identificador,
        operacion="ubicacion.registrar",
        entidad_tipo="ubicacion",
        entidad_id=identificador,
        resultado="exito",
        despues={"clasificacion": "aceptada", "identificador_clave": fila.identificador_clave},
        mensaje="Alta manual de una ubicación aceptada.",
    )
    db.commit()
    return {
        "id": identificador,
        "clasificacion": "aceptada",
        "contrato_version": VERSION_CONTRATO,
        "mensaje": "La ubicación quedó registrada.",
        "ubicacion": {
            "identificador_socio": fila.identificador,
            "nombre": fila.nombre,
            "latitud": fila.latitud,
            "longitud": fila.longitud,
            "provincia": fila.provincia,
            "canton": fila.canton,
            "agencia": fila.agencia,
            "fecha": fila.fecha,
        },
    }


def _rechazar(db: Session, actor: Usuario, errores: list[dict[str, str]]) -> None:
    auditar(
        db,
        actor_tipo="usuario",
        actor_id=actor.id,
        actor_etiqueta=actor.identificador,
        operacion="ubicacion.registrar",
        entidad_tipo="ubicacion",
        resultado="fallo",
        codigo_error="ubicacion_invalida",
        despues={"reglas": [error["regla"] for error in errores]},
        mensaje="La ubicación no se guardó porque no pasó la validación.",
    )
    db.commit()
    raise ErrorAplicacion(422, _DETALLE, "ubicacion_invalida", errores=errores)


def _textos(datos: dict) -> tuple[dict[str, str], list[dict[str, str]]]:
    textos: dict[str, str] = {}
    errores: list[dict[str, str]] = []
    for columna in COLUMNAS:
        valor = datos.get(columna.campo)
        if valor is None or valor == "":
            textos[columna.campo] = ""
            continue
        if columna.tipo == "decimal":
            if isinstance(valor, bool) or not isinstance(valor, (int, float, str)):
                textos[columna.campo] = ""
                errores.append(_error(columna.campo, "tipo_decimal"))
                continue
            textos[columna.campo] = _decimal_texto(valor)
            continue
        if not isinstance(valor, str):
            textos[columna.campo] = ""
            errores.append(_error(columna.campo, "tipo_texto"))
            continue
        textos[columna.campo] = valor
    return textos, errores


def _decimal_texto(valor: int | float | str) -> str:
    if isinstance(valor, str):
        return valor
    if isinstance(valor, int):
        return str(valor)
    texto = format(valor, "f")
    if "." in texto:
        texto = texto.rstrip("0").rstrip(".")
    return texto or "0"


def _errores_de(fila, textos: dict[str, str]) -> list[dict[str, str]]:
    errores: list[dict[str, str]] = []
    for motivo in fila.motivos:
        if motivo == "formato_formula":
            campos = [columna.campo for columna in COLUMNAS if textos[columna.campo].lstrip().startswith("=")]
            for campo in campos or ["cuerpo"]:
                errores.append(_error(campo, motivo))
            continue
        if motivo.startswith("obligatorio_"):
            errores.append(_error(motivo.removeprefix("obligatorio_"), motivo))
            continue
        regla = _REGLAS.get(motivo)
        campo = regla[0] if regla else "cuerpo"
        errores.append(_error(campo, motivo))
    return errores


def _combinar(tipos: list[dict[str, str]], de_fila: list[dict[str, str]]) -> list[dict[str, str]]:
    campos_tipo = {error["campo"] for error in tipos}
    filtrados = [
        error
        for error in de_fila
        if not (error["regla"].startswith("obligatorio_") and error["campo"] in campos_tipo)
    ]
    return tipos + filtrados


def _error(campo: str, regla: str) -> dict[str, str]:
    conocido = _REGLAS.get(regla)
    if conocido is None:
        return {
            "campo": campo,
            "regla": regla,
            "mensaje": "El valor no cumple una regla del contrato.",
            "accion": "Corrija el campo y vuelva a enviarlo.",
        }
    mensaje, accion = conocido[1], conocido[2]
    if regla in {"tipo_texto", "tipo_decimal"}:
        etiqueta = next((columna.etiqueta for columna in COLUMNAS if columna.campo == campo), campo)
        if regla == "tipo_texto":
            mensaje = f"{etiqueta} tiene que ser texto."
        else:
            mensaje = f"{etiqueta} tiene que ser un número."
    return {"campo": campo, "regla": regla, "mensaje": mensaje, "accion": accion}


def _insertar(db: Session, fila) -> str:
    identificador = db.execute(
        text(
            """
            INSERT INTO ubicaciones (id, geom, creado_en, lote_id, atributos_socio)
            VALUES (
                gen_random_uuid(),
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                now(),
                NULL,
                CAST(:attrs AS jsonb)
            )
            RETURNING id::text
            """
        ),
        {"lon": fila.longitud, "lat": fila.latitud, "attrs": json.dumps(fila.atributos())},
    ).scalar_one()
    return str(identificador)
