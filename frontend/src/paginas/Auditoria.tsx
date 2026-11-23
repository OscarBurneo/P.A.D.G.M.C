import { Fragment, useEffect, useState } from "react";
import { api } from "../api";

type Evento = {
  id: string;
  fecha: string;
  actor_etiqueta: string;
  actor_tipo: string;
  operacion: string;
  entidad_tipo: string;
  entidad_id?: string | null;
  resultado: string;
  codigo_error: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  mensaje: string | null;
};

type Respuesta = {
  total: number;
  limite: number;
  offset: number;
  eventos: Evento[];
};

type Filtros = {
  actor: string;
  operacion: string;
  entidad: string;
  lote: string;
  resultado: string;
  desde: string;
  hasta: string;
};

const TAMANO = 20;
const VACIOS: Filtros = { actor: "", operacion: "", entidad: "", lote: "", resultado: "", desde: "", hasta: "" };

export function Auditoria() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filtros, setFiltros] = useState<Filtros>(VACIOS);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cargado, setCargado] = useState(false);

  async function cargar(siguientes = filtros, salto = 0) {
    const consulta = new URLSearchParams();
    if (siguientes.actor.trim()) {
      consulta.set("actor", siguientes.actor.trim());
    }
    if (siguientes.operacion.trim()) {
      consulta.set("operacion", siguientes.operacion.trim());
    }
    if (siguientes.entidad.trim()) {
      consulta.set("entidad", siguientes.entidad.trim());
    }
    if (siguientes.lote.trim()) {
      consulta.set("lote", siguientes.lote.trim());
    }
    if (siguientes.resultado) {
      consulta.set("resultado", siguientes.resultado);
    }
    if (siguientes.desde) {
      consulta.set("desde", siguientes.desde);
    }
    if (siguientes.hasta) {
      consulta.set("hasta", siguientes.hasta);
    }
    consulta.set("limite", String(TAMANO));
    consulta.set("offset", String(salto));
    const respuesta = await api<Respuesta>(`/api/auditoria?${consulta.toString()}`);
    setEventos(respuesta.eventos);
    setTotal(respuesta.total);
    setOffset(respuesta.offset);
    setCargado(true);
  }

  useEffect(() => {
    void cargar().catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "Error"));
    // La carga inicial usa los filtros vacíos. Los siguientes envíos pasan por el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const desde = total === 0 ? 0 : offset + 1;
  const hasta = Math.min(offset + eventos.length, total);
  const hayAnterior = offset > 0;
  const haySiguiente = offset + TAMANO < total;

  function cambiar<K extends keyof Filtros>(campo: K, valor: Filtros[K]) {
    setFiltros((actual) => ({ ...actual, [campo]: valor }));
  }

  return (
    <section className="hoja">
      <p className="aviso">La aplicación no puede modificar ni borrar estos eventos. La retención sigue pendiente.</p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <form
        className="filtros"
        onSubmit={(evento) => {
          evento.preventDefault();
          setError("");
          void cargar(filtros, 0).catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "Error"));
        }}
      >
        <label>
          Actor
          <input value={filtros.actor} onChange={(evento) => cambiar("actor", evento.target.value)} />
        </label>
        <label>
          Operación
          <input value={filtros.operacion} onChange={(evento) => cambiar("operacion", evento.target.value)} />
        </label>
        <label>
          Entidad
          <input value={filtros.entidad} onChange={(evento) => cambiar("entidad", evento.target.value)} placeholder="lote, usuario…" />
        </label>
        <label>
          Lote
          <input value={filtros.lote} onChange={(evento) => cambiar("lote", evento.target.value)} placeholder="Identificador del lote" />
        </label>
        <label>
          Resultado
          <select value={filtros.resultado} onChange={(evento) => cambiar("resultado", evento.target.value)}>
            <option value="">Todos</option>
            <option value="exito">Éxito</option>
            <option value="fallo">Fallo</option>
          </select>
        </label>
        <label>
          Desde
          <input type="date" value={filtros.desde} onChange={(evento) => cambiar("desde", evento.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={filtros.hasta} onChange={(evento) => cambiar("hasta", evento.target.value)} />
        </label>
        <button type="submit">Filtrar</button>
      </form>
      {cargado && eventos.length === 0 ? <p>Todavía no hay eventos para el filtro.</p> : null}
      <div className="tabla-contenedor">
        <table>
          <caption>Eventos de trazabilidad</caption>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Actor</th>
              <th>Operación</th>
              <th>Entidad</th>
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
                  <td>
                    {evento.entidad_tipo}
                    {evento.entidad_id ? <small>{evento.entidad_id}</small> : null}
                  </td>
                  <td>{evento.resultado === "exito" ? "Éxito" : "Fallo"}</td>
                  <td>
                    <button type="button" className="secundario" onClick={() => setAbierto(abierto === evento.id ? null : evento.id)}>
                      {abierto === evento.id ? "Ocultar" : "Ver antes y después"}
                    </button>
                  </td>
                </tr>
                {abierto === evento.id ? (
                  <tr>
                    <td colSpan={6}>
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
      <div className="paginacion">
        <button
          type="button"
          className="secundario"
          disabled={!hayAnterior}
          onClick={() => void cargar(filtros, Math.max(0, offset - TAMANO)).catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "Error"))}
        >
          Anterior
        </button>
        <span>
          {desde}–{hasta} de {total}
        </span>
        <button
          type="button"
          className="secundario"
          disabled={!haySiguiente}
          onClick={() => void cargar(filtros, offset + TAMANO).catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "Error"))}
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
