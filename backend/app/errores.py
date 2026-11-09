"""Error de dominio con respuesta JSON en español."""


class ErrorAplicacion(Exception):
    def __init__(self, estado: int, detalle: str, codigo: str) -> None:
        self.estado = estado
        self.detalle = detalle
        self.codigo = codigo
        super().__init__(detalle)
