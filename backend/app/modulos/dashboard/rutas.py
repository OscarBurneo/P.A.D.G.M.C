"""Lectura agregada del inicio. Usa los mismos filtros que el mapa."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.dependencias import exige, obtener_db
from app.modelos import Usuario
from app.modulos.dashboard.servicio import resumen
from app.modulos.mapas.filtros import interpretar

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/resumen")
def resumen_dashboard(
    request: Request,
    _: Usuario = Depends(exige("mapas.ver")),
    db: Session = Depends(obtener_db),
) -> dict:
    return resumen(db, interpretar(request.query_params, db))
