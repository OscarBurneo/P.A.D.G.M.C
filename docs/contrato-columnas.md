# Contrato de columnas propuesto

Versión `0.1.0-propuesto`. Pendiente de aprobación (P-01). No es un acuerdo con la cooperativa: está concentrado en `backend/app/modulos/importaciones/contrato.py` para poder cambiar nombres, alias, tipos u obligatoriedad sin recorrer el resto del código.

La plantilla de ejemplo está en [`plantillas/socios.csv`](plantillas/socios.csv) y [`plantillas/socios.xlsx`](plantillas/socios.xlsx).

## Columnas

| Campo | Etiqueta | Tipo | Obligatorio | Alias que se reconocen | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| `identificador_socio` | Identificador de socio | texto | sí | identificador, id_socio, socio_id, cedula, codigo_socio | SOC-001 |
| `nombre` | Nombre | texto | sí | nombres, nombre_socio, razon_social | Ana Pérez |
| `latitud` | Latitud | decimal | sí | lat | -3.99313 |
| `longitud` | Longitud | decimal | sí | long, lng, lon | -79.20422 |
| `provincia` | Provincia | texto | sí | prov | Loja |
| `canton` | Cantón | texto | sí | canton | Loja |
| `agencia` | Agencia | texto | sí | oficina, sucursal | Agencia Centro |
| `fecha` | Fecha | fecha | sí | fecha_registro, fecha_alta | 2024-03-15 |

Las columnas de más se ignoran. Si falta una obligatoria, el lote no se publica y el informe explica qué encabezado no se pudo mapear. Quien carga puede corregir el mapeo antes de publicar.

## Tipos y normalización

- Texto: se recortan espacios y se unen los espacios internos. La comparación de identificador, provincia y cantón no distingue mayúsculas ni tildes.
- Decimal: se acepta coma o punto como separador, no los dos a la vez. La latitud va entre -90 y 90 y la longitud entre -180 y 180.
- Fecha: `AAAA-MM-DD`, `DD/MM/AAAA`, `DD-MM-AAAA` o el número de serie de una celda de fecha. Se guarda como `AAAA-MM-DD`.
- Una celda que empieza por `=` se trata como fórmula y se rechaza. El lector no la ejecuta ni abre macros.

## Coordenadas

El punto tiene que caer dentro de `limites_provinciales`, incluidas Galápagos. Si cae en otra provincia distinta de la declarada, la fila queda observada y se informa. Si cae fuera del país, se rechaza.

## Duplicados

Regla combinada, también propuesta (P-04), con la parte mínima de HU-50:

- Identificador repetido en el archivo o en un lote publicado vigente: la fila se **rechaza**.
- Misma ubicación, redondeada a una cuadrícula de unos 5 m (`TAMANO_METROS` en el contrato), en el mismo cantón y con otro identificador: la fila queda **observada**. No se pierde, se informa y no entra al mapa ni al índice.

Un archivo con el mismo hash SHA-256 no crea otro lote: se registra un intento nuevo y se devuelve el lote previo.
