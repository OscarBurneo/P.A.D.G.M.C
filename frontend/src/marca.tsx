import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export type Marca = {
  nombre: string;
  subtitulo: string;
  servicioEnLinea: boolean;
};

const DEFECTO: Marca = {
  nombre: "GeoOportunidades",
  subtitulo: "Inteligencia territorial",
  servicioEnLinea: false,
};

const Contexto = createContext<Marca>(DEFECTO);

export function ProveedorMarca({ children }: { children: ReactNode }) {
  const [marca, setMarca] = useState<Marca>(DEFECTO);

  useEffect(() => {
    void api<{ estado: string; nombre_producto?: string; subtitulo_producto?: string }>("/api/salud")
      .then((salud) => {
        setMarca({
          nombre: salud.nombre_producto?.trim() || DEFECTO.nombre,
          subtitulo: salud.subtitulo_producto?.trim() || DEFECTO.subtitulo,
          servicioEnLinea: salud.estado === "ok",
        });
      })
      .catch(() => setMarca(DEFECTO));
  }, []);

  useEffect(() => {
    document.title = `${marca.nombre} · Cooperativa Padre Julián Lorente`;
  }, [marca.nombre]);

  return <Contexto.Provider value={marca}>{children}</Contexto.Provider>;
}

export function useMarca() {
  return useContext(Contexto);
}
