import { api } from "./api";

export type Caja = { oeste: number; sur: number; este: number; norte: number };

export type Contorno = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

export type ProvinciaTerritorio = {
  codigo: string;
  codigo_limite: string;
  nombre: string;
  con_agencia: boolean;
  es_galapagos: boolean;
  nota: string | null;
  orden: number | null;
  bbox: Caja;
  contorno?: Contorno;
};

export type Territorio = {
  fuente: {
    nombre: string;
    licencia: string;
    licencia_url: string;
    cita: string;
    doi: string;
    url: string;
    nota: string;
    srid: number;
  };
  encuadre_continental: Caja;
  recuadro_galapagos: Caja | null;
  provincias: ProvinciaTerritorio[];
};

export type ResumenReal = {
  total_registros: number;
  zonas_analizadas: number;
  alta_oportunidad: number;
  calidad_registros: number | null;
  nota: string;
  provincias: { codigo: string; nombre: string; nota: string | null; registros: number; cantones: [] }[];
};

let cache: Promise<Territorio> | null = null;

export function cargarTerritorio() {
  cache ??= api<Territorio>("/api/cobertura/provincias");
  return cache;
}

export function invalidarTerritorio() {
  cache = null;
}
