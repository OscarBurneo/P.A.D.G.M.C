# Arquitectura del Sprint 0

P.A.D.G.M.C es un monolito modular en un solo repositorio. Un proceso FastAPI atiende la API, React muestra las vistas y PostgreSQL 16 con PostGIS guarda los datos. No hay un bus de eventos ni un worker en este sprint: la visión los deja para cuando existan importaciones largas. La predicción queda fuera del MVP.

El sistema de referencia propuesto es WGS 84, EPSG:4326 (RNF-30, pendiente de confirmar con la fuente real). En geometría el orden es longitud, latitud (`ST_MakePoint(longitud, latitud)`). En los formularios futuros el orden será latitud, longitud.

## Módulos y contratos

Cada módulo habla con los demás por funciones Python y por las rutas HTTP de abajo. No se importan las rutas de otro módulo para saltarse la autorización.

| Módulo | Contrato público de este sprint | Estado |
| --- | --- | --- |
| `auth` | `POST /api/auth/iniciar-sesion`, `POST /api/auth/cerrar-sesion`, `GET /api/auth/yo` | Entregado |
| `usuarios` | Alta, consulta, edición de nombre, correo y contraseña, desactivación | Entregado |
| `autorizacion` | Catálogo de roles y permisos; cambio de rol; permisos por rol | Entregado |
| `auditoria` | Consulta. No hay edición ni borrado | Entregado para cuentas, roles y permisos |
| `admin` | Parámetros de negocio y perfil de hash de solo lectura | Entregado |
| `mapas` | Agregado vacío y detalle vacío, sin coordenadas de personas | Placeholder |
| `ubicaciones` | Agregado vacío. El alta responde 501 | Placeholder |
| `importaciones` | Listado vacío. La carga responde 501 | Placeholder |
| `validacion` | Responde 501 | Placeholder |
| `analitica` | Interfaz `ProcesoAnalitico` y `POST /api/analitica/ejemplo` | Ejemplo, sin reglas reales |

Esos tres contratos de autenticación no deben cambiar de ruta cuando entre un proceso analítico nuevo. La prueba `test_proceso_de_ejemplo_no_cambia_contratos_de_auth` lo vigila (HU-66, RNF-24, RNF-25). El proceso de ejemplo cuenta registros válidos, hoy cero, y no lee contraseñas.

## Datos

| Tabla | Uso |
| --- | --- |
| `roles`, `permisos`, `rol_permiso` | RBAC. No hay excepciones por cuenta |
| `matrices_acceso` | Versión de la matriz. La inicial es `0.1.0-propuesta` |
| `usuarios` | Cuenta. La contraseña solo existe como hash |
| `sesiones` | Token aleatorio; en base se guarda su SHA-256 |
| `eventos_auditoria` | Append-only |
| `parametros` | Valores de negocio editables |
| `ubicaciones` | `geometry(Point, 4326)`, todavía sin filas de negocio |

## Autenticación

- Algoritmo propuesto: Argon2id. El hash incluye sal, coste de memoria, tiempo y paralelismo. Dos contraseñas iguales producen hashes distintos.
- El perfil por defecto del entorno es tiempo 3, memoria 65536 KiB, paralelismo 2, hash de 32 bytes y sal de 16. Está **pendiente de aprobación** (P-09) y se cambia con variables de entorno, no desde la pantalla de parámetros.
- La cookie `padgmc_sesion` es `HttpOnly`, `SameSite=Lax` y `Secure` cuando `ENTORNO=produccion`.
- Cerrar sesión marca la fila como revocada. Volver a enviar el mismo identificador recibe 401.
- La inactividad propuesta es 30 minutos y la vida máxima, 8 horas, contadas desde la creación. La inactividad se lee en cada solicitud, así que un cambio de parámetro aplica en la siguiente. Ambos valores están **pendientes de aprobación**.
- En producción, `POST /api/auth/iniciar-sesion` rechaza HTTP. Solo acepta el esquema `https` o, si `CONFIAR_PROXY=true`, el encabezado `X-Forwarded-Proto: https`. El Compose de desarrollo deja `ENTORNO=desarrollo` a propósito.
- Un fallo de acceso, una cuenta inexistente y una cuenta desactivada responden con el mismo texto: «Credenciales inválidas.» Si la cuenta no existe, igual se calcula un hash señuelo para no acortar el tiempo de respuesta.
- La cuenta inicial sale de `ADMIN_IDENTIFICADOR`, `ADMIN_NOMBRE`, `ADMIN_CORREO` y `ADMIN_CONTRASENA`. El valor `cambiar-esto` no arranca.

