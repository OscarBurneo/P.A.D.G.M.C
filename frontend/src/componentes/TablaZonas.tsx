import { Fragment } from "react";
import { formatoDelta, formatoEntero } from "../formato";

export type FilaZona = {
  codigo: string;
  provincia: string;
  canton: string | null;
  socios: number | null;
  indice: number | null;
  crecimiento: number | null;
  nivel: "Muy alta" | "Alta" | "Media" | null;
};

export function TablaZonas({ filas }: { filas: FilaZona[] }) {
  const grupos = new Map<string, { codigo: string; provincia: string; filas: FilaZona[] }>();
  for (const fila of filas) {
    const actual = grupos.get(fila.codigo) ?? { codigo: fila.codigo, provincia: fila.provincia, filas: [] };
    actual.filas.push(fila);
    grupos.set(fila.codigo, actual);
  }
  const lista = [...grupos.values()];

  if (lista.length === 0) {
    return <p className="nota">Ninguna zona coincide con la búsqueda.</p>;
  }

  return (
    <div className="tabla-contenedor">
      <table className="tabla-zonas">
        <caption className="sr">Zonas agrupadas por provincia y cantón</caption>
        <thead>
          <tr>
            <th>Cantón</th>
            <th>Potenciales socios</th>
            <th>Índice de oportunidad</th>
            <th>Crecimiento</th>
            <th>Nivel</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((grupo) => (
            <Fragment key={grupo.codigo}>
              <tr className="grupo-provincia">
                <th colSpan={5} scope="colgroup">{grupo.provincia}</th>
              </tr>
              {grupo.filas.map((fila) => (
                <tr key={`${grupo.codigo}-${fila.canton ?? "vacio"}`}>
                  <td>{fila.canton ?? "Sin cantones con registros"}</td>
                  <td>{fila.socios === null ? "—" : formatoEntero(fila.socios)}</td>
                  <td>
                    {fila.indice === null ? (
                      "—"
                    ) : (
                      <span className="indice">
                        <span className="barra-indice" aria-hidden="true">
                          <span style={{ width: `${fila.indice}%` }} />
                        </span>
                        {fila.indice}
                      </span>
                    )}
                  </td>
                  <td>
                    {fila.crecimiento === null ? (
                      "—"
                    ) : (
                      <span className={fila.crecimiento >= 0 ? "chip-sube" : "chip-baja"}>
                        {formatoDelta(fila.crecimiento)}
                      </span>
                    )}
                  </td>
                  <td>{fila.nivel ? <span className={`nivel nivel-${fila.nivel === "Muy alta" ? "max" : fila.nivel === "Alta" ? "alta" : "media"}`}>{fila.nivel}</span> : "—"}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
