"""Catálogo editable de parámetros de negocio."""

from sqlalchemy.orm import Session

from app.catalogo import ESTADO_PENDIENTE, PARAMETROS
from app.configuracion import ajustes
from app.errores import ErrorAplicacion
from app.modelos import Parametro, Usuario
from app.modulos.auditoria.servicio import registrar
from app.modulos.auth.servicio import ahora_utc
from app.parametros_plataforma import leer


def listar(db: Session) -> dict:
    return {
        "estado_aprobacion": ESTADO_PENDIENTE,
        "pendiente": "P-09",
        "parametros": [_publico(db, clave, meta) for clave, meta in PARAMETROS.items()],
        "perfil_hash": perfil_hash(),
    }


def perfil_hash() -> dict:
    return {
        "algoritmo": "argon2id",
        "time_cost": ajustes.argon2_time_cost,
        "memory_cost": ajustes.argon2_memory_cost,
        "parallelism": ajustes.argon2_parallelism,
        "hash_len": ajustes.argon2_hash_len,
        "salt_len": ajustes.argon2_salt_len,
        "estado_aprobacion": ESTADO_PENDIENTE,
        "pendiente": "P-09",
        "editable_en_interfaz": False,
        "nota": (
            "Cada hash guarda su propia sal. El perfil se configura por entorno "
            "y está pendiente de aprobación. No es un secreto, pero no se edita aquí."
        ),
    }


def actualizar(db: Session, actor: Usuario, clave: str, valor: object) -> dict:
    meta = PARAMETROS.get(clave)
    if meta is None:
        raise ErrorAplicacion(404, "El parámetro no está en el catálogo.", "parametro_desconocido")
    try:
        nuevo = _validar(meta, valor)
    except ErrorAplicacion as exc:
        registrar(
            db,
            actor_tipo="usuario",
            actor_id=actor.id,
            actor_etiqueta=actor.identificador,
            operacion="parametros.editar",
            entidad_tipo="parametro",
            entidad_id=clave,
            resultado="fallo",
            codigo_error=exc.codigo,
            antes={"dato": leer(db, clave)},
            mensaje=exc.detalle,
        )
        db.commit()
        raise
    anterior = leer(db, clave)
    if anterior == nuevo:
        return _publico(db, clave, meta)
    fila = db.get(Parametro, clave)
    if fila is None:
        fila = Parametro(clave=clave, valor={"dato": nuevo}, actualizado_en=ahora_utc())
        db.add(fila)
    else:
        fila.valor = {"dato": nuevo}
        fila.actualizado_en = ahora_utc()
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=actor.id,
        actor_etiqueta=actor.identificador,
        operacion="parametros.editar",
        entidad_tipo="parametro",
        entidad_id=clave,
        resultado="exito",
        antes={"dato": anterior},
        despues={"dato": nuevo},
        mensaje="Parámetro actualizado. Sigue pendiente de aprobación.",
    )
    db.commit()
    return _publico(db, clave, meta)


def _validar(meta: dict, valor: object) -> object:
    tipo = meta["tipo"]
    if tipo == "entero":
        if isinstance(valor, bool) or not isinstance(valor, int):
            raise ErrorAplicacion(422, "El valor debe ser un número entero.", "parametro_invalido")
        if valor < int(meta["minimo"]) or valor > int(meta["maximo"]):
            raise ErrorAplicacion(
                422,
                f"El valor debe estar entre {meta['minimo']} y {meta['maximo']}.",
                "parametro_fuera_de_rango",
            )
        return valor
    if tipo == "booleano":
        if not isinstance(valor, bool):
            raise ErrorAplicacion(422, "El valor debe ser verdadero o falso.", "parametro_invalido")
        return valor
    raise ErrorAplicacion(422, "Tipo de parámetro no reconocido.", "parametro_invalido")


def _publico(db: Session, clave: str, meta: dict) -> dict:
    return {
        "clave": clave,
        "valor": leer(db, clave),
        "tipo": meta["tipo"],
        "descripcion": meta["descripcion"],
        "estado_aprobacion": meta["estado_aprobacion"],
        "pendiente": meta["pendiente"],
        "minimo": meta.get("minimo"),
        "maximo": meta.get("maximo"),
    }
