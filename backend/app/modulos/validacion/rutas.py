"""Las reglas de validación quedan para cuando exista el diccionario (P-01)."""

from fastapi import APIRouter, Depends

from app.dependencias import exige
from app.errores import ErrorAplicacion
from app.modelos import Usuario

router = APIRouter(prefix="/api/validacion", tags=["validación"])


@router.get("")
def consultar(_: Usuario = Depends(exige("validacion.consultar"))) -> None:
    raise ErrorAplicacion(
        501,
        "La validación de cargas se implementará con las reglas aprobadas.",
        "modulo_pendiente",
    )
