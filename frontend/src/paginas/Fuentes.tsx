import { useEffect, useState } from "react";
import { api } from "../api";
import { cargarTerritorio, invalidarTerritorio, type Territorio } from "../cobertura";
import { Icono } from "../componentes/Icono";

const PASOS = [
  ["Ingreso", "CSV y formularios"],
  ["Normalización", "Formatos y duplicados"],
  ["Geocodificación", "Coordenadas válidas"],
  ["Modelo", "Índice de oportunidad"],
] as const;

export function Fuentes() {
  const [territorio, setTerritorio] = useState<Territorio | null>(null);
  const [notaImportacion, setNotaImportacion] = useState("");
  const [lotes, setLotes] = useState(0);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    invalidarTerritorio();
    const [cobertura, importaciones] = await Promise.all([
      cargarTerritorio(),
      api<{ nota: string; lotes: unknown[] }>("/api/importaciones").catch(() => ({
        nota: "La consulta de lotes no está disponible para este rol.",
        lotes: [] as unknown[],
      })),
    ]);
    setTerritorio(cobertura);
    setNotaImportacion(importaciones.nota);
    setLotes(importaciones.lotes.length);
  }

  useEffect(() => {
    void cargar().catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudieron leer las fuentes."));
  }, []);

  const fuente = territorio?.fuente;

  return (
    <div className="sources-layout">
      {error ? <p className="error">{error}</p> : null}
      {mensaje ? <p className="ok">{mensaje}</p> : null}
      <section className="lineage panel">
        <div className="panel-title">
          <div>
            <span>Linaje</span>
            <h2>Recorrido de cada dato</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setMensaje("");
              void cargar()
                .then(() => setMensaje("Consulta actualizada. No hay un proceso de sincronización de lotes."))
                .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo actualizar."));
            }}
          >
            Actualizar <Icono nombre="flecha" />
          </button>
        </div>
        <p className="nota-inline">Este recorrido es el proceso previsto. Todavía no hay lotes de socios que lo alimenten.</p>
        <div className="flow">
          {PASOS.map(([titulo, detalle], indice) => (
            <div key={titulo}>
              <span>{String(indice + 1).padStart(2, "0")}</span>
              <b>{titulo}</b>
              <small>{detalle}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="source-stack">
        <article className="source-card">
          <div className="source-mark">Geo</div>
          <div>
            <span>Límites provinciales</span>
            <h2>{fuente?.nombre ?? "Cargando la ficha…"}</h2>
            {fuente ? (
              <>
                <p>Licencia {fuente.licencia}. La API no entrega un porcentaje de calidad para esta fuente.</p>
                <p>{fuente.cita}</p>
                <p className="enlaces-fuente">
                  <a href={fuente.url} target="_blank" rel="noreferrer">
                    Archivo de origen
                  </a>
                  {" · "}
                  <a href={fuente.doi} target="_blank" rel="noreferrer">
                    Publicación
                  </a>
                  {" · "}
                  <a href={fuente.licencia_url} target="_blank" rel="noreferrer">
                    Licencia
                  </a>
                </p>
              </>
            ) : (
              <p className="estado">Cargando la ficha de la fuente…</p>
            )}
          </div>
          <mark>Disponible</mark>
        </article>
        <article className="source-card">
          <div className="source-mark vacio">—</div>
          <div>
            <span>Registros de socios</span>
            <h2>Sin lotes</h2>
            <p>{notaImportacion || "Todavía no hay un archivo de socios cargado."}</p>
            <p>{lotes === 0 ? "0 lotes en el servidor." : `${lotes} lotes en el servidor.`}</p>
          </div>
          <mark className="review">Sin registros</mark>
        </article>
      </section>
    </div>
  );
}
