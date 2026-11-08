export function Sparkline({ valores, color = "#2F92C5" }: { valores: number[]; color?: string }) {
  if (valores.length < 2) {
    return null;
  }
  const ancho = 112;
  const alto = 36;
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const rango = maximo - minimo || 1;
  const puntos = valores
    .map((valor, indice) => {
      const x = (indice / (valores.length - 1)) * ancho;
      const y = alto - 3 - ((valor - minimo) / rango) * (alto - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Serie de ejemplo">
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" points={puntos} />
    </svg>
  );
}
