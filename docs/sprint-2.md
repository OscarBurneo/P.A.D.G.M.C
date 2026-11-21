# Sprint 2 — carga, validación y concentración

Contrato de columnas: [`contrato-columnas.md`](contrato-columnas.md), versión `0.1.0-propuesto`. Plantillas: [`plantillas/socios.csv`](plantillas/socios.csv) y [`plantillas/socios.xlsx`](plantillas/socios.xlsx).

El índice de esta entrega no es el índice de expansión ni un índice de oportunidad. Es la densidad de registros aceptados por agencia, normalizada de 0 a 100 dentro del resultado. Cada provincia informa además la densidad por km² (`ST_Area(geometria::geography) / 1e6`). Los registros aceptados que no intersectan ninguna provincia se cuentan aparte. La tendencia queda vacía si no hay un lote anterior. La capa de calor y el índice cuentan solo filas aceptadas; las observadas quedan en el informe. La grilla es de 0,01 grados y no identifica a la persona.

| Historia | Qué queda | Rutas | Archivos | Prueba |
| --- | --- | --- | --- | --- |
| HU-07 | Elegir y cargar CSV o XLSX. Rechaza XLS, vacío e ilegible. No ejecuta fórmulas. | `POST /api/importaciones` | `importaciones/lectura.py`, `importaciones/rutas.py`, `alembic/versions/0003_importacion.py` | `test_hu07_carga_csv_y_xlsx_y_rechaza_lo_ilegible` |
| HU-08 | Revisar encabezados y estructura. `/api/validacion` ya no responde 501. | `GET /api/validacion`, `GET /api/validacion/{lote_id}`, `PATCH /api/importaciones/{id}/mapeo` | `importaciones/contrato.py`, `validacion/rutas.py` | `test_hu08_revisa_encabezados_y_la_validacion_responde` |
| HU-10 | Campos obligatorios del contrato. Solo la fila aceptada entra al mapa y al índice. | El informe del lote | `importaciones/clasificacion.py`, `analitica/indice.py`, `mapas/consulta.py` | `test_hu10_hu11_obligatorios_y_normalizacion`, `test_hu10_hu12_hu51_observadas_fuera_del_analisis` |
| HU-11 | Espacios, coma decimal, fecha `DD/MM/AAAA` y tildes en la comparación. | El informe y `atributos_socio` | `importaciones/clasificacion.py` | `test_hu10_hu11_obligatorios_y_normalizacion` |
| HU-49 | La coordenada tiene que caer en `limites_provinciales`, incluidas Galápagos. | El informe | `importaciones/clasificacion.py` | `test_hu49_coordenadas_dentro_de_ecuador_y_galapagos` |
| HU-12 | Aceptada, observada o rechazada. La observada queda en el informe y no cuenta en el mapa ni en el índice. | El informe | `importaciones/clasificacion.py`, `analitica/indice.py`, `mapas/consulta.py` | `test_hu12_hu50_hu52_clasificacion_duplicados_y_cuadre`, `test_hu10_hu12_hu51_observadas_fuera_del_analisis` |
| HU-50 | Solo la regla combinada: identificador repetido se rechaza; misma celda de ~5 m y otro identificador queda observada. | El informe | `importaciones/contrato.py` (`TAMANO_METROS`), `clasificacion.py` | `test_hu12_hu50_hu52_clasificacion_duplicados_y_cuadre` |
| HU-52 | `total = válidas + observadas + rechazadas`. | `cuadra` en el lote y en el informe | `importaciones/servicio.py` | `test_hu12_hu50_hu52_clasificacion_duplicados_y_cuadre` |
| HU-09 | Confirmar o cancelar antes de procesar. La recarga de un lote cancelado quedó en [PR #8](https://github.com/OscarBurneo/P.A.D.G.M.C/pull/8) (merge 20c025d). | `POST /api/importaciones/{id}/publicar`, `POST /api/importaciones/{id}/cancelar` | `importaciones/servicio.py`, `paginas/Importar.tsx` | `test_hu09_cancelar_antes_de_procesar` |
| HU-51 | Publicar en una transacción. Un fallo no deja ubicaciones del lote. El mapa y el índice cuentan solo las aceptadas. | `POST /api/importaciones/{id}/publicar` | `importaciones/servicio.py`, `analitica/indice.py` | `test_hu51_publicacion_sin_resultados_parciales`, `test_hu10_hu12_hu51_observadas_fuera_del_analisis` |
| HU-16 | Estado de una importación. | `GET /api/importaciones/{id}` | `importaciones/servicio.py`, `paginas/Inicio.tsx` | `test_hu16_hu13_estado_e_historial` |
| HU-13 | Historial de archivos. | `GET /api/importaciones` | `importaciones/servicio.py`, `paginas/Importar.tsx` | `test_hu16_hu13_estado_e_historial` |
| HU-14 | Retirar sin borrar el archivo. El lote deja de contar. | `POST /api/importaciones/{id}/retirar` | `importaciones/servicio.py` | `test_hu14_retirar_conserva_el_archivo_y_sale_del_analisis` |
| HU-46 | Los eventos de importación entran en la auditoría que ya existía. No hay rutas nuevas de auditoría. | `GET /api/auditoria` | `importaciones/servicio.py` | `test_hu46_la_importacion_queda_en_auditoria` |
| HU-29 | Conteo por provincia, registros sin zona y densidad por km², además de la densidad por agencia. | `GET /api/mapas/resumen` | `analitica/indice.py`, `mapas/consulta.py`, `paginas/Inicio.tsx`, `paginas/Mapa.tsx` | `test_hu29_hu30_hu22_indice_ranking_y_calor`, `test_hu29_sin_zona_y_densidad_por_km2` |
| HU-30 | Provincias ordenadas por el índice de concentración. La etiqueta es `alta_concentracion`. Tendencia vacía sin lote anterior. | `GET /api/mapas/resumen` (`ranking`) | `analitica/indice.py`, `mapas/consulta.py`, `paginas/Inicio.tsx` | `test_hu29_hu30_hu22_indice_ranking_y_calor` |
| HU-22 | Capa de calor con las filas aceptadas, en grilla. El foco con datos reales quedó en [PR #8](https://github.com/OscarBurneo/P.A.D.G.M.C/pull/8) (merge 20c025d). | `GET /api/mapas/calor` | `mapas/consulta.py`, `componentes/MapaEcuador.tsx` | `test_hu29_hu30_hu22_indice_ranking_y_calor`, `test_hu10_hu12_hu51_observadas_fuera_del_analisis` |
| HU-64 | La carga de 10 000 filas se mide en la prueba, sin ampliar el script de autenticación. | `POST /api/importaciones` | `tests/test_importaciones.py` | `test_hu64_diez_mil_filas` |
| HU-67 | Reglas y pruebas con identificador, más la migración reversible. | — | `docs/sprint-2.md`, `docs/contrato-columnas.md` | `test_hu67_contrato_documentado_y_migracion_reversible` |

Permisos nuevos en la matriz propuesta, solo para el rol administrador: `importaciones.publicar` y `importaciones.retirar`. Cargar, mapear y cancelar usan `importaciones.cargar`. Consultar el informe usa `validacion.consultar`.

Una carga con el mismo hash del archivo crea un `IntentoCarga` y devuelve el lote previo. La prueba es `test_carga_identica_devuelve_el_lote_previo`. Quien no tiene el permiso recibe 403: `test_permiso_impide_importar_publicar_y_retirar`.
