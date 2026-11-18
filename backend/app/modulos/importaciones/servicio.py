"""Carga, validación, publicación y retiro de lotes."""

import hashlib
import json
import uuid
from datetime import UTC
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.configuracion import ajustes
from app.errores import ErrorAplicacion
from app.modelos import InformeValidacion, IntentoCarga, LoteImportacion, Usuario
from app.modulos.analitica.indice import recalcular
from app.modulos.auditoria.servicio import registrar
from app.modulos.importaciones.clasificacion import (
    ResultadoClasificacion,
    clasificar,
    observaciones_de,
)
from app.modulos.importaciones.contrato import VERSION_CONTRATO, columnas_publicas
from app.modulos.importaciones.lectura import ArchivoTabular, leer

PENDIENTE = "pendiente"
EJECUTANDOSE = "ejecutandose"
COMPLETADO = "completado"
FINALIZADO_CON_ERRORES = "finalizado_con_errores"
CANCELADO = "cancelado"
RETIRADO = "retirado"

ETIQUETAS = {
    PENDIENTE: "Pendiente",
    EJECUTANDOSE: "Ejecutándose",
    COMPLETADO: "Completado",
    FINALIZADO_CON_ERRORES: "Finalizado con errores",
    CANCELADO: "Cancelado",
    RETIRADO: "Retirado",
}

_NOTA = (
    "Historial de archivos importados. El contrato de columnas es una propuesta "
    f"({VERSION_CONTRATO}) y puede cambiar después de la reunión con los stakeholders."
)


def listar(db: Session) -> dict:
    lotes = db.scalars(select(LoteImportacion).order_by(LoteImportacion.fecha.desc())).all()
    return {
        "nota": _NOTA,
        "contrato_version": VERSION_CONTRATO,
        "columnas": columnas_publicas(),
        "lotes": [_resumen(db, lote) for lote in lotes],
    }


def detalle(db: Session, lote_id: uuid.UUID) -> dict:
    lote = _obtener(db, lote_id)
    cuerpo = _resumen(db, lote)
    informe = _informe(db, lote.id)
    cuerpo["informe"] = _informe_publico(informe) if informe else None
    cuerpo["intentos"] = _contar_intentos(db, lote.id)
    return cuerpo


def recibir(
    db: Session,
    actor: Usuario,
    nombre: str,
    contenido: bytes,
    mapeo: dict | None,
) -> dict:
    formato = _formato_nombre(nombre)
    resumen = hashlib.sha256(contenido).hexdigest()
    visible = _nombre_visible(nombre)
    previo = db.scalar(
        select(LoteImportacion)
        .where(LoteImportacion.resumen_criptografico == resumen)
        .order_by(LoteImportacion.fecha.desc())
        .limit(1)
    )
    if previo is not None:
        intento = IntentoCarga(
            lote_id=previo.id,
            actor_id=actor.id,
            nombre_archivo=visible,
            resumen_criptografico=resumen,
            estado="registrado",
            resultado="duplicado",
        )
        db.add(intento)
        _auditar(
            db,
            actor,
            "importacion.reintentar",
            previo.id,
            "exito",
            despues={"estado": previo.estado, "archivo": visible},
            mensaje="La carga repite un archivo ya registrado. Se devuelve el lote previo.",
        )
        db.commit()
        cuerpo = detalle(db, previo.id)
        cuerpo["repetido"] = True
        return cuerpo
    sufijo = Path(visible).suffix.casefold()
    nombre_lectura = visible if sufijo in {".csv", ".xlsx"} else f"{visible}.{formato}"
    try:
        archivo = leer(nombre_lectura, contenido)
    except ErrorAplicacion as exc:
        _auditar(
            db,
            actor,
            "importacion.cargar",
            None,
            "fallo",
            codigo_error=exc.codigo,
            despues={"archivo": visible},
            mensaje=exc.detalle,
        )
        db.commit()
        raise
    lote = LoteImportacion(
        nombre_archivo=visible,
        formato=formato,
        estado=PENDIENTE,
        actor_id=actor.id,
        resumen_criptografico=resumen,
        contrato_version=VERSION_CONTRATO,
    )
    db.add(lote)
    db.flush()
    ruta = _ruta(lote)
    try:
        clasificacion = clasificar(db, archivo, mapeo)
        _aplicar_estado(lote, clasificacion)
        _guardar_informe(db, lote, clasificacion)
        db.add(
            IntentoCarga(
                lote_id=lote.id,
                actor_id=actor.id,
                nombre_archivo=visible,
                resumen_criptografico=resumen,
                estado=lote.estado,
                resultado="nuevo",
            )
        )
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_bytes(contenido)
        _auditar(
            db,
            actor,
            "importacion.cargar",
            lote.id,
            "exito",
            despues={"estado": lote.estado, "archivo": visible, "totales": clasificacion.conteos()},
            mensaje="Se registró el lote y su informe de validación.",
        )
        db.commit()
    except Exception:
        db.rollback()
        ruta.unlink(missing_ok=True)
        raise
    return detalle(db, lote.id)


