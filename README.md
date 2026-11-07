# P.A.D.G.M.C — Plataforma de Análisis de Datos con Mapas de Calor

Plataforma web de análisis geoespacial para la **Cooperativa de Ahorro y Crédito Padre Julián Lorente**. Recoge la ubicación de potenciales futuros socios, procesa archivos CSV y muestra los resultados en mapas interactivos y mapas de calor, para apoyar decisiones comerciales y de expansión.

El eje de la solución es:

**Datos + geolocalización + mapas de calor**

La primera etapa prioriza calidad de los datos, seguridad, privacidad, representación geográfica correcta y trazabilidad. Sobre esa base se incorporan después modelos estadísticos y de machine learning para el análisis predictivo.

## Propósito

Apoyar la toma de decisiones de la cooperativa con información geográfica de potenciales socios: dónde se concentran, qué zonas ofrecen más oportunidad de captación y cómo orientar la estrategia comercial.

## Objetivo general

Desarrollar una plataforma web que permita:

- Registrar la ubicación de potenciales futuros socios.
- Importar información mediante archivos CSV.
- Procesar y validar información geográfica.
- Visualizar datos en mapas interactivos.
- Generar mapas de calor.
- Analizar la concentración geográfica de potenciales socios.
- Identificar zonas de oportunidad.
- Generar análisis predictivos.
- Consultar indicadores en dashboards.
- Facilitar decisiones comerciales y estratégicas.

## Objetivos específicos

1. Registrar la ubicación geográfica de potenciales socios.
2. Cargar información de forma masiva mediante archivos CSV.
3. Validar y normalizar los datos importados.
4. Representar la información sobre mapas interactivos.
5. Generar mapas de calor a partir de distintas variables.
6. Filtrar y segmentar la información.
7. Incorporar indicadores estadísticos y geográficos.
8. Identificar zonas de concentración de potenciales socios.
9. Incorporar una capa de análisis predictivo.
10. Restringir el acceso a usuarios registrados y autorizados.
11. Mantener trazabilidad de las cargas y de las modificaciones de datos.
12. Proteger la información geográfica y personal.

## Alcance de la primera versión

Arquitectura sencilla y modular. Los módulos de esta etapa son:

| Módulo | Nombre |
| --- | --- |
| 1 | Autenticación y autorización |
| 2 | Registro de ubicación de potenciales socios |
| 3 | Carga de archivos CSV |
| 4 | Validación y procesamiento de datos |
| 5 | Dashboard geoespacial |
| 6 | Mapas de calor |
| 7 | Filtros y segmentación |
| 8 | Indicadores y estadísticas |
| 10 | Administración de usuarios |

El análisis predictivo (objetivo específico 9) queda para una etapa posterior, cuando la base de datos, la seguridad y la representación geográfica estén consolidadas. En el documento del reto, la administración de usuarios figura como módulo 10; no hay un módulo 9 en el alcance de la primera versión.

## Actores

### Usuario registrado

Persona con cuenta autorizada. Puede:

- Iniciar sesión.
- Consultar el dashboard, los mapas, los mapas de calor y los indicadores.
- Aplicar filtros.
- Registrar su ubicación, si tiene autorización para hacerlo.

### Administrador

Usuario autorizado para trabajar con los datos. Además de consultar y analizar, puede:

- Cargar y gestionar archivos CSV.
- Generar mapas y analizar zonas.
- Ejecutar procesos analíticos y consultar resultados predictivos.
- Gestionar usuarios, roles y permisos.
- Administrar parámetros y configurar variables analíticas.
- Consultar la auditoría.

## Resultado esperado

Una herramienta de apoyo a la decisión que muestre zonas de oportunidad, concentración de potenciales socios y posibilidades de expansión comercial de la Cooperativa Padre Julián Lorente.

La especificación completa está en [`Files/Reto.md`](Files/Reto.md).
