import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { cargarTerritorio, type Caja, type Territorio } from "../cobertura";
import { CANTONES_EJEMPLO } from "../datos/ejemplo";

type Modo = "calor" | "puntos";

export type CapasMapa = {
  densidad: boolean;
  registros: boolean;
  agencias: boolean;
};

const VACIO: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const RELLENO_CON_AGENCIA = [
  "case",
  ["boolean", ["feature-state", "seleccion"], false],
  "#FFCB35",
  ["==", ["get", "con_agencia"], true],
  "#F4D56A",
  "#D5E4F0",
] as maplibregl.ExpressionSpecification;

const RELLENO_SIN_CAPA = [
  "case",
  ["boolean", ["feature-state", "seleccion"], false],
  "#FFCB35",
  "#D5E4F0",
] as maplibregl.ExpressionSpecification;

const LINEA_CON_AGENCIA = [
  "case",
  ["boolean", ["feature-state", "seleccion"], false],
  "#003B68",
  ["==", ["get", "con_agencia"], true],
  "#00538E",
  "#8FB0C6",
] as maplibregl.ExpressionSpecification;

const LINEA_SIN_CAPA = [
  "case",
  ["boolean", ["feature-state", "seleccion"], false],
  "#003B68",
  "#8FB0C6",
] as maplibregl.ExpressionSpecification;

