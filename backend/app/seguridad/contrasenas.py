"""Argon2id con sal individual. El perfil está pendiente de aprobación (P-09)."""

import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

from app.configuracion import ajustes

_senuelo: str | None = None


def hasher() -> PasswordHasher:
    return PasswordHasher(
        time_cost=ajustes.argon2_time_cost,
        memory_cost=ajustes.argon2_memory_cost,
        parallelism=ajustes.argon2_parallelism,
        hash_len=ajustes.argon2_hash_len,
        salt_len=ajustes.argon2_salt_len,
    )


def generar_hash(contrasena: str) -> str:
    return hasher().hash(contrasena)


def _hash_senuelo() -> str:
    global _senuelo
    if _senuelo is None:
        _senuelo = generar_hash(secrets.token_urlsafe(32))
    return _senuelo


def verificar(hash_guardado: str | None, contrasena: str) -> bool:
    """Comprueba la contraseña. Si no hay cuenta, verifica un señuelo para no abreviar el tiempo."""

    objetivo = hash_guardado or _hash_senuelo()
    try:
        hasher().verify(objetivo, contrasena)
    except (VerifyMismatchError, VerificationError, ValueError):
        return False
    return hash_guardado is not None


def validar_politica(contrasena: str, identificador: str, longitud_minima: int) -> str | None:
    """Devuelve un mensaje en español si la contraseña no cumple la política propuesta."""

    if len(contrasena) < longitud_minima:
        return f"La contraseña debe tener al menos {longitud_minima} caracteres."
    if len(contrasena) > 200:
        return "La contraseña supera la longitud máxima de 200 caracteres."
    if not any(caracter.isalpha() for caracter in contrasena) or not any(caracter.isdigit() for caracter in contrasena):
        return "La contraseña debe incluir letras y números."
    if contrasena.casefold() == identificador.casefold():
        return "La contraseña no puede coincidir con el identificador."
    return None


def es_marcador(contrasena: str) -> bool:
    return contrasena.strip().casefold() in {"", "cambiar-esto", "ejemplo", "placeholder"}
