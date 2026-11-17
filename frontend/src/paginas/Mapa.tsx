import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { cargarTerritorio, type ProvinciaTerritorio, type ResumenReal, type Territorio } from "../cobertura";
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
  const [celdas, setCeldas] = useState<{ longitud: number; latitud: number; peso: number }[]>([]);
  const [resumen, setResumen] = useState<ResumenReal | null>(null);
  const [datosListos, setDatosListos] = useState(false);
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
    let vigente = true;
    void Promise.all([
      api<{ celdas: { longitud: number; latitud: number; peso: number }[] }>("/api/mapas/calor").catch(() => ({
        celdas: [],
      })),
      api<ResumenReal>("/api/mapas/resumen").catch(() => null),
    ]).then(([calor, territorial]) => {
      if (!vigente) {
        return;
      }
      setCeldas(calor.celdas);
      setResumen(territorial);
      setDatosListos(true);
    });
    return () => {
      vigente = false;
    };
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
  const medidas = useMemo(() => medidasReales(resumen), [resumen]);
  const hayDatosReales = celdas.length > 0 || (resumen?.total_registros ?? 0) > 0;
  const vistaEjemplo = ejemplo.activo && datosListos && !hayDatosReales;
  const real = elegida ? medidaPublicada(medidas, elegida.codigo) : null;
  const muestra = !real && vistaEjemplo && elegida ? resumenProvinciaEjemplo(elegida.codigo) : null;

  useEffect(() => {
    if (!elegida || !datosListos) {
      return;
    }
    const publicada = medidaPublicada(medidas, elegida.codigo);
    if (publicada) {
      fijar(focoDesdeReal(elegida, publicada));
      return;
    }
    if (ejemplo.activo && !hayDatosReales) {
      fijar(focoDesdeProvincia(elegida, resumenProvinciaEjemplo(elegida.codigo)));
      return;
    }
    fijar(focoSinRegistros(elegida));
  }, [datosListos, ejemplo.activo, elegida, fijar, hayDatosReales, medidas]);

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
            {ejemplo.activo && celdas.length === 0 ? "Puntos ilustrativos, no son socios" : "Celdas agregadas, sin identificar personas"}
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
          {!ejemplo.activo && celdas.length === 0
            ? " Densidad y registros no tienen coordenadas reales que dibujar."
            : celdas.length > 0
              ? " La capa de calor usa los lotes publicados, agrupados en una grilla."
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
          celdas={celdas}
          provincia={elegida?.es_galapagos ? null : provincia}
          mostrarAviso={false}
          onProvincia={(codigo) => elegir(codigo)}
        />
        <div className="map-readout">
          <span>Zona en foco</span>
          <strong>{elegida?.nombre ?? zona.zonaNombre ?? "Sin provincia en foco"}</strong>
          <p>
            {elegida ? (
              real ? (
                textoReal(real)
              ) : muestra ? (
                <>
                  <em className="chip-ejemplo">Ejemplo</em> {textoEjemplo(muestra)}
                </>
              ) : (
                "Sin registros publicados para esta provincia."
              )
            ) : zona.provinciaNombre ? (
              "El foco viene de otra pantalla. Elija una provincia para encuadrar el atlas."
            ) : (
              "Elija una provincia. El encuadre inicial es el Ecuador continental y Galápagos va en el recuadro."
            )}
          </p>
        </div>
      </div>

      <div className="zone-strip" aria-label="Provincias con agencia">
        <button type="button" className={provincia ? "" : "active"} onClick={() => elegir(null)}>
          <span>—</span>
          Ecuador
        </button>
        {tira.map((item) => {
          const publicada = medidaPublicada(medidas, item.codigo);
          const ilustrativa = !publicada && vistaEjemplo ? resumenProvinciaEjemplo(item.codigo) : null;
          const indice = publicada?.indice ?? ilustrativa?.indice;
          return (
            <button
              key={item.codigo}
              type="button"
              className={item.codigo === provincia ? "active" : ""}
              aria-label={
                publicada
                  ? `${item.nombre}, ${publicada.registros} registros publicados, índice ${publicada.indice ?? "sin índice"}`
                  : ilustrativa
                    ? `${item.nombre}, índice de ejemplo ${ilustrativa.indice}`
                    : `${item.nombre}, sin registros publicados`
              }
              onClick={() => elegir(item.codigo)}
            >
              <span>{indice ?? "—"}</span>
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
          <span className="muestra calor" /> {celdas.length > 0 ? "Calor de lotes publicados, de bajo a alto" : ejemplo.activo ? "Calor de ejemplo, de bajo a alto" : "Sin capa de calor real"}
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

type MedidaReal = {
  registros: number;
  indice: number | null;
  tendencia: number | null;
};

type MuestraEjemplo = {
  socios: number;
  indice: number;
  crecimiento: number;
  nivel: "Muy alta" | "Alta" | "Media";
};

function medidasReales(resumen: ResumenReal | null) {
  const medidas = new Map<string, MedidaReal>();
  for (const provincia of resumen?.provincias ?? []) {
    medidas.set(provincia.codigo, {
      registros: provincia.registros,
      indice: provincia.indice ?? null,
      tendencia: provincia.tendencia ?? null,
    });
  }
  for (const fila of resumen?.ranking ?? []) {
    medidas.set(fila.codigo, {
      registros: fila.registros,
      indice: fila.indice,
      tendencia: fila.tendencia,
    });
  }
  return medidas;
}

function medidaPublicada(medidas: Map<string, MedidaReal>, codigo: string) {
  const medida = medidas.get(codigo);
  if (!medida || medida.registros <= 0) {
    return null;
  }
  return medida;
}

function textoReal(medida: MedidaReal) {
  const indice = medida.indice === null ? "sin índice" : `índice ${medida.indice}`;
  const tendencia =
    medida.tendencia === null ? "sin tendencia" : `tendencia ${medida.tendencia > 0 ? "+" : ""}${medida.tendencia}`;
  return `${medida.registros.toLocaleString("es-EC")} registros publicados · ${indice} · ${tendencia}`;
}

function textoEjemplo(muestra: MuestraEjemplo) {
  return `${muestra.socios.toLocaleString("es-EC")} potenciales socios de ejemplo · índice ${muestra.indice}`;
}

function centro(provincia: ProvinciaTerritorio) {
  return {
    lng: (provincia.bbox.oeste + provincia.bbox.este) / 2,
    lat: (provincia.bbox.sur + provincia.bbox.norte) / 2,
  };
}

function focoDesdeReal(provincia: ProvinciaTerritorio, medida: MedidaReal): FocoZona {
  const punto = centro(provincia);
  return {
    provinciaCodigo: provincia.codigo,
    provinciaNombre: provincia.nombre,
    zonaNombre: provincia.nombre,
    indice: medida.indice,
    socios: medida.registros,
    crecimiento: medida.tendencia,
    nivel: null,
    ejemplo: false,
    lng: punto.lng,
    lat: punto.lat,
  };
}

function focoSinRegistros(provincia: ProvinciaTerritorio): FocoZona {
  const punto = centro(provincia);
  return {
    provinciaCodigo: provincia.codigo,
    provinciaNombre: provincia.nombre,
    zonaNombre: provincia.nombre,
    indice: null,
    socios: null,
    crecimiento: null,
    nivel: null,
    ejemplo: false,
    lng: punto.lng,
    lat: punto.lat,
  };
}

function focoDesdeProvincia(provincia: ProvinciaTerritorio, muestra: MuestraEjemplo | null): FocoZona {
  const punto = centro(provincia);
  return {
    provinciaCodigo: provincia.codigo,
    provinciaNombre: provincia.nombre,
    zonaNombre: provincia.nombre,
    indice: muestra?.indice ?? null,
    socios: muestra?.socios ?? null,
    crecimiento: muestra?.crecimiento ?? null,
    nivel: muestra?.nivel ?? null,
    ejemplo: Boolean(muestra),
    lng: punto.lng,
    lat: punto.lat,
  };
}
