import type { NombreIcono } from "./componentes/Icono";

export type Capitulo = {
  a: string;
  n: string;
  texto: string;
  titulo: string;
  nota: string;
  permiso: string | null;
  icono: NombreIcono;
  fin?: boolean;
};

export type PaginaExtra = {
  a: string;
  texto: string;
  titulo: string;
  nota: string;
  permiso: string | null;
  icono: NombreIcono;
};

/** Capítulos 01–06 del atlas. El número no se renumera si el rol oculta alguno. */
export const CAPITULOS: Capitulo[] = [
  {
    a: "/",
    n: "01",
    texto: "Resumen",
    titulo: "Pulso territorial",
    nota: "Una lectura ejecutiva de dónde se concentra la demanda y cómo se mueve el potencial.",
    permiso: null,
    icono: "resumen",
    fin: true,
  },
  {
    a: "/mapa",
    n: "02",
    texto: "Mapa geoespacial",
    titulo: "Atlas vivo",
    nota: "Capas de densidad, presencia comercial y focos de expansión sobre el territorio.",
    permiso: "mapas.ver",
    icono: "mapa",
  },
  {
    a: "/oportunidades",
    n: "03",
    texto: "Oportunidades",
    titulo: "Escalera de prioridad",
    nota: "Zonas ordenadas por potencial, crecimiento y capacidad de captación.",
    permiso: "mapas.ver",
    icono: "oportunidad",
  },
  {
    a: "/importar",
    n: "04",
    texto: "Importar datos",
    titulo: "Laboratorio CSV",
    nota: "Inspecciona columnas, detecta inconsistencias y prepara lotes para análisis.",
    permiso: "importaciones.cargar",
    icono: "importar",
  },
  {
    a: "/fuentes",
    n: "05",
    texto: "Fuentes de datos",
    titulo: "Trazabilidad",
    nota: "Origen, calidad y transformación de cada conjunto de información.",
    permiso: "importaciones.cargar",
    icono: "fuentes",
  },
  {
    a: "/usuarios",
    n: "06",
    texto: "Usuarios",
    titulo: "Accesos y roles",
    nota: "Control de permisos para proteger la información geográfica y personal.",
    permiso: "usuarios.leer",
    icono: "usuarios",
  },
];

export const EXTRAS: PaginaExtra[] = [
  {
    a: "/roles",
    texto: "Roles",
    titulo: "Matriz de permisos",
    nota: "Permisos por rol, sin excepciones por cuenta. La matriz sigue pendiente de aprobación.",
    permiso: "roles.leer",
    icono: "roles",
  },
  {
    a: "/auditoria",
    texto: "Auditoría",
    titulo: "Registro de acciones",
    nota: "Eventos de solo inserción. La aplicación no puede modificarlos ni borrarlos.",
    permiso: "auditoria.leer",
    icono: "auditoria",
  },
  {
    a: "/parametros",
    texto: "Parámetros",
    titulo: "Configuración",
    nota: "Valores propuestos de sesión, hash y provincias con agencia.",
    permiso: "parametros.leer",
    icono: "config",
  },
  {
    a: "/ayuda",
    texto: "Ayuda",
    titulo: "Centro de ayuda",
    nota: "Cómo recorrer el atlas, la bitácora y la vista de ejemplo.",
    permiso: null,
    icono: "ayuda",
  },
];

export const NOTAS_BITACORA: Record<string, string> = {
  "/": "Cuando existan cargas, el pulso describirá concentración y movimiento. Hoy no hay una medición de socios.",
  "/mapa": "Densidad y registros se dibujan en el mapa del Ecuador. Sin socios importados esas capas quedan vacías. Las agencias salen de la cobertura configurada.",
  "/oportunidades": "El índice combinará volumen, crecimiento y distancia a la agencia cuando existan registros. No hay un modelo en producción.",
  "/importar": "Un CSV debe traer nombre, latitud, longitud y cantón. La inspección es local: el servidor todavía no publica el lote.",
  "/fuentes": "Cada lote conservará su origen. Todavía no hay lotes de socios; los límites provinciales sí tienen ficha de fuente.",
  "/usuarios": "Desactive accesos que no se utilicen. La API no ofrece reactivar una cuenta.",
  "/roles": "Los permisos se guardan por rol y aplican en la siguiente solicitud. Siguen pendientes de aprobación.",
  "/auditoria": "Las acciones de cuentas, roles y cobertura quedan en este registro inmutable.",
  "/parametros": "La lista de provincias con agencia es configuración real. El resto de valores sigue pendiente de aprobación.",
  "/ayuda": "Esta guía no modifica datos de la cooperativa.",
};
