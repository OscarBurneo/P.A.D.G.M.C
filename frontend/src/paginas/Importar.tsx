import { useEffect, useState } from "react";
import { api } from "../api";

type Lote = { id?: string; nombre?: string };

export function Importar() {
  const [nota, setNota] = useState("Cargando el estado de las importaciones…");
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ lotes: Lote[]; nota: string }>("/api/importaciones")
      .then((respuesta) => {
        setLotes(respuesta.lotes);
        setNota(respuesta.nota);
      })
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo consultar las importaciones."));
  }, []);

  return (
    <section className="panel ancho">
      <p className="sobrelinea">Carga</p>
      <h1>Importar datos</h1>
      <p className="aviso">{nota}</p>
      {error ? <p className="error">{error}</p> : null}
      <form className="formulario" onSubmit={(evento) => evento.preventDefault()}>
        <label>
          Archivo CSV
          <input type="file" accept=".csv,text/csv" disabled />
        </label>
        <button type="submit" disabled>
          Cargar archivo
        </button>
        <p className="nota">
          El contrato de importación sigue pendiente de aprobación. El servidor responde que la carga todavía no está disponible,
          así que este formulario no envía el archivo.
        </p>
      </form>
      <h2>Lotes</h2>
      {lotes.length === 0 ? <p>No hay lotes cargados.</p> : <p>{lotes.length} lotes en el servidor.</p>}
    </section>
  );
}
