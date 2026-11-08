"""Motor y sesiones de SQLAlchemy."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.configuracion import ajustes


class Base(DeclarativeBase):
    pass


motor = create_engine(ajustes.base_datos_url, pool_pre_ping=True)
SesionLocal = sessionmaker(bind=motor, autoflush=False, expire_on_commit=False)
