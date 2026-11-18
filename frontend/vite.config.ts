import { defineConfig, type ServerOptions } from "vite";
import react from "@vitejs/plugin-react";

type Entorno = Record<string, string | undefined>;

function variables(): Entorno {
  const candidato = (globalThis as { process?: { env?: Entorno } }).process?.env;
  return candidato ?? {};
}

function entero(valor: string | undefined, defecto: number): number {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : defecto;
}

function activo(valor: string | undefined): boolean {
  if (valor === undefined) {
    return false;
  }
  const limpio = valor.trim().toLowerCase();
  return limpio === "1" || limpio === "true";
}

export default defineConfig(() => {
  const env = variables();
  const destino = env.API_PROXY_TARGET?.trim() || "http://localhost:8000";
  const hostRecarga = env.HMR_HOST?.trim();
  const protocolo = env.HMR_PROTOCOL === "wss" ? "wss" : "ws";
  const sondeoExplicito = env.CHOKIDAR_USEPOLLING?.trim();

  const servidor: ServerOptions = {
    port: 5173,
    proxy: {
      "/api": {
        target: destino,
        changeOrigin: true,
      },
    },
    hmr: {
      protocol: protocolo,
      clientPort: entero(env.HMR_CLIENT_PORT, 5173),
      ...(hostRecarga ? { host: hostRecarga } : {}),
    },
  };

  if (env.DEV_ALLOWED_HOSTS?.trim().toLowerCase() === "true") {
    servidor.allowedHosts = true;
  }

  if (sondeoExplicito) {
    const sondeo = activo(sondeoExplicito);
    servidor.watch = {
      usePolling: sondeo,
      ...(sondeo ? { interval: entero(env.CHOKIDAR_INTERVAL, 300) } : {}),
    };
  }

  return {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 1200,
    },
    server: servidor,
  };
});
