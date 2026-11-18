import { Fragment, useEffect, useState } from "react";
import { api } from "../api";

type Evento = {
  id: string;
  fecha: string;
  actor_etiqueta: string;
  actor_tipo: string;
  operacion: string;
  entidad_tipo: string;
  resultado: string;
  codigo_error: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  mensaje: string | null;
};

export function Auditoria() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [resultado, setResultado] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function cargar(filtro = resultado) {
    const query = filtro ? `?resultado=${filtro}` : "";
    const respuesta = await api<{ eventos: Evento[]; aviso: string }>(`/api/auditoria${query}`);
    setEventos(respuesta.eventos);
  }

  useEffect(() => {
    void cargar().catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "Error"));
  }, []);

  return (
    <section className="hoja">
      <p className="aviso">La aplicación no puede modificar ni borrar estos eventos. La retención sigue pendiente.</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <form
        className="filtros"
        onSubmit={(evento) => {
          evento.preventDefault();
          void cargar();
        }}
      >
        <label>
          Resultado
          <select value={resultado} onChange={(evento) => setResultado(evento.target.value)}>
            <option value="">Todos</option>
            <option value="exito">Éxito</option>
            <option value="fallo">Fallo</option>
          </select>
        </label>
        <button type="submit">Filtrar</button>
      </form>
      {eventos.length === 0 ? <p>Todavía no hay eventos para el filtro.</p> : null}
      <div className="tabla-contenedor">
      <table>
        <caption>Eventos de trazabilidad</caption>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Actor</th>
            <th>Operación</th>
            <th>Resultado</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((evento) => (
            <Fragment key={evento.id}>
              <tr>
                <td>{new Date(evento.fecha).toLocaleString("es-EC")}</td>
                <td>
                  {evento.actor_etiqueta}
                  <small>{evento.actor_tipo}</small>
                </td>
                <td>{evento.operacion}</td>
                <td>{evento.resultado === "exito" ? "Éxito" : "Fallo"}</td>
                <td>
                  <button type="button" className="secundario" onClick={() => setAbierto(abierto === evento.id ? null : evento.id)}>
                    {abierto === evento.id ? "Ocultar" : "Ver antes y después"}
                  </button>
                </td>
              </tr>
              {abierto === evento.id ? (
                <tr>
                  <td colSpan={5}>
                    <p>{evento.mensaje}</p>
                    {evento.codigo_error ? <p>Código: {evento.codigo_error}</p> : null}
                    <div className="antes-despues">
                      <pre>{JSON.stringify(evento.antes, null, 2)}</pre>
                      <pre>{JSON.stringify(evento.despues, null, 2)}</pre>
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}
