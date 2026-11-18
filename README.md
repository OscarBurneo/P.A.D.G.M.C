# P.A.D.G.M.C

Plataforma web de análisis de datos geoespaciales con mapas de calor para la **Cooperativa de Ahorro y Crédito Padre Julián Lorente** (Loja, Ecuador). Es el MVP de un concurso universitario. El desarrollador es Oscar.

El documento de visión usa también la sigla P.A.D.M.C. En este repositorio el nombre del producto es **P.A.D.G.M.C**.

El eje de la solución es **datos + geolocalización + mapas de calor**. El Sprint 0 deja lista la puerta de entrada: sesión, roles, permisos y auditoría. Esta rama suma el tablero, la cobertura nacional y la importación de socios con un contrato de columnas todavía propuesto. La predicción sigue fuera del MVP.

El nombre visible por defecto es **GeoOportunidades**. Se cambia con `NOMBRE_PRODUCTO` y `SUBTITULO_PRODUCTO` en el entorno; `/api/salud` se lo entrega a la interfaz. El ícono (SVG y PNG de 16 a 1024 px, para una app de escritorio futura) está en [`assets/marca/`](assets/marca/).

## Cobertura nacional

La cooperativa no opera solo en Loja. La configuración inicial marca agencia en Loja, El Oro, Zamora Chinchipe, Pichincha (Distrito Metropolitano de Quito), Santo Domingo de los Tsáchilas, Manabí, Chimborazo y Guayas. Esa lista está en la tabla `cobertura_provincial` y se edita en Configuración.

Los límites provinciales vienen de geoBoundaries gbOpen, Ecuador ADM1, en EPSG:4326. La licencia declarada de ese archivo es **CC0 1.0**. Fuente, cita y URL: [`backend/app/recursos/geografia/FUENTE.md`](backend/app/recursos/geografia/FUENTE.md). El mapa abre sobre el Ecuador continental y muestra Galápagos en un recuadro.

Mientras no haya un lote publicado, el resumen real está en cero y la interfaz puede mostrar una vista de ejemplo, marcada como tal. Con lotes en estado completado, el ranking y la capa de calor usan esos registros. El corredor, las señales y el índice de expansión siguen siendo ejemplo.

## Sprint 2

Historias: HU-07, HU-08, HU-09, HU-10, HU-11, HU-12, HU-13, HU-14, HU-16, HU-22, HU-29, HU-30, HU-49, HU-51 y HU-52. De arrastre, HU-46, HU-64 y HU-67 solo suman auditoría, una medición de la carga y pruebas trazables del módulo de importación.

El contrato de columnas es una propuesta fácil de cambiar: [`docs/contrato-columnas.md`](docs/contrato-columnas.md) y las plantillas en [`docs/plantillas/`](docs/plantillas/). La traza de cada historia está en [`docs/sprint-2.md`](docs/sprint-2.md). El detalle de módulos está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Sprint 0

Historias de este corte: HU-01, HU-02, HU-03, HU-40, HU-41, HU-42, HU-70, auditoría incremental HU-47 y los habilitadores HU-64 a HU-68 en lo que ya es comprobable.

Las políticas que el cliente todavía no aprueba tienen valores propuestos, se pueden cambiar y aparecen como `pendiente_de_aprobacion`:

| Tema | Propuesta | Pendiente |
| --- | --- | --- |
| Matriz de permisos | Dos roles, permisos solo por rol | P-02, P-09 |
| Campos de cuenta | Identificador, nombre, correo, contraseña y rol | P-09 |
| Última cuenta administradora | No se desactiva ni se le quita el rol | P-09 |
| Inactividad | 30 minutos, máximo 8 horas | P-09 |
| Hash | Argon2id, sal individual, coste en el entorno | P-09 |
| Ficha de carga | El script existe; el resultado no es aceptación | P-06 |

El detalle está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). Las fuentes corregidas están en [`docs/fuentes/`](docs/fuentes/).

## Arranque con Docker

Hace falta Docker con Compose v2. Los tres archivos de `infra/` se eligen con `-f`. No hace falta un perfil para el modo de un solo equipo, y un perfil tampoco podría dejar fuera servicios que ese modo siempre arranca. El detalle de la prueba con dos equipos está en [`docs/guia-prueba-red.md`](docs/guia-prueba-red.md).

```bash
cp .env.example .env
```

Edite `.env` y ponga una `ADMIN_CONTRASENA` que no sea `cambiar-esto` (mínimo 10 caracteres, con letras y números) y un `POSTGRES_PASSWORD` distinto del ejemplo.

### Un solo equipo

```bash
docker compose --env-file .env -f infra/docker-compose.yml up --build
```

