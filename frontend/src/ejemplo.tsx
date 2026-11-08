import { createContext, useContext, useState, type ReactNode } from "react";

type Estado = {
  activo: boolean;
  cambiar: (valor: boolean) => void;
};

const CLAVE = "padgmc-vista-ejemplo";
const Contexto = createContext<Estado | null>(null);

export function ProveedorEjemplo({ children }: { children: ReactNode }) {
  const [activo, setActivo] = useState(() => localStorage.getItem(CLAVE) !== "0");

  function cambiar(valor: boolean) {
    localStorage.setItem(CLAVE, valor ? "1" : "0");
    setActivo(valor);
  }

  return <Contexto.Provider value={{ activo, cambiar }}>{children}</Contexto.Provider>;
}

export function useEjemplo() {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error("La vista de ejemplo no está disponible.");
  }
  return valor;
}
