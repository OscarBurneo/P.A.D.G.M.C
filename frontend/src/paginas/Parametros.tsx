import { useEffect, useState } from "react";
import { api } from "../api";
import { invalidarTerritorio, type ProvinciaTerritorio } from "../cobertura";

type Parametro = {
  clave: string;
  valor: number | boolean;
  tipo: string;
  descripcion: string;
  estado_aprobacion: string;
  pendiente: string;
  minimo?: number;
  maximo?: number;
};

type Respuesta = {
  parametros: Parametro[];
  perfil_hash: {
    algoritmo: string;
    time_cost: number;
    memory_cost: number;
    parallelism: number;
    estado_aprobacion: string;
    nota: string;
  };
};

export function Parametros() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    setDatos(await api<Respuesta>("/api/admin/parametros"));
  }

  useEffect(() => {
    void cargar().catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "Error"));
  }, []);

  async function guardar(clave: string, valor: number | boolean) {
    setError("");
    setMensaje("");
    try {
      await api(`/api/admin/parametros/${clave}`, {
        method: "PATCH",
        body: JSON.stringify({ valor }),
      });
      setMensaje("Valor guardado. Sigue pendiente de aprobación.");
      await cargar();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo guardar.");
    }
  }

  if (!datos) {
    return <p className="estado">Cargando parámetros…</p>;
  }

  return (
    <section className="panel ancho">
      <p className="sobrelinea">P-09</p>
      <h1>Parámetros</h1>
      <p className="aviso">Valores propuestos. No hay secretos de despliegue en esta pantalla.</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {mensaje ? <p className="ok">{mensaje}</p> : null}
      <ul className="parametros">
        {datos.parametros.map((parametro) => (
          <li key={parametro.clave}>
            <div>
              <strong>{parametro.clave}</strong>
              <p>{parametro.descripcion}</p>
              <small>
                {parametro.pendiente} · pendiente de aprobación
              </small>
            </div>
            {parametro.tipo === "booleano" ? (
              <label className="check">
                <input
                  type="checkbox"
                  checked={Boolean(parametro.valor)}
                  onChange={(evento) => void guardar(parametro.clave, evento.target.checked)}
                />
                <span>Activo</span>
              </label>
            ) : (
              <form
                onSubmit={(evento) => {
                  evento.preventDefault();
                  const campo = new FormData(evento.currentTarget).get("valor");
                  void guardar(parametro.clave, Number(campo));
                }}
              >
                <input
                  name="valor"
                  type="number"
                  defaultValue={Number(parametro.valor)}
                  min={parametro.minimo}
                  max={parametro.maximo}
                />
                <button type="submit">Guardar</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <EditorCobertura />
      <article className="perfil-hash">
        <h2>Perfil de hash</h2>
        <p>
          {datos.perfil_hash.algoritmo}, tiempo {datos.perfil_hash.time_cost}, memoria{" "}
          {datos.perfil_hash.memory_cost} KiB, paralelismo {datos.perfil_hash.parallelism}. Estado:{" "}
          pendiente de aprobación.
        </p>
        <p>{datos.perfil_hash.nota}</p>
      </article>
    </section>
  );
}

function EditorCobertura() {
  const [provincias, setProvincias] = useState<ProvinciaTerritorio[] | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    const respuesta = await api<{ provincias: ProvinciaTerritorio[] }>("/api/cobertura/provincias?contorno=false");
    setProvincias(
      respuesta.provincias.slice().sort((a, b) => Number(b.con_agencia) - Number(a.con_agencia) || a.nombre.localeCompare(b.nombre, "es")),
    );
  }

  useEffect(() => {
    void cargar().catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo leer la cobertura."));
  }, []);

  async function cambiar(codigo: string, activa: boolean) {
    setError("");
    setMensaje("");
    try {
      await api(`/api/cobertura/provincias/${codigo}`, {
        method: "PATCH",
        body: JSON.stringify({ activa }),
      });
      invalidarTerritorio();
      setMensaje("Cobertura actualizada. El mapa usa este listado.");
      await cargar();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo actualizar la provincia.");
    }
  }

  return (
    <article className="perfil-hash">
      <h2>Provincias con agencia</h2>
      <p>
        Esta lista es configuración de la base. No está fija en las pantallas. Al activar una provincia pasa a resaltarse
        en el mapa del Ecuador.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {mensaje ? <p className="ok">{mensaje}</p> : null}
      {!provincias ? <p className="estado">Cargando provincias…</p> : null}
      <ul className="parametros">
        {(provincias ?? []).map((provincia) => (
          <li key={provincia.codigo}>
            <div>
              <strong>{provincia.nombre}</strong>
              <p>{provincia.nota || (provincia.es_galapagos ? "Se muestra en el recuadro de Galápagos." : "Provincia del catálogo ADM1.")}</p>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={provincia.con_agencia}
                onChange={(evento) => void cambiar(provincia.codigo, evento.target.checked)}
              />
              <span>Con agencia</span>
            </label>
          </li>
        ))}
      </ul>
    </article>
  );
}
