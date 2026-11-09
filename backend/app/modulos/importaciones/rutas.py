"""El contrato de importación está pendiente de aprobación (P-01)."""

from fastapi import APIRouter, Depends

from app.dependencias import exige
from app.errores import ErrorAplicacion
from app.modelos import Usuario

router = APIRouter(prefix="/api/importaciones", tags=["importaciones"])


@router.post("")
def cargar(_: Usuario = Depends(exige("importaciones.cargar"))) -> None:
    raise ErrorAplicacion(
        501,
        "La carga de archivos se implementará con el contrato de importación aprobado.",
        "modulo_pendiente",
    )


@router.get("")
def listar(_: Usuario = Depends(exige("importaciones.cargar"))) -> dict:
    return {"lotes": [], "nota": "Módulo previsto para un sprint posterior."}