def revalidar(db: Session, actor: Usuario, lote_id: uuid.UUID, mapeo: dict) -> dict:
    lote = _obtener(db, lote_id, bloquea=True)
    if lote.estado not in {PENDIENTE, FINALIZADO_CON_ERRORES}:
        raise ErrorAplicacion(409, "El mapeo solo se revisa antes de publicar el lote.", "lote_no_editable")
    archivo = _leer_guardado(lote)
    clasificacion = clasificar(db, archivo, mapeo)
    _aplicar_estado(lote, clasificacion)
    _guardar_informe(db, lote, clasificacion)
    db.add(
        IntentoCarga(
            lote_id=lote.id,
            actor_id=actor.id,
            nombre_archivo=lote.nombre_archivo,
            resumen_criptografico=lote.resumen_criptografico,
            estado=lote.estado,
            resultado="revalidado",
        )
    )
    _auditar(
        db,
        actor,
        "importacion.revalidar",
        lote.id,
        "exito",
        despues={"estado": lote.estado, "totales": clasificacion.conteos()},
        mensaje="Se volvió a validar el lote con el mapeo indicado.",
    )
    db.commit()
    return detalle(db, lote.id)


def publicar(db: Session, actor: Usuario, lote_id: uuid.UUID) -> dict:
    lote = _obtener(db, lote_id, bloquea=True)
    if lote.estado != PENDIENTE:
        raise ErrorAplicacion(409, "Solo un lote pendiente se puede publicar.", "lote_no_publicable")
    lote_texto = str(lote.id)
    try:
        clasificacion = clasificar(db, _leer_guardado(lote), _mapeo_guardado(db, lote.id))
        _guardar_informe(db, lote, clasificacion)
        publicables = [fila for fila in clasificacion.filas if fila.clasificacion in {"aceptada", "observada"}]
        if not clasificacion.estructura_valida or not publicables:
            lote.estado = FINALIZADO_CON_ERRORES
            _auditar(
                db,
                actor,
                "importacion.publicar",
                lote.id,
                "fallo",
                codigo_error="lote_sin_filas_publicables",
                despues={"estado": lote.estado},
                mensaje="El lote no tiene filas publicables.",
            )
            db.commit()
            raise ErrorAplicacion(409, "El lote no tiene filas publicables.", "lote_sin_filas_publicables")
        lote.estado = EJECUTANDOSE
        db.flush()
        insertar_ubicaciones(db, lote.id, publicables)
        lote.estado = COMPLETADO
        db.flush()
        recalcular(db, actor.id)
        _auditar(
            db,
            actor,
            "importacion.publicar",
            lote.id,
            "exito",
            despues={"estado": COMPLETADO, "publicadas": len(publicables)},
            mensaje="El lote se publicó en una sola transacción.",
        )
        db.commit()
    except ErrorAplicacion:
        raise
    except Exception:
        db.rollback()
        _auditar(
            db,
            actor,
            "importacion.publicar",
            uuid.UUID(lote_texto),
            "fallo",
            codigo_error="publicacion_abortada",
            mensaje="La publicación se abortó y no quedó ningún registro del lote.",
        )
        db.commit()
        raise ErrorAplicacion(
            409,
            "La publicación se abortó. No quedó ningún registro del lote.",
            "publicacion_abortada",
        ) from None
    return detalle(db, lote_id)


def cancelar(db: Session, actor: Usuario, lote_id: uuid.UUID) -> dict:
    lote = _obtener(db, lote_id, bloquea=True)
    if lote.estado not in {PENDIENTE, FINALIZADO_CON_ERRORES}:
        raise ErrorAplicacion(
            409,
            "Solo se cancela un lote que todavía no se procesa.",
            "lote_no_cancelable",
        )
    lote.estado = CANCELADO
    _auditar(
        db,
        actor,
        "importacion.cancelar",
        lote.id,
        "exito",
        despues={"estado": CANCELADO},
        mensaje="El lote se canceló antes de procesarse.",
    )
    db.commit()
    return detalle(db, lote.id)


