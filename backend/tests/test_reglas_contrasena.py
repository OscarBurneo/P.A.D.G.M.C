"""RG-AUTH-01. Límites de la política propuesta de contraseñas (P-09)."""

import pytest

from app.seguridad.contrasenas import validar_politica


@pytest.mark.parametrize(
    ("contrasena", "identificador", "minimo", "valida"),
    [
        ("ClaveSegura1", "admin", 10, True),
        ("Abcdefghij1", "admin", 12, False),
        ("Corta1", "admin", 10, False),
        ("SoloLetrasX", "admin", 10, False),
        ("1234567890", "admin", 10, False),
        ("Admin12345", "admin12345", 10, False),
        ("ClaveSegu1", "admin", 10, True),
    ],
)
def test_limites(contrasena: str, identificador: str, minimo: int, valida: bool) -> None:
    error = validar_politica(contrasena, identificador, minimo)
    assert (error is None) is valida
