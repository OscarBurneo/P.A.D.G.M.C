import { useEffect, useState } from "react";
import { api } from "../api";
import { cargarTerritorio, type Territorio } from "../cobertura";

export function Fuentes() {
  const [territorio, setTerritorio] = useState<Territorio | null>(null);
  const [notaImportacion, setNotaImportacion] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void cargarTerritorio()
      .then(setTerritorio)
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudieron leer los límites."));
    void api<{ nota: string }>("/api/importaciones")
      .then((respuesta) => setNotaImportacion(respuesta.nota))
      .catch(() => setNotaImportacion("La consulta de lotes no está disponible para este rol."));
  }, []);

  const fuente = territorio?.fuente;

  return (
    <section className="panel ancho">
      <p className="sobrelinea">Procedencia</p>
      <h1>Fuentes de datos</h1>
      {error ? <p className="error">{error}</p> : null}
      <article className="tarjeta">
        <h2>Límites provinciales</h2>
        {fuente ? (
          <>
            <p>{fuente.nombre}</p>
            <p>
              Licencia: <strong>{fuente.licencia}</strong>
            </p>
            <p>{fuente.cita}</p>
            <p>{fuente.nota}</p>
            <p>
              <a href={fuente.url} target="_blank" rel="noreferrer">
                Archivo de origen
              </a>
              {" · "}
              <a href={fuente.doi} target="_blank" rel="noreferrer">
                Publicación
              </a>
              {" · "}
              <a href={fuente.licencia_url} target="_blank" rel="noreferrer">
                Texto de la licencia
              </a>
            </p>
          </>
        ) : (
          <p className="estado">Cargando la ficha de la fuente…</p>
        )}
      </article>
      <article className="tarjeta">
        <h2>Registros de socios</h2>
        <p>{notaImportacion || "Todavía no hay un archivo de socios cargado."}</p>
        <p className="nota">Las cifras del tablero, cuando la vista de ejemplo está activa, no provienen de esta fuente.</p>
      </article>
    </section>
  );
}
