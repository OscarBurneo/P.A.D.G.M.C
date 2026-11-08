"""Salud pública, sin secretos ni datos de cuentas."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.configuracion import ajustes
from app.dependencias import obtener_db
from app.errores import ErrorAplicacion

router = APIRouter(prefix="/api", tags=["salud"])


@router.get("/salud")
def salud(db: Session = Depends(obtener_db)) -> dict:
    try:
        postgis = db.execute(text("SELECT PostGIS_Version()")).scalar()
        h3_disponible = bool(
            db.execute(text("SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'h3')")).scalar()
        )
        h3_habilitada = bool(
            db.execute(text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'h3')")).scalar()
        )
    except Exception as exc:  # noqa: BLE001
        raise ErrorAplicacion(503, "La base de datos no está disponible.", "base_no_disponible") from exc
    return {
        "estado": "ok",
        "servicio": "P.A.D.G.M.C",
        "entorno": ajustes.entorno,
        "postgis": postgis,
        "srid_referencia": 4326,
        "h3_disponible": h3_disponible,
        "h3_habilitada": h3_habilitada,
    }