export function MapaEcuador({
  compacto = false,
  modo = "calor",
  capas,
  ejemplo,
  provincia,
  onProvincia,
  mostrarAviso = true,
}: {
  compacto?: boolean;
  modo?: Modo;
  capas?: CapasMapa;
  ejemplo: boolean;
  provincia: string | null;
  onProvincia?: (codigo: string) => void;
  mostrarAviso?: boolean;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const recuadro = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<maplibregl.Map | null>(null);
  const listo = useRef(false);
  const encuadrePrevio = useRef("");
  const onProvinciaRef = useRef(onProvincia);
  const [territorio, setTerritorio] = useState<Territorio | null>(null);
  const [error, setError] = useState("");
  const densidad = capas ? capas.densidad : modo === "calor";
  const registros = capas ? capas.registros : modo === "puntos";
  const agencias = capas?.agencias ?? true;
  onProvinciaRef.current = onProvincia;

  useEffect(() => {
    void cargarTerritorio()
      .then(setTerritorio)
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo cargar el mapa."));
  }, []);

  useEffect(() => {
    if (!contenedor.current) {
      return;
    }
    const mapa = new maplibregl.Map({
      container: contenedor.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "fondo", type: "background", paint: { "background-color": "#e7f1f8" } }],
      },
      center: [-78.5, -1.7],
      zoom: 5,
      attributionControl: false,
      logoPosition: "top-right",
      fadeDuration: 0,
    });
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), "top-left");
    mapaRef.current = mapa;
    const observador = new ResizeObserver(() => mapa.resize());
    observador.observe(contenedor.current);
    mapa.on("load", () => {
      mapa.addSource("provincias", { type: "geojson", data: VACIO, promoteId: "codigo" });
      mapa.addLayer({
        id: "relleno",
        type: "fill",
        source: "provincias",
        paint: {
          "fill-color": RELLENO_CON_AGENCIA,
          "fill-opacity": 0.92,
        },
      });
      mapa.addLayer({
        id: "linea",
        type: "line",
        source: "provincias",
        paint: {
          "line-color": LINEA_CON_AGENCIA,
          "line-width": ["case", ["boolean", ["feature-state", "seleccion"], false], 2.4, 1.1],
        },
      });
      mapa.addSource("muestras", { type: "geojson", data: VACIO });
      mapa.addLayer({
        id: "calor",
        type: "heatmap",
        source: "muestras",
        paint: {
          "heatmap-weight": ["get", "peso"],
          "heatmap-intensity": 1.35,
          "heatmap-radius": compacto ? 46 : 54,
          "heatmap-opacity": 0.85,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(231,241,248,0)",
            0.2,
            "rgba(94,169,210,0.45)",
            0.45,
            "rgba(255,226,140,0.7)",
            0.72,
            "rgba(255,203,53,0.9)",
            1,
            "rgba(214,122,0,0.95)",
          ],
        },
      });
      mapa.moveLayer("calor", "linea");
      mapa.addLayer({
        id: "circulos",
        type: "circle",
        source: "muestras",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 6,
          "circle-color": "#FFCB35",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#003B68",
        },
      });
      mapa.on("click", "relleno", (evento) => {
        const codigo = evento.features?.[0]?.properties?.codigo;
        if (typeof codigo === "string") {
          onProvinciaRef.current?.(codigo);
        }
      });
      mapa.on("mouseenter", "relleno", () => {
        mapa.getCanvas().style.cursor = "pointer";
      });
      mapa.on("mouseleave", "relleno", () => {
        mapa.getCanvas().style.cursor = "";
      });
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
      mapa.on("mousemove", "relleno", (evento) => {
        const propiedades = evento.features?.[0]?.properties;
        if (!propiedades || !evento.lngLat) {
          return;
        }
        const nodo = document.createElement("div");
        const titulo = document.createElement("strong");
        titulo.textContent = String(propiedades.nombre ?? "");
        const detalle = document.createElement("div");
        detalle.textContent = propiedades.con_agencia ? "Con agencia" : "Sin agencia en la cobertura";
        nodo.append(titulo, detalle);
        popup.setLngLat(evento.lngLat).setDOMContent(nodo).addTo(mapa);
      });
      mapa.on("mouseleave", "relleno", () => popup.remove());
      listo.current = true;
      mapa.resize();
    });
    return () => {
      listo.current = false;
      observador.disconnect();
      mapa.remove();
      mapaRef.current = null;
    };
  }, [compacto]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !territorio) {
      return;
    }
    const aplicar = () => {
      const continental = territorio.provincias.filter((item) => !item.es_galapagos && item.contorno);
      const coleccion: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: continental.map((item) => ({
          type: "Feature",
          id: item.codigo,
          properties: {
            codigo: item.codigo,
            nombre: item.nombre,
            con_agencia: item.con_agencia,
          },
          geometry: item.contorno as GeoJSON.MultiPolygon,
        })),
      };
      (mapa.getSource("provincias") as maplibregl.GeoJSONSource | undefined)?.setData(coleccion);
      const muestras: GeoJSON.FeatureCollection = ejemplo
        ? {
            type: "FeatureCollection",
            features: CANTONES_EJEMPLO.map((canton) => ({
              type: "Feature",
              properties: {
                nombre: canton.nombre,
                peso: Math.min(1, canton.socios / 420),
              },
              geometry: { type: "Point", coordinates: [canton.lng, canton.lat] },
            })),
          }
        : VACIO;
      (mapa.getSource("muestras") as maplibregl.GeoJSONSource | undefined)?.setData(muestras);
      mapa.setLayoutProperty("calor", "visibility", ejemplo && densidad ? "visible" : "none");
      mapa.setLayoutProperty("circulos", "visibility", ejemplo && registros ? "visible" : "none");
      mapa.setPaintProperty("relleno", "fill-color", agencias ? RELLENO_CON_AGENCIA : RELLENO_SIN_CAPA);
      mapa.setPaintProperty("linea", "line-color", agencias ? LINEA_CON_AGENCIA : LINEA_SIN_CAPA);
      mapa.removeFeatureState({ source: "provincias" });
      if (provincia) {
        mapa.setFeatureState({ source: "provincias", id: provincia }, { seleccion: true });
      }
      const elegida = territorio.provincias.find((item) => item.codigo === provincia && !item.es_galapagos);
      const clave = elegida?.codigo ?? "continental";
      if (encuadrePrevio.current !== clave) {
        encuadrar(mapa, elegida ? elegida.bbox : territorio.encuadre_continental);
        encuadrePrevio.current = clave;
      }
    };
    const intentar = () => {
      if (!mapa.getSource("provincias") || !mapa.getSource("muestras")) {
        return;
      }
      aplicar();
    };
    if (mapa.getSource("provincias")) {
      intentar();
      return;
    }
    mapa.on("load", intentar);
    return () => {
      mapa.off("load", intentar);
    };
  }, [territorio, ejemplo, provincia, densidad, registros, agencias]);

  useEffect(() => {
    if (!recuadro.current || !territorio?.recuadro_galapagos) {
      return;
    }
    const caja = territorio.recuadro_galapagos;
    const mapa = new maplibregl.Map({
      container: recuadro.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "fondo", type: "background", paint: { "background-color": "#e7f1f8" } }],
      },
      attributionControl: false,
      interactive: false,
      fadeDuration: 0,
    });
    mapa.on("load", () => {
      const isla = territorio.provincias.find((item) => item.es_galapagos && item.contorno);
      const data: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: isla
          ? [
              {
                type: "Feature",
                properties: { nombre: isla.nombre },
                geometry: isla.contorno as GeoJSON.MultiPolygon,
              },
            ]
          : [],
      };
      mapa.addSource("galapagos", { type: "geojson", data });
      mapa.addLayer({
        id: "galapagos",
        type: "fill",
        source: "galapagos",
        paint: { "fill-color": "#D5E4F0", "fill-opacity": 1 },
      });
      mapa.addLayer({
        id: "galapagos-linea",
        type: "line",
        source: "galapagos",
        paint: { "line-color": "#00538E", "line-width": 1.2 },
      });
      encuadrar(mapa, caja);
    });
    return () => mapa.remove();
  }, [territorio]);

  return (
    <div className={`mapa-ecuador ${compacto ? "compacto" : ""}`}>
      <div ref={contenedor} className="lienzo" role="region" aria-label="Mapa del Ecuador continental" />
      {territorio?.recuadro_galapagos ? (
        <div className="recuadro-galapagos">
          <div ref={recuadro} className="lienzo-isla" role="img" aria-label="Recuadro de Galápagos" />
          <span>Galápagos</span>
        </div>
      ) : null}
      {ejemplo ? <p className="chip-ejemplo mapa-chip">Capa de ejemplo</p> : null}
      {mostrarAviso && !ejemplo ? (
        <p className="aviso-mapa">Sin registros para calcular concentración. Los límites provinciales sí están cargados.</p>
      ) : null}
      {error ? <p className="error mapa-error">{error}</p> : null}
    </div>
  );
}

function encuadrar(mapa: maplibregl.Map, caja: Caja) {
  mapa.fitBounds(
    [
      [caja.oeste, caja.sur],
      [caja.este, caja.norte],
    ],
    { padding: 24, animate: false, duration: 0 },
  );
}
