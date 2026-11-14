import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Icono } from "../componentes/Icono";
import { formatoEntero } from "../formato";

type Lote = { id?: string; nombre?: string };

type Inspeccion = {
  nombre: string;
  filas: number;
  encabezados: string[];
  incompletas: number;
};

const PASOS = ["Seleccionar", "Mapear", "Validar", "Publicar"] as const;
const REQUERIDAS = [
  { campo: "nombre", etiqueta: "Nombre" },
  { campo: "latitud", etiqueta: "Latitud" },
  { campo: "longitud", etiqueta: "Longitud" },
  { campo: "canton", etiqueta: "Cantón" },
] as const;

export function Importar() {
  const entrada = useRef<HTMLInputElement>(null);
  const [nota, setNota] = useState("Cargando el estado de las importaciones…");
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [inspeccion, setInspeccion] = useState<Inspeccion | null>(null);

  useEffect(() => {
    void api<{ lotes: Lote[]; nota: string }>("/api/importaciones")
      .then((respuesta) => {
        setLotes(respuesta.lotes);
        setNota(respuesta.nota);
      })
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo consultar las importaciones."));
  }, []);

  async function leerArchivo(archivo: File | undefined) {
    setAviso("");
    if (!archivo) {
      return;
    }
    const nombre = archivo.name.toLocaleLowerCase("es");
    if (nombre.endsWith(".xlsx") || nombre.endsWith(".xls")) {
      setAviso("La carga XLSX queda fuera de este alcance.");
      return;
    }
    if (!nombre.endsWith(".csv")) {
      setAviso("Seleccione un archivo con extensión CSV. El archivo no se envía al servidor.");
      return;
    }
    if (archivo.size > 8_000_000) {
      setAviso("El archivo supera 8 MB. La inspección local no lo abre.");
      return;
    }
    const texto = await archivo.text();
    setInspeccion(inspeccionarCsv(texto, archivo.name));
  }

  const mapeo = REQUERIDAS.map((item) => ({
    ...item,
    encabezado: inspeccion?.encabezados.find((encabezado) => coincide(encabezado, item.campo)) ?? null,
  }));
  const etapa = inspeccion ? 2 : 0;

  return (
    <div className="import-layout">
      <p className="aviso span-completo">{nota}</p>
      {error ? <p className="error span-completo">{error}</p> : null}
      {aviso ? (
        <p className="error span-completo" role="alert">
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
          void leerArchivo(evento.dataTransfer.files[0]);
        }}
      >
        <input
          ref={entrada}
          type="file"
          accept=".csv,text/csv"
          hidden
          aria-describedby="nota-csv"
          onChange={(evento) => void leerArchivo(evento.target.files?.[0])}
        />
        <div className="lab-orbit">
          <Icono nombre="archivo" />
        </div>
        <h2>{inspeccion ? inspeccion.nombre : "Suelta aquí un CSV para inspeccionarlo"}</h2>
        <p id="nota-csv">
          {inspeccion
            ? `${formatoEntero(inspeccion.filas)} filas · ${inspeccion.encabezados.length} columnas detectadas. La lectura queda en el navegador y no crea un lote.`
            : "El contrato de importación sigue pendiente. Esta pantalla no envía el archivo ni publica un lote."}
        </p>
        <div className="lab-actions">
          <button type="button" onClick={() => entrada.current?.click()}>
            <Icono nombre="importar" /> Elegir archivo
          </button>
        </div>
      </section>
      <aside className="panel validation-panel">
        <div className="panel-title compact">
          <div>
            <span>Validación</span>
            <h2>Columnas obligatorias</h2>
          </div>
          <Icono nombre="candado" />
        </div>
        {mapeo.map((item) => (
          <div className={`map-field ${item.encabezado ? "ok" : ""}`} key={item.campo}>
            <span>{item.etiqueta}</span>
            <b>{item.encabezado ?? (inspeccion ? "Falta" : "Pendiente")}</b>
          </div>
        ))}
        <div className="quality-meter">
          <span>Registros completos</span>
          <strong>
            {inspeccion ? `${formatoEntero(Math.max(0, inspeccion.filas - inspeccion.incompletas))} / ${formatoEntero(inspeccion.filas)}` : "—"}
          </strong>
        </div>
        <button type="button" className="publish" disabled>
          Publicar lote
        </button>
        <p className="nota-capa">Publicar, cancelar y retirar un lote no están disponibles. El servidor responde que la carga sigue pendiente.</p>
      </aside>
      <section className="panel span-completo">
        <h2>Lotes</h2>
        {lotes.length === 0 ? <p>No hay lotes cargados.</p> : <p>{lotes.length} lotes en el servidor.</p>}
      </section>
    </div>
  );
}

function coincide(encabezado: string, campo: string) {
  const normal = normalizar(encabezado);
  if (campo === "longitud") {
    return normal.includes("long") || normal.includes("lng") || normal === "lon";
  }
  if (campo === "latitud") {
    return normal.includes("lat");
  }
  return normal.includes(campo);
}

function normalizar(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function inspeccionarCsv(texto: string, nombre: string): Inspeccion {
  const lineas = texto.split(/\r?\n/).filter((linea) => linea.trim());
  if (lineas.length === 0) {
    return { nombre, filas: 0, encabezados: [], incompletas: 0 };
  }
  const primera = lineas[0] ?? "";
  const delimitador = primera.includes(";") ? ";" : ",";
  const encabezados = primera.split(delimitador).map((encabezado) => encabezado.trim().replace(/^"|"$/g, ""));
  const filas = lineas.slice(1).map((linea) => linea.split(delimitador));
  const incompletas = filas.filter((fila) => fila.length < encabezados.length || fila.some((celda) => !celda.trim())).length;
  return { nombre, filas: filas.length, encabezados, incompletas };
}
