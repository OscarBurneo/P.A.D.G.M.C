import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Cuenta } from "./api";

type Estado = {
  cargando: boolean;
  cuenta: Cuenta | null;
  recargar: () => Promise<void>;
  cerrar: () => Promise<void>;
};

const Contexto = createContext<Estado | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);

  async function recargar() {
    try {
      setCuenta(await api<Cuenta>("/api/auth/yo"));
    } catch {
      setCuenta(null);
    } finally {
      setCargando(false);
    }
  }

  async function cerrar() {
    await api("/api/auth/cerrar-sesion", { method: "POST" });
    setCuenta(null);
  }

  useEffect(() => {
    void recargar();
  }, []);

  return <Contexto.Provider value={{ cargando, cuenta, recargar, cerrar }}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error("La sesión no está disponible.");
  }
  return valor;
}

export function puede(cuenta: Cuenta | null, permiso: string) {
  return Boolean(cuenta?.permisos?.includes(permiso));
}
