# Datos sintéticos de ejemplo

Este CSV **no contiene socios de la Cooperativa Padre Julián Lorente**. Es un archivo de ejemplo para el mapa de calor del Sprint 3: 3000 filas del contrato vigente de 8 columnas, repartidas en las ocho provincias con agencia, con un 5 % de filas defectuosas a propósito.

La semilla es `20261123`. Volver a generarlo, desde la raíz del repositorio, produce el mismo archivo:

```bash
python herramientas/generar_datos_sinteticos.py
```

El script escribe `datos/sinteticos/socios_ejemplo.csv`. No cambia el contrato de importación.

De las 3000 filas, 150 son defectos (5 %): 38 coordenadas fuera del Ecuador, 37 con un campo obligatorio vacío, 37 con latitud y longitud intercambiadas, y 38 en pares que repiten un identificador que no usa ninguna fila válida. El importador rechaza todas las copias de un identificador repetido; por eso el par no reutiliza el id de una fila buena.

El resto cae dentro de la provincia declarada, con margen respecto del límite, para que la carga de ejemplo publique registros aceptados. Las agencias y los cantones son nombres de ejemplo, no el padrón de la cooperativa.
