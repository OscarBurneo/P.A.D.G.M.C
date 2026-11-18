# Prueba en red: API en un equipo y frontend en otro

La clase levanta el backend en un equipo y el frontend en otro, los dos en la misma LAN, por HTTP. El navegador del frontend pide `/api` a su propio origen. Nginx o Vite reenvían esa ruta a la API del otro equipo. La cookie de sesión sigue siendo `HttpOnly` y `SameSite=lax`, sin `Domain` y sin `Secure`, porque `ENTORNO=desarrollo`. Así el inicio de sesión funciona sin HTTPS.

Hace falta Docker con Compose v2 en los dos equipos, el repositorio, y un `.env` creado desde [`.env.example`](../.env.example). La contraseña de la cuenta inicial no puede ser `cambiar-esto`.

## Por qué son tres archivos y no un perfil

`docker compose up` del archivo principal tiene que seguir levantando Postgres, la API y Nginx. En Compose, un servicio sin `profiles` arranca siempre, y un perfil no puede dejarlo fuera. Tampoco se puede, con un override, quitar el `depends_on` de la API ni retirar el puerto 5432: los puertos de los dos archivos se suman. `include` pide Compose 2.20 o posterior y aquí no hace falta.

| Quién | Archivo | Comando |
| --- | --- | --- |
| Un solo equipo | `infra/docker-compose.yml` | `docker compose --env-file .env -f infra/docker-compose.yml up --build` |
| Equipo A, backend | `infra/docker-compose.backend.yml` | `docker compose --env-file .env -f infra/docker-compose.backend.yml up --build` |
| Equipo B, Nginx | `infra/docker-compose.frontend.yml` | `docker compose --env-file .env -f infra/docker-compose.frontend.yml --profile nginx up --build -d` |
| Equipo B, Vite con recarga | `infra/docker-compose.frontend.yml` | `docker compose --env-file .env -f infra/docker-compose.frontend.yml --profile vite up` |

Los proyectos se llaman `padgmc`, `padgmc-backend` y `padgmc-frontend`. Cada uno tiene su volumen de Postgres. En el aula el equipo A usa solo el archivo backend.

El archivo backend fija `ENTORNO=desarrollo`, `COOKIE_SECURE=false`, `COOKIE_SAMESITE=lax` y `CONFIAR_PROXY=true`. Esos cuatro valores ganan a los del `.env`. El resto (cuenta inicial, clave de Postgres, nombre del producto) sí sale del `.env`.

## 1. Los dos equipos, antes de arrancar

1. Copie `.env.example` a `.env` en la raíz del repositorio.
2. Ponga `POSTGRES_PASSWORD` y `ADMIN_CONTRASENA` reales de la práctica. La contraseña de la cuenta lleva letras y números y al menos 10 caracteres.
3. Deje `VITE_API_BASE` sin definir. No la cree en `frontend/.env`.
4. Conecte los dos equipos a la misma red. Una Wi-Fi de invitados que aísle a los clientes impide la prueba aunque la IP sea correcta.
5. Anote la IP del equipo A y la del equipo B con los comandos de abajo. Use la IPv4 de la LAN (suele ser `192.168.x.x` o `10.x.x.x`). Descarte `127.0.0.1`, `169.254.x.x` y los adaptadores virtuales (vEthernet, WSL, Docker, VirtualBox).

### Windows

En el símbolo del sistema o en PowerShell:

```bat
ipconfig
```

La IPv4 útil es la del adaptador «Wi-Fi» o «Ethernet».

### Linux

```bash
hostname -I
ip -4 addr show scope global
```

### macOS

`en0` suele ser el Wi-Fi. Si no imprime nada, pruebe `en1`.

```bash
ipconfig getifaddr en0
```

También vale Ajustes del Sistema > Red.

## 2. Equipo A: base de datos y API

Postgres no abre puerto hacia la LAN. La API sí, en el 8000.

```bash
docker compose --env-file .env -f infra/docker-compose.backend.yml up --build
```

Cuando el healthcheck de `api` pase:

```bash
curl -sS http://127.0.0.1:8000/api/salud
```

Tiene que responder JSON, con `h3_disponible` en falso: esta imagen de PostGIS no trae h3-pg.

Abra el puerto 8000 en el firewall de este equipo. El 5432 no se abre.

## 3. Equipo B: elija Nginx o Vite

Los dos hablan con la API por la variable de entorno. Cambiar la IP no reconstruye la imagen: se edita `.env` y se vuelve a crear el contenedor, sin `--build`.

En el `.env` del equipo B, sin barra al final:

```text
API_UPSTREAM=http://IP_DEL_EQUIPO_A:8000
API_PROXY_TARGET=http://IP_DEL_EQUIPO_A:8000
```

