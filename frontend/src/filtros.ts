export type FiltroActivo = {
  campo: string;
  etiqueta: string;
  operador: string;
  valores: string[];
};

export type BorradorFiltros = {
  zonas: string[];
  provincias: string[];
  cantones: string[];
  agencias: string[];
  fechaDesde: string;
  fechaHasta: string;
};

export const OPERADORES: Record<string, string> = {
  en: "es uno de",
  cubre: "cubre",
  entre: "entre",
  desde: "desde",
  hasta: "hasta",
};

const VACIO: BorradorFiltros = {
  zonas: [],
  provincias: [],
  cantones: [],
  agencias: [],
  fechaDesde: "",
  fechaHasta: "",
};

export function borradorDesdeParametros(params: URLSearchParams): BorradorFiltros {
  const zonas = params.getAll("zona");
  const foco = params.get("provincia");
  return {
    zonas: zonas.length > 0 ? zonas : foco ? [foco] : [],
    provincias: params.getAll("attr_provincia"),
    cantones: params.getAll("attr_canton"),
    agencias: params.getAll("attr_agencia"),
    fechaDesde: params.get("fecha_desde") ?? "",
    fechaHasta: params.get("fecha_hasta") ?? "",
  };
}

export function escribirFiltros(params: URLSearchParams, borrador: BorradorFiltros): URLSearchParams {
  const siguientes = new URLSearchParams(params);
  for (const clave of ["zona", "provincia", "attr_provincia", "attr_canton", "attr_agencia", "fecha_desde", "fecha_hasta"]) {
    siguientes.delete(clave);
  }
  if (borrador.zonas.length === 1) {
    siguientes.set("provincia", borrador.zonas[0]);
  } else {
    for (const zona of borrador.zonas) {
      siguientes.append("zona", zona);
    }
  }
  for (const valor of borrador.provincias) {
    siguientes.append("attr_provincia", valor);
  }
  for (const valor of borrador.cantones) {
    siguientes.append("attr_canton", valor);
  }
  for (const valor of borrador.agencias) {
    siguientes.append("attr_agencia", valor);
  }
  if (borrador.fechaDesde) {
    siguientes.set("fecha_desde", borrador.fechaDesde);
  }
  if (borrador.fechaHasta) {
    siguientes.set("fecha_hasta", borrador.fechaHasta);
  }
  return siguientes;
}

export function consultaApi(borrador: BorradorFiltros): string {
  const params = new URLSearchParams();
  for (const zona of borrador.zonas) {
    params.append("zona", zona);
  }
  for (const valor of borrador.provincias) {
    params.append("provincia", valor);
  }
  for (const valor of borrador.cantones) {
    params.append("canton", valor);
  }
  for (const valor of borrador.agencias) {
    params.append("agencia", valor);
  }
  if (borrador.fechaDesde) {
    params.set("fecha_desde", borrador.fechaDesde);
  }
  if (borrador.fechaHasta) {
    params.set("fecha_hasta", borrador.fechaHasta);
  }
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}

export function restablecerParametros(params: URLSearchParams): URLSearchParams {
  return escribirFiltros(params, VACIO);
}

export function quitarCampo(borrador: BorradorFiltros, campo: string): BorradorFiltros {
  if (campo === "zona") {
    return { ...borrador, zonas: [] };
  }
  if (campo === "provincia") {
    return { ...borrador, provincias: [] };
  }
  if (campo === "canton") {
    return { ...borrador, cantones: [] };
  }
  if (campo === "agencia") {
    return { ...borrador, agencias: [] };
  }
  if (campo === "fecha") {
    return { ...borrador, fechaDesde: "", fechaHasta: "" };
  }
  return borrador;
}

export function hayFiltros(borrador: BorradorFiltros): boolean {
  return Boolean(
    borrador.zonas.length ||
      borrador.provincias.length ||
      borrador.cantones.length ||
      borrador.agencias.length ||
      borrador.fechaDesde ||
      borrador.fechaHasta,
  );
}
