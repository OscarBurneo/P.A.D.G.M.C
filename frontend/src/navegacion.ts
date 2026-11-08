import type { NombreIcono } from "./componentes/Icono";

export type Enlace = {
  a: string;
  texto: string;
  permiso: string | null;
  icono: NombreIcono;
  fin?: boolean;
};

export const PRINCIPALES: Enlace[] = [
  { a: "/", texto: "Resumen", permiso: null, icono: "resumen", fin: true },
  { a: "/mapa", texto: "Mapa geoespacial", permiso: "mapas.ver", icono: "mapa" },
  { a: "/oportunidades", texto: "Oportunidades", permiso: "mapas.ver", icono: "oportunidad" },
  { a: "/importar", texto: "Importar datos", permiso: "importaciones.cargar", icono: "importar" },
  { a: "/fuentes", texto: "Fuentes de datos", permiso: "importaciones.cargar", icono: "fuentes" },
  { a: "/usuarios", texto: "Usuarios", permiso: "usuarios.leer", icono: "usuarios" },
  { a: "/roles", texto: "Roles", permiso: "roles.leer", icono: "roles" },
  { a: "/auditoria", texto: "Auditoría", permiso: "auditoria.leer", icono: "auditoria" },
];

export const PIE: Enlace[] = [
  { a: "/ayuda", texto: "Centro de ayuda", permiso: null, icono: "ayuda" },
  { a: "/parametros", texto: "Configuración", permiso: "parametros.leer", icono: "config" },
];
