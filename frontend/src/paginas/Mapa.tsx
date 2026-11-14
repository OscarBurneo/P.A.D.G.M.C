import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cargarTerritorio, type ProvinciaTerritorio, type Territorio } from "../cobertura";
import { Icono } from "../componentes/Icono";
import { MapaEcuador, type CapasMapa } from "../componentes/MapaEcuador";
import { resumenProvinciaEjemplo } from "../datos/ejemplo";
import { useEjemplo } from "../ejemplo";
import { type FocoZona, useFoco } from "../foco";

export function Mapa() {
  const ejemplo = useEjemplo();
  const { zona, fijar, limpiar } = useFoco();
  const [params, setParams] = useSearchParams();
  const [territorio, setTerritorio] = useState<Territorio | null>(null);
  const [error, setError] = useState("");
  const [densidad, setDensidad] = useState(true);
  const [registros, setRegistros] = useState(false);
  const [agencias, setAgencias] = useState(true);
  const provincia = params.get("provincia");
  const consulta = (params.get("q") ?? "").trim().toLocaleLowerCase("es");

  useEffect(() => {
    void cargarTerritorio()
      .then(setTerritorio)
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo cargar la cobertura."));
  }, []);

  const capas = useMemo<CapasMapa>(
    () => ({ densidad, registros, agencias }),
    [densidad, registros, agencias],
  );

  function elegir(codigo: string | null) {
    const siguientes = new URLSearchParams(params);
    if (codigo) {
      siguientes.set("provincia", codigo);
    } else {
      siguientes.delete("provincia");
      limpiar();
    }
    setParams(siguientes, { replace: true });
  }

  const provincias = territorio?.provincias ?? [];
  const conAgencia = provincias.filter((item) => item.con_agencia);
  const resto = provincias.filter((item) => !item.con_agencia);
  const elegida = provincias.find((item) => item.codigo === provincia) ?? null;
  const tira = (consulta ? conAgencia.filter((item) => item.nombre.toLocaleLowerCase("es").includes(consulta)) : conAgencia);
  const muestra = ejemplo.activo && elegida ? resumenProvinciaEjemplo(elegida.codigo) : null;

  useEffect(() => {
    if (!elegida) {
      return;
    }
    const resumen = ejemplo.activo ? resumenProvinciaEjemplo(elegida.codigo) : null;
    fijar(focoDesdeProvincia(elegida, resumen));
  }, [elegida, ejemplo.activo, fijar]);

  return (
    <div className="map-workbench">
      {error ? <p className="error span-completo">{error}</p> : null}
      <aside className="layer-dock panel">
        <span className="dock-label">
          <Icono nombre="capas" /> Capas
        </span>
        <button type="button" className={densidad ? "active" : ""} aria-pressed={densidad} onClick={() => setDensidad((valor) => !valor)}>
          <i>{densidad ? <Icono nombre="check" /> : null}</i>
          <span>
            <b>Densidad</b>
            Intensidad de potenciales socios
          </span>
        </button>
        <button type="button" className={registros ? "active" : ""} aria-pressed={registros} onClick={() => setRegistros((valor) => !valor)}>
          <i>{registros ? <Icono nombre="check" /> : null}</i>
          <span>
            <b>Registros</b>
            {ejemplo.activo ? "Puntos ilustrativos, no son socios" : "Sin coordenadas de socios"}
          </span>
        </button>
        <button type="button" className={agencias ? "active" : ""} aria-pressed={agencias} onClick={() => setAgencias((valor) => !valor)}>
          <i>{agencias ? <Icono nombre="check" /> : null}</i>
          <span>
            <b>Agencias</b>
            Provincias con presencia configurada
          </span>
        </button>
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
          <select disabled defaultValue="" aria-describedby="nota-canton">
            <option value="">Sin contornos de cantón</option>
          </select>
        </label>
        <p id="nota-canton" className="nota-capa">
          El filtro de cantón queda visible y desactivado: no hay límites cantonales cargados.
          {!ejemplo.activo
            ? " Densidad y registros no tienen coordenadas reales que dibujar."
            : " La capa encendida es ilustrativa, no son socios."}
          {elegida?.nota ? ` ${elegida.nota}` : ""}
          {elegida?.es_galapagos ? " Galápagos se consulta en el recuadro, sin cambiar el encuadre continental." : ""}
        </p>
        <div className="dock-reading">
          <span>Provincias con agencia</span>
          <strong>{territorio ? conAgencia.length : "—"}</strong>
          <p>Sale de la cobertura configurada. La API no entrega un radio de análisis.</p>
        </div>
      </aside>

      <div className="atlas-map">
        <MapaEcuador
          modo="calor"
          capas={capas}
          ejemplo={ejemplo.activo}
          provincia={elegida?.es_galapagos ? null : provincia}
          mostrarAviso={false}
          onProvincia={(codigo) => elegir(codigo)}
        />
        <div className="map-readout">
          <span>Zona en foco</span>
          <strong>{elegida?.nombre ?? zona.zonaNombre ?? "Sin provincia en foco"}</strong>
          <p>
            {elegida
              ? muestra
                ? `${muestra.socios.toLocaleString("es-EC")} potenciales socios de ejemplo · índice ${muestra.indice}`
                : "Sin registros de potenciales socios."
              : zona.provinciaNombre
                ? "El foco viene de otra pantalla. Elija una provincia para encuadrar el atlas."
                : "Elija una provincia. El encuadre inicial es el Ecuador continental y Galápagos va en el recuadro."}
          </p>
        </div>
      </div>

      <div className="zone-strip" aria-label="Provincias con agencia">
        <button type="button" className={provincia ? "" : "active"} onClick={() => elegir(null)}>
          <span>—</span>
          Ecuador
        </button>
        {tira.map((item) => {
          const resumen = ejemplo.activo ? resumenProvinciaEjemplo(item.codigo) : null;
          return (
            <button
              key={item.codigo}
              type="button"
              className={item.codigo === provincia ? "active" : ""}
              onClick={() => elegir(item.codigo)}
            >
              <span>{resumen ? resumen.indice : "—"}</span>
              {item.nombre}
            </button>
          );
        })}
        {consulta && tira.length === 0 ? <p className="nota-capa">Ninguna provincia con agencia coincide con la búsqueda.</p> : null}
      </div>

      <div className="leyenda span-leyenda" aria-label="Leyenda del mapa">
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
        <p className="nota span-leyenda">
          Límites: {territorio.fuente.nombre}. Licencia {territorio.fuente.licencia}. {territorio.fuente.cita}
        </p>
      ) : (
        <p className="estado span-leyenda">Cargando los límites provinciales…</p>
      )}
    </div>
  );
}

function focoDesdeProvincia(
  provincia: ProvinciaTerritorio,
  muestra: { socios: number; indice: number; crecimiento: number; nivel: "Muy alta" | "Alta" | "Media" } | null,
): FocoZona {
  return {
    provinciaCodigo: provincia.codigo,
    provinciaNombre: provincia.nombre,
    zonaNombre: provincia.nombre,
    indice: muestra?.indice ?? null,
    socios: muestra?.socios ?? null,
    crecimiento: muestra?.crecimiento ?? null,
    nivel: muestra?.nivel ?? null,
    ejemplo: Boolean(muestra),
    lng: (provincia.bbox.oeste + provincia.bbox.este) / 2,
    lat: (provincia.bbox.sur + provincia.bbox.norte) / 2,
  };
}