def retirar(db: Session, actor: Usuario, lote_id: uuid.UUID, motivo: str) -> dict:
    lote = _obtener(db, lote_id, bloquea=True)
    limpio = " ".join(motivo.split())
    if not limpio:
        raise ErrorAplicacion(422, "Indique un motivo de retiro.", "motivo_requerido")
    if lote.estado != COMPLETADO:
        raise ErrorAplicacion(409, "Solo se retira un lote publicado.", "lote_no_retirable")
    lote.estado = RETIRADO
    db.flush()
    recalcular(db, actor.id)
    _auditar(
        db,
        actor,
        "importacion.retirar",
        lote.id,
        "exito",
        despues={"estado": RETIRADO, "motivo": limpio[:200]},
        mensaje="El lote dejó de contar en el análisis. El archivo se conserva.",
    )
    db.commit()
    return detalle(db, lote.id)


def informes(db: Session) -> dict:
    filas = db.scalars(select(InformeValidacion).order_by(InformeValidacion.lote_id)).all()
    return {
        "contrato_version": VERSION_CONTRATO,
        "nota": "Informes de validación. El total procesado es aceptadas más observadas más rechazadas.",
        "informes": [_informe_breve(fila) for fila in filas],
    }


def informe_de_lote(db: Session, lote_id: uuid.UUID) -> dict:
    _obtener(db, lote_id)
    informe = _informe(db, lote_id)
    if informe is None:
        raise ErrorAplicacion(404, "El lote no tiene informe de validación.", "informe_desconocido")
    return _informe_publico(informe)


def insertar_ubicaciones(db: Session, lote_id: uuid.UUID, filas: list) -> int:
    payload = [{"lon": fila.longitud, "lat": fila.latitud, "attrs": fila.atributos()} for fila in filas]
    db.execute(
        text(
            """
            INSERT INTO ubicaciones (id, geom, creado_en, lote_id, atributos_socio)
            SELECT
                gen_random_uuid(),
                ST_SetSRID(ST_MakePoint((elem->>'lon')::float8, (elem->>'lat')::float8), 4326),
                now(),
                :lote,
                elem->'attrs'
            FROM jsonb_array_elements(CAST(:payload AS jsonb)) AS elem
            """
        ),
        {"lote": lote_id, "payload": json.dumps(payload)},
    )
    return len(payload)


def _aplicar_estado(lote: LoteImportacion, clasificacion: ResultadoClasificacion) -> None:
    conteos = clasificacion.conteos()
    publicables = conteos["aceptadas"] + conteos["observadas"]
    if clasificacion.estructura_valida and publicables > 0:
        lote.estado = PENDIENTE
    else:
        lote.estado = FINALIZADO_CON_ERRORES


def _guardar_informe(db: Session, lote: LoteImportacion, clasificacion: ResultadoClasificacion) -> None:
    conteos = clasificacion.conteos()
    informe = _informe(db, lote.id)
    if informe is None:
        informe = InformeValidacion(lote_id=lote.id)
        db.add(informe)
    informe.total_procesadas = conteos["procesadas"]
    informe.total_aceptadas = conteos["aceptadas"]
    informe.total_observadas = conteos["observadas"]
    informe.observaciones = observaciones_de(clasificacion)
    db.flush()


def _leer_guardado(lote: LoteImportacion) -> ArchivoTabular:
    ruta = _ruta(lote)
    if not ruta.is_file():
        raise ErrorAplicacion(409, "No se encuentra el archivo del lote.", "archivo_no_encontrado")
    return leer(ruta.name, ruta.read_bytes())


def _mapeo_guardado(db: Session, lote_id: uuid.UUID) -> dict | None:
    informe = _informe(db, lote_id)
    if informe is None or not informe.observaciones:
        return None
    mapeo = informe.observaciones.get("mapeo")
    return mapeo if isinstance(mapeo, dict) else None


