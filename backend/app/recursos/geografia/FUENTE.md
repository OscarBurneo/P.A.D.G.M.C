# Límites provinciales de Ecuador

Archivo: `ecuador-adm1.geojson` (EPSG:4326, `MultiPolygon`).

## Fuente

| Campo | Valor |
| --- | --- |
| Producto | geoBoundaries gbOpen, Ecuador, ADM1 (provincias) |
| Identificador | `ECU-ADM1-780006` |
| Año representado | 2011 |
| Construcción | 12 de diciembre de 2023 |
| Unidades | 24 provincias, incluida Galápagos |
| Archivo de origen | [geoBoundaries-ECU-ADM1_simplified.geojson](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/ECU/ADM1/geoBoundaries-ECU-ADM1_simplified.geojson) (commit `9469f09`) |
| API consultada | `https://www.geoboundaries.org/api/current/gbOpen/ECU/ADM1/` |
| Origen declarado | geoBoundaries, Wikimedia Commons |
| Licencia declarada por geoBoundaries para este límite | **CC0 1.0 Universal** (dominio público) |
| Texto de la licencia | https://creativecommons.org/publicdomain/zero/1.0/ |

El archivo de este repositorio parte de ese GeoJSON simplificado. Cada anillo se guarda como `MultiPolygon` y las coordenadas se redondean a 4 decimales (cerca de 11 m). No se altera el conjunto de provincias.

Cita del proyecto, aparte de la licencia del archivo:

> Runfola, D. et al. (2020) geoBoundaries: A global database of political administrative boundaries. PLoS ONE 15(4): e0231866. https://doi.org/10.1371/journal.pone.0231866

`shapeISO` no es único en esta entrega (Cotopaxi y Chimborazo comparten `EC-H`). La clave estable del límite es `shapeID`.

## Cómo se usa

La migración `0002_cobertura_nacional` crea `limites_provinciales` y `cobertura_provincial`. Al arrancar, la semilla carga el GeoJSON si la tabla de límites está vacía y crea la cobertura inicial si la tabla de cobertura está vacía.

`cobertura_inicial.json` es la configuración de provincias con agencia, no una lista fija en las consultas. La aplicación lee `cobertura_provincial`. En Configuración, quien tiene `parametros.editar` puede activar o quitar cualquier provincia del catálogo de límites. La propuesta inicial es Loja, El Oro, Zamora Chinchipe, Pichincha (con el Distrito Metropolitano de Quito), Santo Domingo de los Tsáchilas, Manabí, Chimborazo y Guayas.

`alias_nombres.json` solo corrige tildes que el archivo de origen omite (`Manabi`, `Sucumbios`).

Galápagos va marcado con `es_galapagos`. El mapa principal encuadra el Ecuador continental y muestra el archipiélago en un recuadro, para que no aleje el encuadre.

No hay límites cantonales en esta entrega. El filtro por cantón queda preparado para cuando existan registros agregados.
