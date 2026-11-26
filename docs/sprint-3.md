# Sprint 3 — filtrar y leer el calor

El contrato de columnas no cambia: sigue en [`contrato-columnas.md`](contrato-columnas.md), versión `0.1.0-propuesto`. El ejemplo sintético está en [`../datos/sinteticos/LEEME.md`](../datos/sinteticos/LEEME.md).

El catálogo de filtros y el de indicadores de la selección son propuestas. Oscar tiene que aprobarlos antes de tratarlos como acuerdo con la cooperativa. La versión de ambos es `0.1.0-propuesto` y la API lo dice en `propuesto: true`.

## Catálogo de filtros propuesto

Sale de los atributos que la importación ya guarda y de la capa ADM1 ya cargada. No se inventan campos nuevos.

| Campo | Operador | Origen | Combinación |
| --- | --- | --- | --- |
| Provincia declarada | `en` | `atributos_socio.provincia_clave` | Varios valores con O |
| Cantón | `en` | `atributos_socio.canton_clave` | Varios valores con O. No hay contorno cantonal. |
| Agencia | `en` | `atributos_socio.agencia`, sin distinguir mayúsculas | Varios valores con O |
| Fecha | `entre`, `desde` o `hasta` | `atributos_socio.fecha`, inclusive, forma `AAAA-MM-DD` | Un solo rango |
| Zona geográfica | `cubre` | `limites_provinciales` con `ST_Intersects` | Varias zonas con O |

Campos distintos se combinan con Y. Un campo u operador que no está en el catálogo responde 422 `filtro_no_autorizado`. Una zona que no existe responde 422 `zona_desconocida`. Un valor vacío responde 422 `filtro_invalido`.

La regla de frontera propuesta es `ST_Intersects`, la misma de la densidad por provincia (HU-29). Para un punto, eso incluye el límite y equivale a la relación de cobertura. Sin capa territorial cargada, el filtro de zona no se acepta.

El calor y el resumen usan el mismo predicado y la misma `version_datos` (el hash de los lotes en estado completado). Los filtros no crean otro `ResultadoAnalisis`: el índice de la selección se calcula al leer, con la misma fórmula. La tendencia no se compara con el resultado anterior cuando hay filtros, porque esa diferencia dejaría de ser el mismo universo. El resultado vigente, sin filtros, sigue guardado.

`total_registros` del resumen sigue siendo la suma por provincia. El indicador «Registros aceptados» de la selección suma también `registros_sin_zona` y coincide con el total de la capa de calor. `calidad_registros` sigue siendo la del último lote publicado; no se recalcula para la selección.

## Leyenda

La leyenda del calor trae variable (`Registros aceptados`), unidad (`registros por celda de 0,01 grados`), intervalos con etiqueta y patrón, y dos textos distintos:

- Cero: la zona pedida existe en la capa y el conteo de la selección es 0.
- Ausencia: no hay celdas. No es el valor cero.

Los patrones (puntos, rayas, diagonal, sólido) y las etiquetas se leen sin depender del color. El color del mapa es la intensidad relativa del peso de la celda dentro de la selección, no una clase cerrada del núcleo de calor.

## Historias

| Historia | Estado | Qué queda | Rutas | Prueba |
| --- | --- | --- | --- | --- |
| HU-24 | Hecho | Leyenda con variable, unidad, intervalos, cero y ausencia. | `GET /api/mapas/calor` (`leyenda`) | `test_filtros_leyenda_zona_y_combinacion`, `LeyendaCalor.test.tsx`, `Mapa.test.tsx` |
| HU-25 | Hecho, catálogo propuesto | Filtro por provincia, cantón, agencia y fecha. Rechaza campos ajenos. | `GET /api/mapas/filtros`, `GET /api/mapas/calor`, `GET /api/mapas/resumen` | `test_filtros_leyenda_zona_y_combinacion` |
| HU-26 | Hecho, frontera propuesta | Zona ADM1, incluido el punto sobre el límite. Mapa e indicadores usan la misma selección. | `zona` en calor y resumen | `test_filtros_leyenda_zona_y_combinacion` |
| HU-27 | Hecho, semántica propuesta | Y entre campos y O entre valores del mismo campo. | Los mismos query params | `test_filtros_leyenda_zona_y_combinacion` |
| HU-54 | Hecho | Publicar o filtrar refresca calor e indicadores con la misma versión. Si falla, la pantalla no deja los números anteriores como vigentes. | `paginas/Mapa.tsx` | `Mapa.test.tsx` |
| HU-55 | Hecho | Aplicar o quitar filtros actualiza la capa y la leyenda. La selección vacía es ausencia de datos. | `paginas/Mapa.tsx`, `consulta.py` | `test_filtros_leyenda_zona_y_combinacion`, `Mapa.test.tsx` |
| HU-56 | Hecho | Restablecer quita los filtros de datos y vuelve al conjunto autorizado. No toca registros ni permisos. | Botón en el mapa | `filtros.test.ts` |
| HU-28 | Hecho, catálogo propuesto | Total de la selección (vacío = 0) y métricas que salen «No disponible» cuando no se pueden calcular. | `indicadores_seleccion` en el resumen | `test_filtros_leyenda_zona_y_combinacion` |
| HU-57 | Hecho | Lista campo, operador y valor, incluida la zona. Quitar un filtro actualiza la lista y la vista. | `filtros_activos` | `test_filtros_leyenda_zona_y_combinacion`, `Mapa.test.tsx` |

