export type IntervaloLeyenda = {
  etiqueta: string;
  desde: number;
  hasta: number;
  patron: string;
  significado: string;
};

export type LeyendaCalorDatos = {
  variable: string;
  unidad: string;
  significado: string;
  cero: string;
  ausencia: string;
  ausencia_datos: boolean;
  intervalos: IntervaloLeyenda[];
  escala: string;
};

const PATRON: Record<string, string> = {
  puntos: "puntos",
  rayas: "rayas",
  diagonal: "diagonal",
  solido: "sólido",
};

export function LeyendaCalor({
  leyenda,
  zonasEnCero,
  ejemplo,
}: {
  leyenda: LeyendaCalorDatos | null;
  zonasEnCero: string[];
  ejemplo: boolean;
}) {
  if (!leyenda) {
    return <p className="nota-capa">La leyenda aparece cuando la vista está vigente.</p>;
  }
  const hayCeros = zonasEnCero.length > 0;
  return (
    <div className="leyenda-calor" aria-label="Leyenda del mapa de calor">
      <h3>Leyenda del calor</h3>
      {ejemplo ? <p className="chip-ejemplo">La capa dibujada es de ejemplo. Esta leyenda describe la selección real.</p> : null}
      <p>
        <b>{leyenda.variable}</b>
        <span> · {leyenda.unidad}</span>
      </p>
      <p>{leyenda.significado}</p>
      {leyenda.intervalos.length === 0 ? (
        <p>No hay intervalos numéricos porque la selección no produjo celdas.</p>
      ) : (
        <ul className="tramos">
          {leyenda.intervalos.map((intervalo) => (
            <li key={intervalo.etiqueta} className={`tramo ${intervalo.patron}`}>
              <i aria-hidden="true" />
              <span>
                {intervalo.etiqueta}: {intervalo.desde} a {intervalo.hasta}. Patrón {PATRON[intervalo.patron] ?? intervalo.patron}.{" "}
                {intervalo.significado}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={hayCeros ? "nota-cero activa" : "nota-cero"}>
        Cero. {leyenda.cero}
        {hayCeros ? ` En esta selección: ${zonasEnCero.join(", ")}.` : ""}
      </p>
      <p className={leyenda.ausencia_datos ? "nota-ausencia activa" : "nota-ausencia"}>
        Ausencia de datos. {leyenda.ausencia}
        {leyenda.ausencia_datos ? " Esta selección no tiene celdas." : ""}
      </p>
      <p className="nota-capa">{leyenda.escala}</p>
    </div>
  );
}
