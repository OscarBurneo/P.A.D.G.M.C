import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

const CENTRO: [number, number] = [-79.20422, -3.99313];

export function Mapa() {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contenedor.current) {
      return;
    }
    const mapa = new maplibregl.Map({
      container: contenedor.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: CENTRO,
      zoom: 12,
    });
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    new maplibregl.Marker({ color: "#9a3412" }).setLngLat(CENTRO).addTo(mapa);
    return () => mapa.remove();
  }, []);

  return (
    <section className="panel mapa-panel">
      <header className="cabecera-mapa">
        <div>
          <p className="sobrelinea">Referencia visual</p>
          <h1>Loja</h1>
        </div>
        <p>
          Centro del mapa: latitud −3,99 y longitud −79,20. Es la ciudad, no un socio. El agregado
          del servidor no entrega coordenadas individuales.
        </p>
      </header>
      <div ref={contenedor} className="lienzo" role="region" aria-label="Mapa de Loja" />
      <div className="leyenda" aria-label="Leyenda del mapa">
        <p>
          <span className="muestra vacia" /> Sin registros para calcular concentración
        </p>
        <p>
          <span className="muestra baja" /> Concentración baja, prevista para un sprint posterior
        </p>
        <p>
          <span className="muestra alta" /> Concentración alta, prevista para un sprint posterior
        </p>
        <p className="nota">La leyenda usa texto además del color. Todavía no hay capa de calor.</p>
      </div>
    </section>
  );
}
