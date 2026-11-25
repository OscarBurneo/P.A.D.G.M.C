/** Escala del calor y de los puntos. El radio va en píxeles de pantalla. */

export const PARADAS_RADIO_CALOR: ReadonlyArray<readonly [number, number]> = [
  [4, 6],
  [6, 10],
  [8, 14],
  [10, 18],
  [12, 22],
];

export const PARADAS_INTENSIDAD_CALOR: ReadonlyArray<readonly [number, number]> = [
  [4, 0.35],
  [7, 0.55],
  [10, 0.75],
];

export const PARADAS_OPACIDAD_CALOR: ReadonlyArray<readonly [number, number]> = [
  [9, 0.8],
  [10.5, 0.35],
  [12, 0],
];

export const PARADAS_RADIO_PUNTO: ReadonlyArray<readonly [number, number]> = [
  [10, 3.5],
  [13, 5],
  [15, 6.5],
];

export const PARADAS_OPACIDAD_PUNTO: ReadonlyArray<readonly [number, number]> = [
  [9.5, 0],
  [11, 0.95],
];

const CAMPOS_FICHA = [
  ["provincia", "Provincia"],
  ["canton", "Cantón"],
  ["agencia", "Agencia"],
  ["fecha", "Fecha"],
] as const;

export function expresionZoom(paradas: ReadonlyArray<readonly [number, number]>) {
  return ["interpolate", ["linear"], ["zoom"], ...paradas.flat()];
}

export function valorEnZoom(paradas: ReadonlyArray<readonly [number, number]>, zoom: number) {
  const primera = paradas[0];
  const ultima = paradas[paradas.length - 1];
  if (!primera || !ultima) {
    return 0;
  }
  if (zoom <= primera[0]) {
    return primera[1];
  }
  if (zoom >= ultima[0]) {
    return ultima[1];
  }
  for (let indice = 1; indice < paradas.length; indice += 1) {
    const anterior = paradas[indice - 1];
    const siguiente = paradas[indice];
    if (!anterior || !siguiente || zoom > siguiente[0]) {
      continue;
    }
    const tramo = siguiente[0] - anterior[0];
    const avance = tramo === 0 ? 0 : (zoom - anterior[0]) / tramo;
    return anterior[1] + avance * (siguiente[1] - anterior[1]);
  }
  return ultima[1];
}

export function fichaPunto(propiedades: Record<string, unknown> | null | undefined) {
  if (!propiedades) {
    return [];
  }
  const lineas: string[] = [];
  for (const [campo, etiqueta] of CAMPOS_FICHA) {
    const valor = propiedades[campo];
    if (typeof valor !== "string" || valor.trim() === "") {
      continue;
    }
    lineas.push(`${etiqueta}: ${valor.trim()}`);
  }
  return lineas;
}
