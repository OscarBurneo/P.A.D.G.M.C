import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { type ResumenReal } from "../cobertura";
import { Icono } from "../componentes/Icono";
import {
  CALIDAD_EJEMPLO,
  CANTONES_EJEMPLO,
  type CantonEjemplo,
  indiceMedioEjemplo,
  sociosEjemplo,
  zonasAltas,
} from "../datos/ejemplo";
import { useEjemplo } from "../ejemplo";
import { type FocoZona, useFoco } from "../foco";
import { formatoEntero, formatoNumero } from "../formato";
import { puede, useSesion } from "../sesion";

const COLUMNAS = 9;
const FILAS = 6;

export function Inicio() {
  const { cuenta } = useSesion();
  const ejemplo = useEjemplo();
  const { zona, fijar } = useFoco();
  const [resumen, setResumen] = useState<ResumenReal | null>(null);
  const [error, setError] = useState("");
  const puedeMapa = puede(cuenta, "mapas.ver");

  useEffect(() => {
    if (!puedeMapa) {
      return;
    }
    void api<ResumenReal>("/api/mapas/resumen")
      .then(setResumen)
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo leer el resumen."));
  }, [puedeMapa]);

  const celdas = useMemo(() => (ejemplo.activo ? mallaEjemplo() : []), [ejemplo.activo]);
  const ruta = useMemo(
    () => [...CANTONES_EJEMPLO].sort((a, b) => b.indice - a.indice).slice(0, 3),
    [],
  );
  const mayor = useMemo(
    () => [...CANTONES_EJEMPLO].sort((a, b) => b.crecimiento - a.crecimiento)[0],
    [],
  );

  const indice = ejemplo.activo ? indiceMedioEjemplo() : null;
  const socios = ejemplo.activo ? sociosEjemplo() : resumen?.total_registros;
  const zonas = ejemplo.activo ? CANTONES_EJEMPLO.length : resumen?.zonas_analizadas;
  const calidad = ejemplo.activo ? CALIDAD_EJEMPLO : (resumen?.calidad_registros ?? null);

  return (
    <div className="summary-layout">
      {error ? <p className="error span-completo">{error}</p> : null}
      <article className="pulse-panel">
        <span className="eyebrow">Índice de expansión</span>
        {ejemplo.activo ? <em className="chip-ejemplo">Ejemplo</em> : null}
        <div className={`pulse-score ${indice === null ? "vacio" : ""}`}>
          {indice === null ? "Sin índice" : indice}
          {indice !== null ? <small>/100</small> : null}
        </div>
        <p>
          {ejemplo.activo
            ? "Promedio ilustrativo de los cantones de la vista de ejemplo, sobre la cobertura nacional. No es una medición de la cooperativa."
            : (resumen?.nota ?? "Sin registros de socios para calcular el índice de expansión.")}
        </p>
        <div className="pulse-strip">
          <span>
            <b>{socios === undefined ? "—" : formatoEntero(socios)}</b>
            potenciales socios
          </span>
          <span>
            <b>{zonas === undefined ? "—" : formatoEntero(zonas)}</b>
            zonas analizadas
          </span>
          <span>
            <b>{calidad === null ? "—" : `${formatoNumero(calidad)} %`}</b>
            datos válidos
          </span>
        </div>
        {puedeMapa ? (
          <Link className="pulse-action" to="/oportunidades">
            Priorizar zonas <Icono nombre="flecha" />
          </Link>
        ) : (
          <p className="foco-vacio">Su rol no incluye la priorización.</p>
        )}
      </article>

      <article className="panel hex-panel">
        <div className="panel-title">
          <div>
            <span>Malla de densidad</span>
            <h2>Concentración por celda territorial</h2>
          </div>
          {puedeMapa ? (
            <Link to="/mapa">
              Abrir atlas <Icono nombre="flecha" />
            </Link>
          ) : null}
        </div>
        {ejemplo.activo ? (
          <>
            <p className="nota-inline">
              <em className="chip-ejemplo">Ejemplo</em> Celdas ilustrativas a partir de los cantones de demostración. No hay una malla H3 con registros.
            </p>
            <div className="hex-field" role="group" aria-label="Celdas de densidad de ejemplo">
              {celdas.map((fila, indiceFila) => (
                <div className="hex-row" key={indiceFila}>
                  {fila.map((celda) => (
                    <button
                      key={celda.id}
                      type="button"
                      className={`hex ${celda.level} ${zona.ejemplo && zona.zonaNombre === celda.canton.nombre ? "is-selected" : ""}`}
                      aria-pressed={zona.ejemplo && zona.zonaNombre === celda.canton.nombre}
                      aria-label={`${celda.canton.nombre}, densidad ilustrativa ${Math.round(celda.valor * 100)} por ciento`}
                      onClick={() => fijar(focoDesdeCanton(celda.canton))}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="density-key">
              <span>Menor</span>
              <i />
              <span>Mayor concentración</span>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>Sin registros para la malla</strong>
            <span>El servicio de mapas no trae celdas. La concentración aparecerá cuando existan socios importados.</span>
          </div>
        )}
      </article>

      <article className="panel signal-panel">
        <div className="panel-title compact">
          <div>
            <span>Señales</span>
            <h2>Cambios detectados</h2>
          </div>
          <Icono nombre="actividad" />
        </div>
        {ejemplo.activo && mayor ? (
          <>
            <p className="nota-inline">
              <em className="chip-ejemplo">Ejemplo</em>
            </p>
            <div className="signal">
              <b>+{mayor.crecimiento}%</b>
              <p>{mayor.nombre} tiene el mayor crecimiento de la vista de ejemplo.</p>
            </div>
            <div className="signal">
              <b>{zonasAltas()}</b>
              <p>Zonas de nivel alto o muy alto en la vista de ejemplo.</p>
            </div>
            <div className="signal">
              <b>—</b>
              <p>No hay un conteo de geocodificación manual: no existen lotes.</p>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>Sin señales</strong>
            <span>No hay registros para detectar cambios de concentración.</span>
          </div>
        )}
      </article>

      <article className="panel corridor-panel">
        <div className="panel-title compact">
          <div>
            <span>Corredor sugerido</span>
            <h2>Ruta comercial prioritaria</h2>
          </div>
          <Icono nombre="radar" />
        </div>
        {ejemplo.activo && ruta.length === 3 ? (
          <>
            <p className="nota-inline">
              <em className="chip-ejemplo">Ejemplo</em> Esquema entre los tres cantones de mayor índice ilustrativo. No es una ruta calculada.
            </p>
            <svg viewBox="0 0 320 150" role="img" aria-label={`Corredor de ejemplo entre ${ruta.map((item) => item.nombre).join(", ")}`}>
              <path className="corridor-shadow" d="M30 112 C78 88, 93 70, 154 72 S236 35, 286 34" />
              <path className="corridor-line" d="M30 112 C78 88, 93 70, 154 72 S236 35, 286 34" />
              <circle cx="30" cy="112" r="8" />
              <circle cx="154" cy="72" r="12" />
              <circle cx="286" cy="34" r="9" />
              <text x="18" y="139">{ruta[2]?.nombre}</text>
              <text x="124" y="104">{ruta[0]?.nombre}</text>
              <text x="214" y="20">{ruta[1]?.nombre}</text>
            </svg>
          </>
        ) : (
          <div className="empty-state">
            <strong>Sin corredor sugerido</strong>
            <span>No hay registros para trazar una ruta comercial.</span>
          </div>
        )}
      </article>
    </div>
  );
}

function focoDesdeCanton(canton: CantonEjemplo): FocoZona {
  return {
    provinciaCodigo: canton.codigoProvincia,
    provinciaNombre: canton.provincia,
    zonaNombre: canton.nombre,
    indice: canton.indice,
    socios: canton.socios,
    crecimiento: canton.crecimiento,
    nivel: canton.nivel,
    ejemplo: true,
    lng: canton.lng,
    lat: canton.lat,
  };
}

function mallaEjemplo() {
  return Array.from({ length: FILAS }, (_, fila) =>
    Array.from({ length: COLUMNAS }, (_, columna) => celdaEjemplo(columna, fila)),
  );
}

function celdaEjemplo(columna: number, fila: number) {
  const x = columna / (COLUMNAS - 1);
  const y = fila / (FILAS - 1);
  const lng = -81.2 + x * 6;
  const lat = 1.45 + y * -6.5;
  let valor = 0.05;
  let cercano = CANTONES_EJEMPLO[0];
  let mejor = Number.POSITIVE_INFINITY;
  for (const canton of CANTONES_EJEMPLO) {
    const dx = (lng - canton.lng) / 6;
    const dy = (lat - canton.lat) / 6.5;
    const distancia = dx * dx + dy * dy;
    valor += (canton.indice / 100) * Math.exp(-distancia / 0.01);
    if (distancia < mejor) {
      mejor = distancia;
      cercano = canton;
    }
  }
  const limitado = Math.min(1, valor);
  const level = limitado > 0.72 ? "h4" : limitado > 0.48 ? "h3" : limitado > 0.28 ? "h2" : "h1";
  return { id: `${fila}-${columna}`, level, valor: limitado, canton: cercano };
}
