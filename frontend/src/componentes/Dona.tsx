import { formatoEntero } from "../formato";

export type ParteDona = { nombre: string; valor: number; color: string };

export function Dona({
  partes,
  tituloTotal,
  vacio,
}: {
  partes: ParteDona[];
  tituloTotal: string;
  vacio: string;
}) {
  const total = partes.reduce((suma, parte) => suma + parte.valor, 0);
  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  let recorrido = 0;

  return (
    <div className="dona-caja">
      <div className="dona-figura">
        <svg viewBox="0 0 120 120" role="img" aria-label={total ? tituloTotal : vacio}>
          <circle cx="60" cy="60" r={radio} fill="none" stroke="#E6EEF5" strokeWidth="14" />
          {total
            ? partes.map((parte) => {
                const largo = (parte.valor / total) * circunferencia;
                const segmento = (
                  <circle
                    key={parte.nombre}
                    cx="60"
                    cy="60"
                    r={radio}
                    fill="none"
                    stroke={parte.color}
                    strokeWidth="14"
                    strokeDasharray={`${largo} ${circunferencia - largo}`}
                    strokeDashoffset={-recorrido}
                    transform="rotate(-90 60 60)"
                  />
                );
                recorrido += largo;
                return segmento;
              })
            : null}
        </svg>
        <div className="dona-centro">
          <strong>{total ? formatoEntero(total) : "0"}</strong>
          <span>{total ? "Total" : "Sin datos"}</span>
        </div>
      </div>
      {total ? (
        <ul className="dona-leyenda">
          {partes.map((parte) => (
            <li key={parte.nombre}>
              <span className="punto-leyenda" style={{ background: parte.color }} />
              <span>{parte.nombre}</span>
              <strong>{Math.round((parte.valor / total) * 100)} %</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="nota">{vacio}</p>
      )}
    </div>
  );
}