Abra `http://localhost:8080`. La API no se publica: Nginx atiende `/api` y lo reenvía a `http://api:8000` (o al valor de `API_UPSTREAM`). El navegador no usa una URL absoluta. En este modo el entorno debe seguir en `desarrollo`: HTTP local no es la entrega a usuarios finales. Para esa entrega use `ENTORNO=produccion` detrás de HTTPS. Este archivo sigue publicando Postgres en el puerto 5432 del anfitrión, para las herramientas locales.

La imagen `postgis/postgis:16-3.4` no incluye h3-pg. El servicio arranca igual y `/api/salud` informa `h3_disponible: false`.

### Solo base de datos y API

Para el equipo que hospeda la API en la LAN. Postgres no publica puerto. La API queda en el puerto 8000. Este archivo fija `ENTORNO=desarrollo`, `COOKIE_SECURE=false` y `COOKIE_SAMESITE=lax`; esos tres valores del `.env` no se aplican aquí.

```bash
docker compose --env-file .env -f infra/docker-compose.backend.yml up --build
```

Compruebe `http://localhost:8000/api/salud` desde ese equipo y `http://IP_DE_ESE_EQUIPO:8000/api/salud` desde el otro.

### Frontend Nginx en otro equipo

Sirve el build ya compilado. `API_UPSTREAM` se lee al crear el contenedor. Cambiar la IP no pide `--build`; basta recrear el contenedor.

```bash
# En .env del equipo frontend, sin barra final:
# API_UPSTREAM=http://192.168.1.20:8000
docker compose --env-file .env -f infra/docker-compose.frontend.yml --profile nginx up --build -d
```

Abra `http://localhost:8080` en ese equipo, o `http://IP_DEL_EQUIPO_FRONTEND:8080` desde otro. El navegador llama a `/api` en ese mismo origen.

### Frontend con recarga en caliente

Vite dentro de Docker, con el código montado y `node_modules` en un volumen. El puerto es 5173, escucha en `0.0.0.0` y el proxy `/api` sale de `API_PROXY_TARGET`. En Docker Desktop (Windows y macOS) el sondeo (`CHOKIDAR_USEPOLLING=true`) hace falta para ver un cambio de archivo. La primera vez `npm ci` corre dentro del contenedor.

```bash
# API_PROXY_TARGET=http://192.168.1.20:8000
docker compose --env-file .env -f infra/docker-compose.frontend.yml --profile vite up
```

Abra `http://IP_DEL_EQUIPO_FRONTEND:5173`. Guarde un cambio en `frontend/src` y la página se actualiza sin reconstruir una imagen. `npm run dev` en el anfitrión, fuera de Docker, sigue reenviando `/api` a `http://localhost:8000` si no exporta `API_PROXY_TARGET`.

## Arranque sin Docker

Hace falta Python 3.12, Node.js 22 y PostgreSQL 16 con PostGIS.

```bash
cp .env.example .env
# Ajuste BASE_DATOS_URL, POSTGRES_PASSWORD y ADMIN_CONTRASENA.
python -m venv .venv
source .venv/bin/activate
pip install -e "./backend[dev]"
cd backend
alembic upgrade head
uvicorn app.principal:app --reload --port 8000
```

En otra terminal:

```bash
cd frontend
npm ci
npm run dev
```

El navegador usa `http://localhost:5173`. Vite reenvía `/api` al puerto 8000.

## Pruebas

Las pruebas de autenticación, RBAC y auditoría corren contra PostgreSQL, no contra un doble en memoria. La base de las pruebas es `postgresql+psycopg://padgmc:padgmc_prueba@localhost:5432/padgmc`.

```bash
cd backend
pytest
ruff check .
ruff format --check .
cd ../frontend
npm run typecheck
npm run build
python ../herramientas/escanear_secretos.py ..
python ../herramientas/demostrar_bloqueo_secreto.py
```

La medición de autenticación, que no sustituye a la ficha de carga:

```bash
python backend/scripts/carga_autenticacion.py \
  --url http://localhost:8000/api/auth/iniciar-sesion \
  --identificador admin \
  --contrasena 'su-clave' \
  --solicitudes 20 \
  --guardar docs/rendimiento/evidencia-p95-autenticacion.md
```

## Qué hay en cada carpeta

| Carpeta | Contenido |
| --- | --- |
| `backend/` | API FastAPI, migraciones y pruebas |
| `frontend/` | React, Vite y el mapa MapLibre |
| `infra/` | Compose de un equipo, de la API y del frontend; imágenes y Nginx |
| `herramientas/` | Escáner de secretos |
| `docs/` | Arquitectura y documentos fuente |
