"""Consulta agregada. El diccionario de socios todavía no está aprobado (P-01)."""

from fastapi import APIRouter, Depends

from app.dependencias import exige
from app.errores import ErrorAplicacion
from app.modelos import Usuario

router = APIRouter(prefix="/api/ubicaciones", tags=["ubicaciones"])


@router.get("")
def consultar(_: Usuario = Depends(exige("ubicaciones.consultar"))) -> dict:
    return {
        "total_registros": 0,
        "agregado": [],
        "nota": "Módulo previsto para el sprint de registro. No hay coordenadas individuales.",
    }


@router.post("")
def registrar(_: Usuario = Depends(exige("ubicaciones.consultar"))) -> None:
    raise ErrorAplicacion(
        501,
        "El registro de ubicaciones se implementará cuando el diccionario de datos esté aprobado.",
        "modulo_pendiente",
    )
