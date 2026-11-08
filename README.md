# P.A.D.G.M.C

Plataforma web de análisis de datos geoespaciales con mapas de calor para la **Cooperativa de Ahorro y Crédito Padre Julián Lorente** (Loja, Ecuador). Es el MVP de un concurso universitario. El desarrollador es Oscar.

El documento de visión usa también la sigla P.A.D.M.C. En este repositorio el nombre del producto es **P.A.D.G.M.C**.

El eje de la solución es **datos + geolocalización + mapas de calor**. El Sprint 0 deja lista la puerta de entrada: sesión, roles, permisos y auditoría. Esta rama suma el tablero y la cobertura nacional. La importación de socios y la predicción siguen pendientes.

El nombre visible por defecto es **GeoOportunidades**. Se cambia con `NOMBRE_PRODUCTO` y `SUBTITULO_PRODUCTO` en el entorno; `/api/salud` se lo entrega a la interfaz. El ícono (SVG y PNG de 16 a 1024 px, para una app de escritorio futura) está en [`assets/marca/`](assets/marca/).

## Cobertura nacional

La cooperativa no opera solo en Loja. La configuración inicial marca agencia en Loja, El Oro, Zamora Chinchipe, Pichincha (Distrito Metropolitano de Quito), Santo Domingo de los Tsáchilas, Manabí, Chimborazo y Guayas. Esa lista está en la tabla `cobertura_provincial` y se edita en Configuración.

Los límites provinciales vienen de geoBoundaries gbOpen, Ecuador ADM1, en EPSG:4326. La licencia declarada de ese archivo es **CC0 1.0**. Fuente, cita y URL: [`backend/app/recursos/geografia/FUENTE.md`](backend/app/recursos/geografia/FUENTE.md). El mapa abre sobre el Ecuador continental y muestra Galápagos en un recuadro.

Mientras no haya socios importados, el resumen real está en cero. La interfaz puede mostrar una vista de ejemplo, marcada como tal.

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

Hace falta Docker con Compose.

```bash
cp .env.example .env
```

Edite `.env` y ponga una `ADMIN_CONTRASENA` que no sea `cambiar-esto` (mínimo 10 caracteres, con letras y números) y un `POSTGRES_PASSWORD` distinto del ejemplo.

```bash
docker compose --env-file .env -f infra/docker-compose.yml up --build
```

Abra `http://localhost:8080`. La API queda detrás del mismo origen, en `/api`. En este modo el entorno debe seguir en `desarrollo`: HTTP local no es la entrega a usuarios finales. Para esa entrega use `ENTORNO=produccion` detrás de HTTPS.

La imagen `postgis/postgis:16-3.4` no incluye h3-pg. El servicio arranca igual y `/api/salud` informa `h3_disponible: false`.

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
| `infra/` | Compose, imágenes y Nginx |
| `herramientas/` | Escáner de secretos |
| `docs/` | Arquitectura y documentos fuente |