## Autorización

La matriz propuesta, versión `0.1.0-propuesta`, estado `pendiente_de_aprobacion`:

| Permiso | Administrador | Usuario registrado |
| --- | --- | --- |
| `sesion.cerrar` | sí | sí |
| `usuarios.leer`, `usuarios.crear`, `usuarios.editar`, `usuarios.desactivar` | sí | no |
| `roles.leer`, `roles.asignar`, `permisos.leer`, `permisos.editar` | sí | no |
| `auditoria.leer` | sí | no |
| `mapas.ver`, `ubicaciones.consultar` | sí | sí |
| `mapas.detalle` | sí | no |
| `parametros.leer`, `parametros.editar` | sí | no |
| `analitica.ejemplo`, `importaciones.cargar`, `validacion.consultar` | sí | no |

Cada solicitud protegida vuelve a leer el rol y los permisos. Un cambio de rol o de permiso se nota en la siguiente llamada, sin volver a iniciar sesión.

No se puede quitar `sesion.cerrar` de ningún rol: la propia sesión siempre se puede cerrar. No se pueden quitar del rol administrador los permisos que administran cuentas, roles y permisos. Las dos reglas evitan dejar la plataforma sin gobierno y están **pendientes de aprobación**.

Con la protección activa (valor por defecto), la última cuenta administradora activa no se desactiva ni pasa a otro rol.

Las respuestas de mapa y de ubicaciones no incluyen latitud, longitud ni identificadores de socios. El detalle de mapa exige `mapas.detalle`. Ocultar un campo en React no sustituye este filtro.

## Auditoría

Cada alta o cambio de cuenta, rol, permiso o parámetro, y también el fallo, inserta un evento con identificador, actor (cuenta, servicio `sistema:semilla` o la solicitud con el identificador intentado), fecha, operación, entidad, resultado y, en los cambios, el antes y el después. El saneador descarta cualquier clave que contenga `contrasena`, `token`, `secreto`, `hash` o `cookie`.

Dos disparadores rechazan `UPDATE`, `DELETE` y `TRUNCATE` sobre `eventos_auditoria`. El código de `backend/app` no desactiva esos disparadores ni borra la tabla. Las pruebas sí desactivan el disparador de fila para limpiar la base entre casos; eso no forma parte de la aplicación. No hay ruta HTTP de edición ni de borrado.

La retención y el acceso legal a esos datos siguen pendientes (P-02, RNF-08, RNF-33).

## h3-pg

La agregación por celdas H3 está prevista para los perfiles que no deben ver puntos. La imagen oficial `postgis/postgis:16-3.4` y el paquete `postgresql-16-postgis-3` de Ubuntu 24.04 no traen la extensión `h3`. Compilarla a mano no entra en este sprint: haría falta una imagen propia y el cliente aún no aprueba la resolución ni el umbral de supresión (P-02, P-03).

`/api/salud` expone `h3_disponible` y `h3_habilitada`. Hoy son falsos. El agregado de mapas devuelve `celdas_h3: []` para reservar el contrato. Cuando la extensión exista, el alta será:

```sql
CREATE EXTENSION IF NOT EXISTS h3;
CREATE EXTENSION IF NOT EXISTS h3_postgis CASCADE;
```

## Reglas de este sprint