## Bugs

| Bug | Estado | Corrección | Prueba |
| --- | --- | --- | --- |
| 3 | Hecho | El selector de `Importar.tsx` se vacía al elegir el archivo, así que el mismo CSV vuelve a disparar el envío y no queda `C:\fakepath\...`. | `Importar.test.tsx` |
| 4 | Hecho | El historial devuelve `actor`, acepta filtros por actor, estado, nombre y fechas, y `actualizado_en` cambia al publicar, revalidar, cancelar o retirar. Hace falta la migración `0004_lote_actualizado_en` porque el lote solo tenía la fecha de alta. | `test_bug4_historial_trae_actor_filtros_y_actualizado` |
| 5 | Hecho | La auditoría filtra por lote (`entidad_id`) o por entidad, y la pantalla pagina con límite y desplazamiento. | `test_bug5_auditoria_filtra_por_lote_o_entidad_y_pagina`, `Auditoria.test.tsx` |
| 6 | Hecho | `invalidos` es el conteo de rechazadas. `procesadas = aceptadas + observadas + rechazadas`. | `test_bug6_invalidos_cuentan_rechazadas_y_no_observadas` |

La migración `0004` es reversible: baja el índice y la columna. No cambia el contrato de importación ni la forma de publicar un lote. El índice filtrado no se persiste, así que no hay otra tabla.

## Datos de ejemplo

`datos/sinteticos/socios_ejemplo.csv` tiene 3000 filas y semilla `20261123`. 150 filas (5 %) son defectos: coordenadas fuera del Ecuador, un campo vacío, ejes intercambiados o identificador repetido. El resto cae dentro de la provincia declarada. No son socios de la cooperativa.

```bash
python herramientas/generar_datos_sinteticos.py
```

La prueba `test_el_csv_de_ejemplo_es_reproducible_y_marca_los_defectos` comprueba que el archivo del repositorio coincide con esa semilla.

## HU-05 — validar antes de guardar

`POST /api/ubicaciones` ya no responde 501. El alta manual usa el contrato de 8 columnas de [`contrato-columnas.md`](contrato-columnas.md), el mismo que la importación, y pasa por `clasificar()` para no duplicar las reglas. Solo una fila `aceptada` se guarda y responde 201. Cualquier motivo de rechazo u observación responde 422 `ubicacion_invalida` y no inserta la fila. Cada error trae `campo`, `regla`, `mensaje` y `accion`.

| Regla | Qué exige | Si falla |
| --- | --- | --- |
| Obligatorios | Los ocho campos del contrato | 422 `obligatorio_<campo>` |
| Tipo | Texto en los campos de texto y número o texto decimal en latitud y longitud | 422 `tipo_texto` o `tipo_decimal` |
| Formato y rango | Decimal con un solo separador, latitud de -90 a 90, longitud de -180 a 180, fecha `AAAA-MM-DD`, `DD/MM/AAAA` o `DD-MM-AAAA` | 422 `formato_latitud`, `formato_longitud` o `formato_fecha` |
| Fórmula | Un valor que empieza por `=` no se ejecuta | 422 `formato_formula` |
| Ecuador | `ST_Intersects` contra `limites_provinciales`, incluidas Galápagos y el borde | 422 `coordenada_fuera_de_ecuador` |
| Provincia | La provincia declarada tiene que ser la que contiene el punto | 422 `provincia_no_coincide` |
| Duplicados | Identificador ya publicado o de otra alta, y celda de unos 5 m en el mismo cantón con otro identificador | 422 `identificador_duplicado` o `ubicacion_coincidente` |

El permiso es `importaciones.publicar`, el mismo que confirma un lote. El conteo de `GET /api/ubicaciones` incluye estas altas. El mapa y el índice siguen leyendo solo lotes en estado `completado`.

| Historia | Estado | Qué queda | Rutas | Prueba |
| --- | --- | --- | --- | --- |
| HU-05 | Hecho, con decisiones abajo | Validar y guardar una ubicación, o rechazarla por campo sin persistirla. | `POST /api/ubicaciones` | `test_hu05.py` |

## Decisiones que Oscar tiene que aprobar

1. El catálogo de filtros `0.1.0-propuesto` y sus operadores fijos.
2. La semántica Y / O y la frontera `ST_Intersects`, que incluye el límite.
3. El catálogo de indicadores de la selección, sobre todo que la tendencia no se calcule cuando hay filtros y que `calidad_registros` siga siendo la del último lote.
4. La columna `actualizado_en` del lote. Es una migración pequeña y reversible; el campo que ya se mostraba copiaba la fecha de alta.
5. En el alta manual, una fila que la importación dejaría como `observada` (provincia distinta o celda de 5 m) no se guarda: HU-05 pide no persistir lo inválido. En el CSV esas filas sí se publican, fuera del mapa.
6. No hay contorno cantonal, así que el cantón se valida como texto obligatorio y entra en la regla de duplicado por celda. No se contrasta con una geometría.
7. El alta usa `importaciones.publicar` hasta que exista un permiso `ubicaciones.crear`. La cadena de versión del contrato sigue siendo `0.1.0-propuesto`.
8. Un alta manual no entra al mapa ni al índice. Sí entra al conteo de `GET /api/ubicaciones`. Hace falta decidir si el calor debe contarla.
