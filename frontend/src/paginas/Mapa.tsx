import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cargarTerritorio, type Territorio } from "../cobertura";
import { MapaEcuador } from "../componentes/MapaEcuador";
import { useEjemplo } from "../ejemplo";

type Modo = "calor" | "puntos";

export function Mapa() {
  const ejemplo = useEjemplo();
  const [params, setParams] = useSearchParams();
  const [territorio, setTerritorio] = useState<Territorio | null>(null);
  const [error, setError] = useState("");
  const [modo, setModo] = useState<Modo>("calor");
  const provincia = params.get("provincia");

  useEffect(() => {
    void cargarTerritorio()
      .then(setTerritorio)
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo cargar la cobertura."));
  }, []);

  function elegir(codigo: string | null) {
    const siguientes = new URLSearchParams(params);
    if (codigo) {
      siguientes.set("provincia", codigo);
    } else {
      siguientes.delete("provincia");
    }
    setParams(siguientes, { replace: true });
  }

  const provincias = territorio?.provincias ?? [];
  const conAgencia = provincias.filter((item) => item.con_agencia);
  const resto = provincias.filter((item) => !item.con_agencia);
  const elegida = provincias.find((item) => item.codigo === provincia);

  return (
    <section className="tablero">
      <header className="encabezado-pagina">
        <div>
          <p className="sobrelinea">Cobertura nacional</p>
          <h1>Mapa geoespacial</h1>
          <p className="lead">
            El encuadre inicial cubre el Ecuador continental. Galápagos aparece en un recuadro para no alejar el mapa.
          </p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="filtros-mapa">
        <label>
          Provincia
          <select value={provincia ?? ""} onChange={(evento) => elegir(evento.target.value || null)}>
            <option value="">Todo el Ecuador continental</option>
            <optgroup label="Con agencia">
              {conAgencia.map((item) => (
                <option key={item.codigo} value={item.codigo}>
                  {item.nombre}
                </option>
              ))}
            </optgroup>
            <optgroup label="Resto del país">
              {resto.map((item) => (
                <option key={item.codigo} value={item.codigo}>
                  {item.nombre}
                  {item.es_galapagos ? " (recuadro)" : ""}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label>
          Cantón
          <select disabled defaultValue="" title="El zoom por cantón se activará cuando existan contornos cantonales">
            <option value="">Sin contornos de cantón</option>
          </select>
        </label>
        <div className="segmento" role="group" aria-label="Tipo de capa">
          <button type="button" aria-pressed={modo === "calor"} onClick={() => setModo("calor")}>
            Calor
          </button>
          <button type="button" aria-pressed={modo === "puntos"} onClick={() => setModo("puntos")}>
            Puntos
          </button>
        </div>
      </div>
      <p className="nota">
        El filtro de cantón queda visible y desactivado: no hay límites cantonales cargados. Elegir una provincia acerca
        su contorno.
        {elegida?.nota ? ` ${elegida.nota}` : ""}
        {elegida?.es_galapagos ? " Galápagos se consulta en el recuadro, sin cambiar el encuadre continental." : ""}
      </p>
      <div className="mapa-y-lista">
        <MapaEcuador
          modo={modo}
          ejemplo={ejemplo.activo}
          provincia={elegida?.es_galapagos ? null : provincia}
          onProvincia={(codigo) => elegir(codigo)}
        />
        <ul className="lista-provincias" aria-label="Provincias">
          <li>
            <button type="button" className={provincia ? "secundario" : "primario"} onClick={() => elegir(null)}>
              Ecuador continental
            </button>
          </li>
          {provincias.map((item) => (
            <li key={item.codigo}>
              <button
                type="button"
                className={item.codigo === provincia ? "primario" : "secundario"}
                onClick={() => elegir(item.codigo)}
              >
                <span>{item.nombre}</span>
                <small>{item.con_agencia ? "Con agencia" : item.es_galapagos ? "Recuadro" : "Sin agencia"}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="leyenda" aria-label="Leyenda del mapa">
        <p>
          <span className="muestra con-agencia" /> Provincia con agencia
        </p>
        <p>
          <span className="muestra sin-agencia" /> Provincia sin agencia
        </p>
        <p>
          <span className="muestra seleccion" /> Provincia seleccionada
        </p>
        <p>
          <span className="muestra calor" /> {ejemplo.activo ? "Calor de ejemplo, de bajo a alto" : "Sin capa de calor real"}
        </p>
      </div>
      {territorio ? (
        <p className="nota">
          Límites: {territorio.fuente.nombre}. Licencia {territorio.fuente.licencia}. {territorio.fuente.cita}
        </p>
      ) : (
        <p className="estado">Cargando los límites provinciales…</p>
      )}
    </section>
  );
}
