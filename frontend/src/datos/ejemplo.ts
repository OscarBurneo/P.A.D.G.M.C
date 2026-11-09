/**
 * Cifras ilustrativas para recorrer la interfaz.
 * No son socios, agencias ni mediciones de la cooperativa.
 */

export type Nivel = "Muy alta" | "Alta" | "Media";

export type CantonEjemplo = {
  nombre: string;
  codigoProvincia: string;
  provincia: string;
  socios: number;
  indice: number;
  crecimiento: number;
  nivel: Nivel;
  lng: number;
  lat: number;
};

export const AVISO_EJEMPLO =
  "Cifras ilustrativas para revisar la interfaz. No son registros de socios ni mediciones de la cooperativa.";

export const CANTONES_EJEMPLO: CantonEjemplo[] = [
  { nombre: "Guayaquil", codigoProvincia: "guayas", provincia: "Guayas", socios: 740, indice: 96, crecimiento: 11, nivel: "Muy alta", lng: -79.8891, lat: -2.1894 },
  { nombre: "Durán", codigoProvincia: "guayas", provincia: "Guayas", socios: 380, indice: 81, crecimiento: 8, nivel: "Alta", lng: -79.831, lat: -2.1732 },
  { nombre: "Quito", codigoProvincia: "pichincha", provincia: "Pichincha", socios: 760, indice: 93, crecimiento: 9, nivel: "Muy alta", lng: -78.4678, lat: -0.1807 },
  { nombre: "Cayambe", codigoProvincia: "pichincha", provincia: "Pichincha", socios: 220, indice: 63, crecimiento: 4, nivel: "Media", lng: -78.1458, lat: -0.041 },
  { nombre: "Manta", codigoProvincia: "manabi", provincia: "Manabí", socios: 410, indice: 84, crecimiento: 7, nivel: "Alta", lng: -80.7333, lat: -0.9677 },
  { nombre: "Portoviejo", codigoProvincia: "manabi", provincia: "Manabí", socios: 310, indice: 76, crecimiento: 5, nivel: "Alta", lng: -80.4545, lat: -1.0546 },
  { nombre: "Loja", codigoProvincia: "loja", provincia: "Loja", socios: 400, indice: 91, crecimiento: 12, nivel: "Muy alta", lng: -79.2042, lat: -3.9931 },
  { nombre: "Catamayo", codigoProvincia: "loja", provincia: "Loja", socios: 220, indice: 74, crecimiento: 6, nivel: "Alta", lng: -79.355, lat: -3.986 },
  { nombre: "Machala", codigoProvincia: "el-oro", provincia: "El Oro", socios: 360, indice: 88, crecimiento: 10, nivel: "Muy alta", lng: -79.9605, lat: -3.2586 },
  { nombre: "Santa Rosa", codigoProvincia: "el-oro", provincia: "El Oro", socios: 180, indice: 66, crecimiento: 3, nivel: "Media", lng: -79.9595, lat: -3.4522 },
  { nombre: "Riobamba", codigoProvincia: "chimborazo", provincia: "Chimborazo", socios: 250, indice: 71, crecimiento: 4, nivel: "Alta", lng: -78.6473, lat: -1.6636 },
  { nombre: "Alausí", codigoProvincia: "chimborazo", provincia: "Chimborazo", socios: 130, indice: 58, crecimiento: 2, nivel: "Media", lng: -78.846, lat: -2.194 },
  { nombre: "Santo Domingo", codigoProvincia: "santo-domingo-de-los-tsachilas", provincia: "Santo Domingo de los Tsáchilas", socios: 310, indice: 79, crecimiento: 6, nivel: "Alta", lng: -79.1754, lat: -0.253 },
  { nombre: "Zamora", codigoProvincia: "zamora-chinchipe", provincia: "Zamora Chinchipe", socios: 120, indice: 54, crecimiento: 3, nivel: "Media", lng: -78.9567, lat: -4.0692 },
  { nombre: "Yantzaza", codigoProvincia: "zamora-chinchipe", provincia: "Zamora Chinchipe", socios: 72, indice: 49, crecimiento: 1, nivel: "Media", lng: -78.7594, lat: -3.8322 },
];

export const SERIES_EJEMPLO = {
  socios: [3200, 3480, 3610, 3900, 4120, 4480, 4862],
  zonas: [8, 9, 10, 11, 12, 14, 15],
  alta: [4, 5, 6, 6, 8, 9, 10],
  calidad: [94, 94.6, 95.1, 95.4, 96, 96.4, 96.8],
};

export const CALIDAD_EJEMPLO = 96.8;

export function sociosEjemplo() {
  return CANTONES_EJEMPLO.reduce((suma, canton) => suma + canton.socios, 0);
}

export function zonasAltas() {
  return CANTONES_EJEMPLO.filter((canton) => canton.nivel === "Muy alta" || canton.nivel === "Alta").length;
}

export const COLORES_SERIE = [
  "#003B68",
  "#00538E",
  "#0067AF",
  "#2F92C5",
  "#5EA9D2",
  "#98C8E0",
  "#FFCB35",
  "#C48A00",
];
