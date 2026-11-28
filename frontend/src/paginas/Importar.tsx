import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Icono } from "../componentes/Icono";
import { formatoEntero } from "../formato";

type Columna = {
  campo: string;
  etiqueta: string;
  obligatorio: boolean;
};

type Muestra = { fila: number; clasificacion: string; motivos: string[] };

type Informe = {
  total_procesadas: number;
  total_aceptadas: number;
  total_observadas: number;
  total_rechazadas: number;
  cuadra: boolean;
  estructura_valida: boolean;
  encabezados: string[];
  mapeo: Record<string, string | null>;
  columnas_faltantes: string[];
  motivos: Record<string, number>;
  muestra: Muestra[];
};

type Lote = {
  id: string;
  nombre: string;
  fuente: string;
  actor?: string;
  validos: number;
  observadas: number;
  rechazadas: number;
  invalidos?: number;
  total: number;
  cuadra: boolean;
  actualizado_en: string;
  estado: string;
  estado_codigo: string;
  repetido?: boolean;
  intentos?: number;
  informe?: Informe | null;
};

type FiltrosHistorial = {
  actor: string;
  estado: string;
  texto: string;
  desde: string;
  hasta: string;
};

const PASOS = ["Seleccionar", "Mapear", "Validar", "Publicar"] as const;

const MOTIVOS: Record<string, string> = {
  coordenada_fuera_de_ecuador: "Fuera de Ecuador",
  identificador_duplicado: "Identificador repetido",
  ubicacion_coincidente: "Ubicación coincidente",
  provincia_no_coincide: "Provincia distinta",
  formato_formula: "Fórmula no ejecutada",
  formato_latitud: "Latitud inválida",
  formato_longitud: "Longitud inválida",
  formato_fecha: "Fecha inválida",
};

