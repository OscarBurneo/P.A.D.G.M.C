"""Lectura de parámetros de negocio. El valor vigente vive en la base, no en el código."""

from sqlalchemy.orm import Session

from app.catalogo import PARAMETROS
from app.modelos import Parametro


def leer(db: Session, clave: str) -> object:
    fila = db.get(Parametro, clave)
    if fila is None:
        return PARAMETROS[clave]["defecto"]
    return fila.valor["dato"]


def leer_entero(db: Session, clave: str) -> int:
    return int(leer(db, clave))


def leer_booleano(db: Session, clave: str) -> bool:
    return bool(leer(db, clave))
