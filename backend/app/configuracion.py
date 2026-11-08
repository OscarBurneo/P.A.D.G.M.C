"""Configuración leída del entorno. Los secretos no tienen valor por defecto usable."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

RAIZ = Path(__file__).resolve().parents[2]


class Ajustes(BaseSettings):
    """Parámetros de arranque.

    Hash, inactividad y protección de la última cuenta administradora son
    propuestas pendientes de aprobación (P-09).
    """

    model_config = SettingsConfigDict(
        env_file=str(RAIZ / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    entorno: str = "desarrollo"
    base_datos_url: str = "postgresql+psycopg://padgmc:cambiar-esto@localhost:5432/padgmc"
    sembrar_al_iniciar: bool = True

    admin_identificador: str = "admin"
    admin_nombre: str = "Administrador inicial"
    admin_correo: str = "admin@padgmc.example"
    admin_contrasena: str = "cambiar-esto"

    cookie_nombre: str = "padgmc_sesion"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    confiar_proxy: bool = False
    cors_origenes: str = "http://localhost:5173,http://localhost:8080"

    sesion_inactividad_minutos: int = Field(default=30, ge=5, le=720)
    sesion_duracion_maxima_horas: int = Field(default=8, ge=1, le=72)
    contrasena_longitud_minima: int = Field(default=10, ge=8, le=128)
    proteger_ultima_cuenta_admin: bool = True

    argon2_time_cost: int = Field(default=3, ge=1, le=10)
    argon2_memory_cost: int = Field(default=65536, ge=8192, le=1048576)
    argon2_parallelism: int = Field(default=2, ge=1, le=8)
    argon2_hash_len: int = Field(default=32, ge=16, le=64)
    argon2_salt_len: int = Field(default=16, ge=16, le=64)

    @property
    def cookie_es_segura(self) -> bool:
        if self.entorno == "produccion":
            return True
        return self.cookie_secure

    @property
    def origenes_cors(self) -> list[str]:
        return [origen.strip() for origen in self.cors_origenes.split(",") if origen.strip()]


@lru_cache
def obtener_ajustes() -> Ajustes:
    return Ajustes()


ajustes = obtener_ajustes()
