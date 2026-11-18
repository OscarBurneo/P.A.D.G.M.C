import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type NivelZona = "Muy alta" | "Alta" | "Media";

/** Provincia o zona que el usuario eligió. Los números nulos significan que la API no los trae. */
export type FocoZona = {
  provinciaCodigo: string | null;
  provinciaNombre: string | null;
  zonaNombre: string | null;
  indice: number | null;
  socios: number | null;
  crecimiento: number | null;
  nivel: NivelZona | null;
  ejemplo: boolean;
  lng: number | null;
  lat: number | null;
};

export const FOCO_VACIO: FocoZona = {
  provinciaCodigo: null,
  provinciaNombre: null,
  zonaNombre: null,
  indice: null,
  socios: null,
  crecimiento: null,
  nivel: null,
  ejemplo: false,
  lng: null,
  lat: null,
};

type Estado = {
  zona: FocoZona;
  fijar: (zona: FocoZona) => void;
  limpiar: () => void;
};

const Contexto = createContext<Estado | null>(null);

export function ProveedorFoco({ children }: { children: ReactNode }) {
  const [zona, setZona] = useState<FocoZona>(FOCO_VACIO);
  const fijar = useCallback((siguiente: FocoZona) => setZona(siguiente), []);
  const limpiar = useCallback(() => setZona(FOCO_VACIO), []);
  const valor = useMemo(() => ({ zona, fijar, limpiar }), [zona, fijar, limpiar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useFoco() {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error("El foco territorial no está disponible.");
  }
  return valor;
}
