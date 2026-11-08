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