`http://api:8000` solo existe dentro del Compose de un solo equipo. En este archivo ese nombre no resuelve.

### Nginx (lo ya compilado, puerto 8080)

```bash
docker compose --env-file .env -f infra/docker-compose.frontend.yml --profile nginx up --build -d
```

La primera vez sí hace falta `--build`, porque genera `dist`. Las veces siguientes, si solo cambió la IP:

```bash
docker compose --env-file .env -f infra/docker-compose.frontend.yml --profile nginx up -d
```

La plantilla `infra/nginx.conf.template` entra en `/etc/nginx/templates/` de la imagen oficial. Al arrancar, `envsubst` escribe el `proxy_pass`. Abra el puerto 8080.

### Vite (recarga en caliente, puerto 5173)

```bash
docker compose --env-file .env -f infra/docker-compose.frontend.yml --profile vite up
```

El código de `frontend/` está montado. `node_modules` vive en un volumen del contenedor, así que el anfitrión puede no tener Node. La primera arrancada ejecuta `npm ci` y tarda más. El proceso escucha en `0.0.0.0`. `CHOKIDAR_USEPOLLING` sale en `true`: en Docker Desktop para Windows y macOS el bind mount no avisa de los cambios, y el sondeo los descubre. El intervalo es `CHOKIDAR_INTERVAL` (milisegundos, 300 por defecto). En Linux nativo puede poner `CHOKIDAR_USEPOLLING=false` y recrear el contenedor.

`HMR_HOST` vacío hace que el navegador abra el websocket contra la misma IP de la página. Si lo rellena, use la IP LAN del equipo B, y `HMR_CLIENT_PORT` igual al puerto que escribió en el navegador (5173). Abra el puerto 5173.

Un `up` de este archivo sin `--profile nginx` o `--profile vite` no publica ninguno de los dos, para no dejar 8080 y 5173 abiertos a la vez.

## 4. Firewall

El equipo A permite TCP 8000. El equipo B permite TCP 8080 si usa Nginx, o TCP 5173 si usa Vite. Quien vaya a abrir la página desde un tercer equipo permite el puerto del frontend en el equipo B.

Windows, en una consola de administrador, cambie el puerto según el caso:

```bat
netsh advfirewall firewall add rule name="PADGMC 8000" dir=in action=allow protocol=TCP localport=8000
```

La misma regla se crea en Firewall de Windows Defender > Configuración avanzada > Reglas de entrada.

Linux, si `ufw` está activo:

```bash
sudo ufw allow 8000/tcp
sudo ufw status
```

Con firewalld:

```bash
sudo firewall-cmd --add-port=8000/tcp
```

En macOS: Ajustes del Sistema > Red > Firewall. Si pide permiso para Docker (`com.docker.backend` o `docker`), acéptelo. Docker Desktop publica el puerto en la IP del Mac, no en la IP interna del contenedor.

## 5. Comprobar la API, el proxy y el acceso

Desde el equipo B, la API directa:

```bash
curl -sS http://IP_DEL_EQUIPO_A:8000/api/salud
```

El mismo JSON a través del frontend. Nginx:

```bash
curl -sS http://127.0.0.1:8080/api/salud
```

Vite:

```bash
curl -sS http://127.0.0.1:5173/api/salud
```

En el navegador abra `http://IP_DEL_EQUIPO_B:8080` o `http://IP_DEL_EQUIPO_B:5173`. Entre con `ADMIN_IDENTIFICADOR` y `ADMIN_CONTRASENA` del `.env` del equipo A (la cuenta vive en esa base). La pantalla de inicio deja de pedir credenciales y `/api/auth/yo` responde la cuenta. En las herramientas del navegador, la cookie `padgmc_sesion` es HttpOnly, el dominio es la IP del equipo B y no hay marca `Secure`.

## 6. Probar la recarga en caliente

Tiene que estar el perfil `vite`, no el de Nginx. Nginx sirve el `dist` de la imagen: un cambio en el código no se ve hasta reconstruir.

1. Abra `http://IP_DEL_EQUIPO_B:5173` desde el equipo B o desde un tercero.
2. Edite un texto visible de `frontend/src`, por ejemplo un párrafo de `frontend/src/paginas/Ayuda.tsx`.
3. Guarde. La página cambia sola. El registro del contenedor muestra una línea `hmr update` con la ruta del archivo.

Si el anfitrión es Windows o macOS con Docker Desktop y la página no cambia, confirme `CHOKIDAR_USEPOLLING=true` y recree el contenedor. No hace falta `--build`.

## 7. Un solo equipo, como hasta ahora