| Identificador | Regla | Prueba |
| --- | --- | --- |
| RG-AUTH-01 | Longitud mínima configurable, letras y números, distinta del identificador | `test_reglas_contrasena.py` |
| RG-AUTH-02 | El fallo de acceso no revela si la cuenta existe | `test_autenticacion.py` |
| RG-AUTH-03 | El cierre, la inactividad, la caducidad y la desactivación invalidan la sesión en el servidor | `test_autenticacion.py`, `test_cuentas_y_roles.py` |
| RG-AUTH-04 | Hash Argon2id con sal; el texto plano no aparece en base ni en auditoría | `test_autenticacion.py`, `test_auditoria.py` |
| RG-RBAC-01 | Cada celda de la matriz se prueba con una llamada directa | `test_matriz.py` |
| RG-RBAC-02 | El rol y los permisos cambian en la siguiente solicitud | `test_cuentas_y_roles.py` |
| RG-RBAC-03 | Se protege la última cuenta administradora si el parámetro está activo | `test_cuentas_y_roles.py` |
| RG-AUD-01 | Éxito y fallo, con actor, sin secretos, append-only | `test_auditoria.py` |
| RG-GEO-01 | Punto conocido de Loja en EPSG:4326, longitud en X y latitud en Y | `test_geo_y_contratos.py` |
| RG-SEC-01 | El escáner bloquea un secreto ficticio y el árbol versionado pasa limpio | `test_secretos.py` |
| RG-AN-01 | Un proceso de ejemplo usa la interfaz analítica sin mover las rutas de autenticación | `test_geo_y_contratos.py` |

No hay todavía reglas de normalización, duplicidad ni mapas de calor: dependen de catálogos no aprobados (P-01, P-04, P-05). El umbral extra de cobertura tampoco está aprobado (P-08). La integración continua ejecuta la suite y no deja pasar fallos (RNF-27, en la parte de autenticación y permisos).

## Catálogo de términos de la interfaz

Propuesta pendiente de validación (RNF-19, P-08). Misma palabra en todas las vistas:

| Término | No usar en pantalla |
| --- | --- |
| Cuenta | user, login de negocio |
| Identificador | username |
| Contraseña | password |
| Rol | profile |
| Permiso | grant |
| Sesión | token, en la interfaz |
| Auditoría | log |
| Mapa | canvas, a secas |
| Activa / Desactivada | enabled, deleted |

Los mensajes de error visibles están en español. Los códigos técnicos (`permiso_denegado`, `ultima_cuenta_administradora`) viajan en el campo `codigo` para las pruebas y no sustituyen al texto.

## Secretos

Solo viven en el entorno o en `.env`, que no se versiona. `.env.example` usa `cambiar-esto`. La pantalla de parámetros no muestra la URL de la base ni la contraseña de la cuenta inicial. El escáner de `herramientas/escanear_secretos.py` corre en CI. `herramientas/demostrar_bloqueo_secreto.py` escribe una clave de ejemplo de la documentación de AWS, armada en memoria, y exige que el escáner la rechace. La rotación y el custodio siguen pendientes (P-07).

La contraseña `ClaveSegura123` y la clave `padgmc_prueba` aparecen solo como credenciales de la suite y del servicio de CI. No son secretos de despliegue. El escáner las tiene en una lista corta y explícita.

## Rendimiento

`backend/scripts/carga_autenticacion.py` mide el tiempo entre el envío de las credenciales y la respuesta, en serie, y puede guardar el percentil 95. El objetivo propuesto es menos de 3 segundos (RNF-13). Sin la ficha de hardware, red, volumen, concurrencia y caché (P-06) esa cifra no acepta la historia. El tablero y el mapa de calor todavía no se miden.

## Decisiones que el cliente no ha aprobado

| Id | Qué falta para dar por aceptada la historia |
| --- | --- |
| P-01 | Diccionario e importación CSV/XLSX |
| P-02 | Matriz de atributos, agregación y base legal |
| P-03 | SRID de la fuente, territorios y método de área |
| P-04 | Duplicados e idempotencia |
| P-05 | Reglas analíticas |
| P-06 | Ficha de carga y si se aceptan los objetivos de 3 s y 5 s |
| P-07 | Entorno, copias, custodio y rotación de secretos |
| P-08 | Catálogo de términos, navegadores, resoluciones y cobertura |
| P-09 | Cuentas, roles, hash, inactividad y última cuenta administradora |
| P-10 | Predicción, fuera del MVP |
| P-11 | Prioridades y capacidad |

## Cómo correr las migraciones

Desde `backend/`, con `BASE_DATOS_URL` apuntando a una base donde el usuario pueda crear la extensión PostGIS:

```bash
alembic upgrade head
```

La revisión `0001_esquema_inicial` crea el esquema, la extensión, la tabla geográfica y los disparadores de auditoría.
