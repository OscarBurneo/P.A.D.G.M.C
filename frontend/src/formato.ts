const numero = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1 });
const entero = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 });

export function formatoEntero(valor: number) {
  return entero.format(valor);
}

export function formatoNumero(valor: number) {
  return numero.format(valor);
}

export function formatoDelta(valor: number) {
  const signo = valor > 0 ? "+" : "";
  return `${signo}${numero.format(valor)} %`;
}

export function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) {
    return "·";
  }
  const primera = partes[0]?.[0] ?? "";
  const segunda = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (primera + segunda).toLocaleUpperCase("es");
}

export function formatoCoordenadas(lng: number, lat: number) {
  return {
    lat: formatoEje(lat, "N", "S"),
    lng: formatoEje(lng, "E", "O"),
  };
}

function formatoEje(valor: number, positivo: string, negativo: string) {
  const absoluto = Math.abs(valor);
  let grados = Math.floor(absoluto);
  let minutos = Math.round((absoluto - grados) * 60);
  if (minutos === 60) {
    grados += 1;
    minutos = 0;
  }
  return `${String(grados).padStart(2, "0")}°${String(minutos).padStart(2, "0")}′${valor >= 0 ? positivo : negativo}`;
}