```bash
docker compose --env-file .env -f infra/docker-compose.yml up --build
```

Abra `http://localhost:8080`. Deje `API_UPSTREAM=http://api:8000`. Este modo publica Postgres en `5432` de todas las interfaces del anfitrión. En el aula use el archivo backend para que la base no quede en la LAN.

## 8. Si algo falla

### 502 desde Nginx

Nginx no pudo hablar con `API_UPSTREAM`.

- La API del equipo A está en marcha y `curl` directo a `:8000/api/salud` responde.
- `API_UPSTREAM` es `http://IP_DEL_EQUIPO_A:8000`, sin barra final y sin ruta. Con barra final, `/api/salud` se reescribe y la API responde 404.
- El valor ya no es `http://api:8000`: ese nombre solo existe en el Compose de un solo equipo.
- El firewall del equipo A permite 8000.
- Dentro del contenedor, `127.0.0.1` es el propio contenedor. La API publicada en el mismo anfitrión se alcanza como `http://host.docker.internal:8000` (el Compose ya declara ese nombre también en Linux).
- Tras editar `.env`, recree el contenedor. Mire `docker compose --env-file .env -f infra/docker-compose.frontend.yml --profile nginx logs frontend`.

### 401 o la sesión que no se queda

- Credenciales distintas de las del `.env` del equipo A: el mensaje es «Credenciales inválidas.»
- `GET /api/auth/yo` sin la cookie también es 401. Tiene que haber un inicio de sesión previo contra el mismo origen.
- `VITE_API_BASE` con la IP de la API hace que el navegador llame a otro sitio. Con `SameSite=lax` no manda la cookie. Quite esa variable y vuelva a construir solo si ya se horneó en un `dist`. Con Vite basta reiniciar el servidor, porque la base se lee al compilar cada módulo. La forma segura es no definirla.
- `COOKIE_SECURE=true` en HTTP: el login puede responder 200 y el navegador tira la cookie. El archivo backend fuerza `false`.
- Un 400 con código `https_requerido` es otra cosa: `ENTORNO=produccion` rechazó el HTTP. Use el archivo backend, que fija `desarrollo`.

### CORS en la consola del navegador

El mensaje de origen bloqueado aparece cuando la página llama a la IP de la API en vez de a `/api` en su propio host. El arreglo es dejar `VITE_API_BASE` vacía y entrar por Nginx o por Vite. Meter el origen del frontend en `CORS_ORIGENES` permite leer la respuesta y no hace que `SameSite=lax` envíe la cookie en ese `fetch` cruzado.

### La recarga en caliente no se ve

- El servicio en marcha es Nginx. Hace falta el perfil `vite`.
- Docker Desktop sin sondeo: `CHOKIDAR_USEPOLLING=true` y recrear el contenedor.
- El navegador no abre el puerto 5173 del equipo B (firewall, o la página se abrió en `localhost` de un equipo que no es el que corre Vite).
- `HMR_HOST` apunta a `localhost` o a una IP `172.x` del contenedor. Vacíelo, o ponga la IP LAN del equipo B.
- `HMR_CLIENT_PORT` no coincide con el puerto de la barra de direcciones.
- El archivo editado no está bajo `frontend/`. El volumen solo monta esa carpeta.
- La consola del navegador muestra un websocket `ws://` que no conecta. Esa es la recarga, no la API.
- Vite 6 responde 403 «Blocked request» si el `Host` es un nombre distinto de localhost y `DEV_ALLOWED_HOSTS` no es `true`. Una IPv4 la acepta igual. El perfil vite deja la variable en `true`.

### La base del equipo A no coincide con la de un solo equipo

Son proyectos Compose distintos y volúmenes distintos. La cuenta inicial se crea en el volumen `padgmc-backend`. Entrar por `docker-compose.yml` usa otro volumen.

## 9. Riesgos de esta prueba

La cookie `padgmc_sesion` va en claro por la LAN. Quien capture el tráfico puede copiarla y usar la sesión. Vale para la clase. No cargue datos reales de socios ni deje el puerto 8000 abierto fuera del aula.

No use `ENTORNO=produccion` junto con `CONFIAR_PROXY=true` sobre HTTP. En producción el login exige HTTPS. Nginx manda `X-Forwarded-Proto: http`, y el login responde 400. Si alguien llama al puerto 8000 y manda `X-Forwarded-Proto: https`, con `CONFIAR_PROXY=true` la API creería que la petición es HTTPS y marcaría la cookie `Secure`, sin TLS de por medio. El archivo backend deja `ENTORNO=desarrollo` para que esta prueba no entre por ahí. No lo cambie para saltarse esa comprobación.
