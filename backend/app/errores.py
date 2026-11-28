"""Error de dominio con respuesta JSON en español."""


class ErrorAplicacion(Exception):
    def __init__(
        self,
        estado: int,
        detalle: str,
        codigo: str,
        errores: list[dict[str, str]] | None = None,
    ) -> None:
        self.estado = estado
        self.detalle = detalle
        self.codigo = codigo
        self.errores = errores
        super().__init__(detalle)
