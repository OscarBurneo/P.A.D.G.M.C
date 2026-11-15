#!/bin/sh
# Vite dentro de Docker. El código llega por bind mount; node_modules, por volumen.
set -eu
cd /app

hash_lock() {
  sha256sum package-lock.json | awk 'NR==1 { print $1 }'
}

instalado=0
if [ -x node_modules/.bin/vite ] && [ -f node_modules/.lock-hash ]; then
  if [ "$(cat node_modules/.lock-hash)" = "$(hash_lock)" ]; then
    instalado=1
  fi
fi

if [ "$instalado" -ne 1 ]; then
  echo "Instalando dependencias del frontend (npm ci)..."
  # node_modules es un volumen: npm ci no puede borrar el punto de montaje.
  trabajo=$(mktemp -d)
  cp package.json package-lock.json "$trabajo/"
  npm ci --prefix "$trabajo"
  mkdir -p node_modules
  find node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a "$trabajo/node_modules/." node_modules/
  hash_lock > node_modules/.lock-hash
  rm -rf "$trabajo"
fi

exec npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