export function Importar() {
  const entrada = useRef<HTMLInputElement>(null);
  const [nota, setNota] = useState("Cargando el historial de importaciones…");
  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [activo, setActivo] = useState<Lote | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, string | null>>({});
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [motivo, setMotivo] = useState("Retiro solicitado");
  const [filtroActor, setFiltroActor] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  async function refrescar(filtros?: FiltrosHistorial) {
    const vigentes = filtros ?? {
      actor: filtroActor,
      estado: filtroEstado,
      texto: filtroTexto,
      desde: filtroDesde,
      hasta: filtroHasta,
    };
    const consulta = new URLSearchParams();
    if (vigentes.actor.trim()) {
      consulta.set("actor", vigentes.actor.trim());
    }
    if (vigentes.estado) {
      consulta.set("estado", vigentes.estado);
    }
    if (vigentes.texto.trim()) {
      consulta.set("texto", vigentes.texto.trim());
    }
    if (vigentes.desde) {
      consulta.set("desde", vigentes.desde);
    }
    if (vigentes.hasta) {
      consulta.set("hasta", vigentes.hasta);
    }
    const query = consulta.toString();
    const respuesta = await api<{ nota: string; columnas: Columna[]; lotes: Lote[] }>(
      `/api/importaciones${query ? `?${query}` : ""}`,
    );
    setNota(respuesta.nota);
    setColumnas(respuesta.columnas);
    setLotes(respuesta.lotes);
  }

  useEffect(() => {
    void refrescar().catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo consultar las importaciones."));
  }, []);

  function tomar(lote: Lote) {
    setActivo(lote);
    setMapeo(lote.informe?.mapeo ?? {});
    setAviso(lote.repetido ? "El archivo ya estaba cargado. Se registró un intento nuevo y se muestra el lote previo." : "");
  }

  async function enviar(archivo: File | undefined) {
    setAviso("");
    setError("");
    if (!archivo) {
      return;
    }
    const nombre = archivo.name.toLocaleLowerCase("es");
    if (!nombre.endsWith(".csv") && !nombre.endsWith(".xlsx")) {
      setAviso("Seleccione un archivo CSV o XLSX.");
      return;
    }
    const cuerpo = new FormData();
    cuerpo.append("archivo", archivo);
    setOcupado(true);
    try {
      const lote = await api<Lote>("/api/importaciones", { method: "POST", body: cuerpo });
      tomar(lote);
      await refrescar();
    } catch (causa: unknown) {
      setError(causa instanceof Error ? causa.message : "No se pudo cargar el archivo.");
    } finally {
      setOcupado(false);
    }
  }

  async function validarMapeo() {
    if (!activo) {
      return;
    }
    setOcupado(true);
    setError("");
    try {
      const lote = await api<Lote>(`/api/importaciones/${activo.id}/mapeo`, {
        method: "PATCH",
        body: JSON.stringify({ mapeo }),
      });
      tomar(lote);
      await refrescar();
    } catch (causa: unknown) {
      setError(causa instanceof Error ? causa.message : "No se pudo validar el mapeo.");
    } finally {
      setOcupado(false);
    }
  }

  async function publicar() {
    if (!activo) {
      return;
    }
    setOcupado(true);
    setError("");
    try {
      const lote = await api<Lote>(`/api/importaciones/${activo.id}/publicar`, { method: "POST" });
      tomar(lote);
      await refrescar();
    } catch (causa: unknown) {
      setError(causa instanceof Error ? causa.message : "No se pudo publicar el lote.");
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar() {
    if (!activo) {
      return;
    }
    setOcupado(true);
    setError("");
    try {
      const lote = await api<Lote>(`/api/importaciones/${activo.id}/cancelar`, { method: "POST" });
      tomar(lote);
      await refrescar();
    } catch (causa: unknown) {
      setError(causa instanceof Error ? causa.message : "No se pudo cancelar el lote.");
    } finally {
      setOcupado(false);
    }
  }

  async function retirar() {
    if (!activo) {
      return;
    }
    setOcupado(true);
    setError("");
    try {
      const lote = await api<Lote>(`/api/importaciones/${activo.id}/retirar`, {
        method: "POST",
        body: JSON.stringify({ motivo }),
      });
      tomar(lote);
      await refrescar();
    } catch (causa: unknown) {
      setError(causa instanceof Error ? causa.message : "No se pudo retirar el lote.");
    } finally {
      setOcupado(false);
    }
  }

  const informe = activo?.informe;
  const etapa = !activo ? 0 : activo.estado_codigo === "completado" || activo.estado_codigo === "retirado" ? 4 : informe?.estructura_valida ? 2 : 1;
  const puedePublicar = activo?.estado_codigo === "pendiente" && (activo.validos > 0 || activo.observadas > 0);
  const puedeCancelar = activo?.estado_codigo === "pendiente" || activo?.estado_codigo === "finalizado_con_errores";
  const puedeRetirar = activo?.estado_codigo === "completado";

  return (
    <div className="import-layout">
      <p className="aviso span-completo">{nota}</p>
      {error ? <p className="error span-completo">{error}</p> : null}
      {aviso ? (
        <p className="ok span-completo" role="status">
          {aviso}
        </p>
      ) : null}
      <ol className="pipeline">
        {PASOS.map((paso, indice) => (
          <li key={paso} className={indice < etapa ? "done" : indice === etapa ? "current" : ""}>
            <span>{indice < etapa ? <Icono nombre="check" /> : indice + 1}</span>
            {paso}
          </li>
        ))}
      </ol>
      <section
        className={`csv-lab ${arrastrando ? "dragging" : ""}`}
        onDragOver={(evento) => {
          evento.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(evento) => {
          evento.preventDefault();
          setArrastrando(false);
          void enviar(evento.dataTransfer.files[0]);
        }}
      >
        <input
          ref={entrada}
          className="selector-archivo"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Archivo CSV o XLSX"
          aria-describedby="nota-csv"
          onChange={(evento) => {
            const archivo = evento.target.files?.[0];
            evento.target.value = "";
            void enviar(archivo);
          }}
        />
        <div className="lab-orbit">
          <Icono nombre="archivo" />
        </div>
        <h2>{activo ? activo.nombre : "Suelta aquí un CSV o XLSX"}</h2>
        <p id="nota-csv">
          {activo
            ? `${formatoEntero(activo.total)} filas · ${activo.estado}. ${activo.intentos ? `${activo.intentos} intentos.` : ""}`
            : "El archivo se envía al servidor, se valida y queda pendiente hasta que se publique."}
        </p>
        <div className="lab-actions">
          <button type="button" disabled={ocupado} onClick={() => entrada.current?.click()}>
            <Icono nombre="importar" /> Elegir archivo
          </button>
        </div>
      </section>
      <aside className="panel validation-panel">
        <div className="panel-title compact">
          <div>
            <span>Validación</span>
            <h2>Columnas del contrato</h2>
          </div>
          <Icono nombre="candado" />
        </div>
        {(columnas.length ? columnas : []).map((columna) => (
          <label className="map-field" key={columna.campo}>
            <span>{columna.etiqueta}</span>
            <select
              value={mapeo[columna.campo] ?? ""}
              disabled={!informe}
              onChange={(evento) => setMapeo((actual) => ({ ...actual, [columna.campo]: evento.target.value || null }))}
            >
              <option value="">{informe ? "Sin columna" : "Pendiente"}</option>
              {(informe?.encabezados ?? []).map((encabezado) => (
                <option key={encabezado} value={encabezado}>
                  {encabezado}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="quality-meter">
          <span>Resumen reconciliado</span>
          <strong>
            {activo
              ? `${formatoEntero(activo.validos)} válidas · ${formatoEntero(activo.observadas)} observadas · ${formatoEntero(activo.rechazadas)} rechazadas`
              : "—"}
          </strong>
        </div>
        {activo?.cuadra ? <p className="nota-capa">El total cuadra con válidas, observadas y rechazadas.</p> : null}
        {informe && !informe.estructura_valida ? (
          <p className="error">Faltan: {informe.columnas_faltantes.join(", ")}.</p>
        ) : null}
        <button type="button" className="secundario" disabled={!informe || ocupado} onClick={() => void validarMapeo()}>
          Validar mapeo
        </button>
        <button type="button" className="publish" disabled={!puedePublicar || ocupado} onClick={() => void publicar()}>
          Publicar lote
        </button>
        <button type="button" className="secundario" disabled={!puedeCancelar || ocupado} onClick={() => void cancelar()}>
          Cancelar antes de procesar
        </button>
        {puedeRetirar ? (
          <>
            <label>
              Motivo del retiro
              <input value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />
            </label>
            <button type="button" className="secundario" disabled={ocupado || !motivo.trim()} onClick={() => void retirar()}>
              Retirar lote
            </button>
          </>
        ) : null}
        <p className="nota-capa">Retirar conserva el archivo. El lote deja de contar en el análisis.</p>
      </aside>
      {informe && informe.muestra.length > 0 ? (
        <section className="panel span-completo">
          <h2>Filas observadas y rechazadas</h2>
          <div className="tabla-contenedor">
            <table>
              <caption>Muestra del informe. El conteo completo está en el resumen.</caption>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Clasificación</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {informe.muestra.slice(0, 8).map((fila) => (
                  <tr key={`${fila.fila}-${fila.clasificacion}`}>
                    <td>{fila.fila}</td>
                    <td>{fila.clasificacion}</td>
                    <td>{fila.motivos.map((item) => MOTIVOS[item] ?? item.replaceAll("_", " ")).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <section className="panel span-completo">
        <h2>Historial de archivos</h2>
        <form
          className="filtros"
          onSubmit={(evento) => {
            evento.preventDefault();
            void refrescar({
              actor: filtroActor,
              estado: filtroEstado,
              texto: filtroTexto,
              desde: filtroDesde,
              hasta: filtroHasta,
            }).catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo filtrar el historial."));
          }}
        >
          <label>
            Actor
            <input value={filtroActor} onChange={(evento) => setFiltroActor(evento.target.value)} />
          </label>
          <label>
            Estado
            <select value={filtroEstado} onChange={(evento) => setFiltroEstado(evento.target.value)}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="completado">Completado</option>
              <option value="finalizado_con_errores">Finalizado con errores</option>
              <option value="cancelado">Cancelado</option>
              <option value="retirado">Retirado</option>
            </select>
          </label>
          <label>
            Archivo
            <input value={filtroTexto} onChange={(evento) => setFiltroTexto(evento.target.value)} />
          </label>
          <label>
            Desde
            <input type="date" value={filtroDesde} onChange={(evento) => setFiltroDesde(evento.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={filtroHasta} onChange={(evento) => setFiltroHasta(evento.target.value)} />
          </label>
          <button type="submit">Filtrar historial</button>
        </form>
        {lotes.length === 0 ? (
          <p>No hay lotes cargados.</p>
        ) : (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Actor</th>
                  <th>Fuente</th>
                  <th>Válidas</th>
                  <th>Observadas</th>
                  <th>Rechazadas</th>
                  <th>Estado</th>
                  <th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((lote) => (
                  <tr key={lote.id}>
                    <td>
                      <button type="button" className="secundario" onClick={() => void abrir(lote.id)}>
                        {lote.nombre}
                      </button>
                    </td>
                    <td>{lote.actor ?? "—"}</td>
                    <td>{lote.fuente}</td>
                    <td>{formatoEntero(lote.validos)}</td>
                    <td>{formatoEntero(lote.observadas)}</td>
                    <td>{formatoEntero(lote.rechazadas)}</td>
                    <td>{lote.estado}</td>
                    <td>{new Date(lote.actualizado_en).toLocaleString("es-EC")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );

  async function abrir(id: string) {
    setError("");
    try {
      const lote = await api<Lote>(`/api/importaciones/${id}`);
      tomar(lote);
    } catch (causa: unknown) {
      setError(causa instanceof Error ? causa.message : "No se pudo abrir el lote.");
    }
  }
}