def _resumen(db: Session, lote: LoteImportacion) -> dict:
    informe = _informe(db, lote.id)
    aceptadas = informe.total_aceptadas if informe else 0
    observadas = informe.total_observadas if informe else 0
    procesadas = informe.total_procesadas if informe else 0
    rechazadas = max(0, procesadas - aceptadas - observadas)
    return {
        "id": str(lote.id),
        "nombre": lote.nombre_archivo,
        "fuente": lote.formato.upper(),
        "formato": lote.formato,
        "validos": aceptadas,
        "observadas": observadas,
        "rechazadas": rechazadas,
        "invalidos": observadas,
        "total": procesadas,
        "cuadra": procesadas == aceptadas + observadas + rechazadas,
        "actualizado_en": lote.fecha.astimezone(UTC).isoformat(),
        "estado": ETIQUETAS.get(lote.estado, lote.estado),
        "estado_codigo": lote.estado,
        "contrato_version": lote.contrato_version,
        "cuenta_en_analisis": lote.estado == COMPLETADO,
        "repetido": False,
    }


def _informe_publico(informe: InformeValidacion) -> dict:
    datos = dict(informe.observaciones or {})
    rechazadas = max(0, informe.total_procesadas - informe.total_aceptadas - informe.total_observadas)
    return {
        "id": str(informe.id),
        "lote_id": str(informe.lote_id),
        "total_procesadas": informe.total_procesadas,
        "total_aceptadas": informe.total_aceptadas,
        "total_observadas": informe.total_observadas,
        "total_rechazadas": rechazadas,
        "cuadra": informe.total_procesadas == informe.total_aceptadas + informe.total_observadas + rechazadas,
        "estructura_valida": bool(datos.get("estructura_valida")),
        "encabezados": datos.get("encabezados") or [],
        "mapeo": datos.get("mapeo") or {},
        "columnas_faltantes": datos.get("columnas_faltantes") or [],
        "motivos": datos.get("motivos") or {},
        "muestra": datos.get("muestra") or [],
        "muestra_truncada": bool(datos.get("muestra_truncada")),
    }


def _informe_breve(informe: InformeValidacion) -> dict:
    datos = informe.observaciones or {}
    rechazadas = max(0, informe.total_procesadas - informe.total_aceptadas - informe.total_observadas)
    return {
        "id": str(informe.id),
        "lote_id": str(informe.lote_id),
        "total_procesadas": informe.total_procesadas,
        "total_aceptadas": informe.total_aceptadas,
        "total_observadas": informe.total_observadas,
        "total_rechazadas": rechazadas,
        "cuadra": informe.total_procesadas == informe.total_aceptadas + informe.total_observadas + rechazadas,
        "estructura_valida": bool(datos.get("estructura_valida")),
    }


def _obtener(db: Session, lote_id: uuid.UUID, *, bloquea: bool = False) -> LoteImportacion:
    consulta = select(LoteImportacion).where(LoteImportacion.id == lote_id)
    if bloquea:
        consulta = consulta.with_for_update()
    lote = db.scalar(consulta)
    if lote is None:
        raise ErrorAplicacion(404, "El lote no existe.", "lote_desconocido")
    return lote


def _informe(db: Session, lote_id: uuid.UUID) -> InformeValidacion | None:
    return db.scalar(select(InformeValidacion).where(InformeValidacion.lote_id == lote_id))


def _contar_intentos(db: Session, lote_id: uuid.UUID) -> int:
    total = db.scalar(select(func.count()).select_from(IntentoCarga).where(IntentoCarga.lote_id == lote_id))
    return int(total or 0)


def _ruta(lote: LoteImportacion) -> Path:
    sufijo = ".xlsx" if lote.formato == "xlsx" else ".csv"
    return ajustes.directorio_importaciones / f"{lote.id}{sufijo}"


def _formato_nombre(nombre: str) -> str:
    sufijo = Path(nombre or "").suffix.casefold()
    if sufijo == ".xlsx":
        return "xlsx"
    if sufijo == ".csv":
        return "csv"
    raise ErrorAplicacion(
        415,
        "Solo se aceptan archivos CSV o XLSX.",
        "formato_no_admitido",
    )


def _nombre_visible(nombre: str | None) -> str:
    base = Path(nombre or "archivo").name.replace("\x00", "")
    base = " ".join(base.split())
    return (base or "archivo")[:240]


def _auditar(
    db: Session,
    actor: Usuario,
    operacion: str,
    lote_id: uuid.UUID | None,
    resultado: str,
    *,
    codigo_error: str | None = None,
    despues: dict | None = None,
    mensaje: str | None = None,
) -> None:
    registrar(
        db,
        actor_tipo="usuario",
        actor_id=actor.id,
        actor_etiqueta=actor.identificador,
        operacion=operacion,
        entidad_tipo="lote",
        entidad_id=None if lote_id is None else str(lote_id),
        resultado=resultado,
        codigo_error=codigo_error,
        despues=despues,
        mensaje=mensaje,
    )
