export type NombreIcono =
  | "resumen"
  | "mapa"
  | "oportunidad"
  | "importar"
  | "fuentes"
  | "usuarios"
  | "roles"
  | "auditoria"
  | "ayuda"
  | "config"
  | "buscar"
  | "campana"
  | "panel"
  | "personas"
  | "pin"
  | "diana"
  | "calidad"
  | "salir"
  | "menu";

const TRAZOS: Record<NombreIcono, string> = {
  resumen: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  mapa: "M8 5.5 3 7.2v11.3l5-1.7 6 1.7 5-1.7V3.8l-5 1.7-6-1.7zM8 5.5v11.3M14 7.2v11.3",
  oportunidad: "M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2",
  importar: "M12 4v10M8 10l4 4 4-4M5 19h14",
  fuentes: "M5 7c0-1.2 3.1-2.5 7-2.5S19 5.8 19 7s-3.1 2.5-7 2.5S5 8.2 5 7zM5 7v5c0 1.2 3.1 2.5 7 2.5s7-1.3 7-2.5V7M5 12v5c0 1.2 3.1 2.5 7 2.5s7-1.3 7-2.5v-5",
  usuarios: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 19c.4-2.4 2.3-4 4.5-4s4.1 1.6 4.5 4M16 11.2a2.4 2.4 0 1 0 0-4.8M16.2 15c1.6.3 2.9 1.4 3.3 3.2",
  roles: "M12 3.5 5 6.2v5.2c0 4.2 2.8 6.8 7 8.1 4.2-1.3 7-3.9 7-8.1V6.2L12 3.5z",
  auditoria: "M7 4.5h8l4 4V19.5H7zM15 4.5V9h4.5M9 13h6M9 16.5h4",
  ayuda: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.2a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.9-1.2 1.6V14M12 17h.01",
  config: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM4.8 12h1.6M17.6 12h1.6M12 4.8v1.6M12 17.6v1.6M6.8 6.8l1.1 1.1M16.1 16.1l1.1 1.1M17.2 6.8l-1.1 1.1M7.9 16.1l-1.1 1.1",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16.5 16.5 21 21",
  campana: "M6 16.5h12l-1.2-2V11a4.8 4.8 0 1 0-9.6 0v3.5L6 16.5zM10 16.5a2 2 0 0 0 4 0",
  panel: "M4 5h16v14H4zM9 5v14",
  personas: "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zM4.2 19.2c.5-2.8 2.6-4.4 4.8-4.4s4.3 1.6 4.8 4.4",
  pin: "M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10zM12 11.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z",
  diana: "M12 12m-7 0a7 7 0 1 0 14 0 7 7 0 1 0-14 0M12 12m-2.2 0a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21",
  calidad: "M7 4.5h8l4 4V19.5H7zM9 13.5l2 2 4-4.5",
  salir: "M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10M13 8l4 4-4 4M9 12h8",
  menu: "M4 7h16M4 12h16M4 17h16",
};

export function Icono({ nombre }: { nombre: NombreIcono }) {
  return (
    <svg viewBox="0 0 24 24" className="icono" aria-hidden="true">
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
