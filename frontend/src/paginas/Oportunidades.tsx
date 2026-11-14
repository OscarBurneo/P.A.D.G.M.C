import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { type ResumenReal } from "../cobertura";
import { Icono } from "../componentes/Icono";
import { CANTONES_EJEMPLO } from "../datos/ejemplo";
import { useEjemplo } from "../ejemplo";
import { type FocoZona, type NivelZona, useFoco } from "../foco";
import { formatoEntero } from "../formato";

type NivelFiltro = "Todas" | NivelZona;

type Fila = {
  id: string;
  nombre: string;
  detalle: string;
  provinciaCodigo: string;
  provinciaNombre: string;
  socios: number | null;
  indice: number | null;
  crecimiento: number | null;
  nivel: NivelZona | null;
  ejemplo: boolean;
  lng: number | null;
  lat: number | null;
};

const NIVELES: NivelFiltro[] = ["Todas", "Muy alta", "Alta", "Media"];

export function Oportunidades() {
  const ejemplo = useEjemplo();
  const { zona, fijar } = useFoco();
  const [params] = useSearchParams();
  const [resumen, setResumen] = useState<ResumenReal | null>(null);
  const [error, setError] = useState("");
  const [nivel, setNivel] = useState<NivelFiltro>("Todas");
  const consulta = (params.get("q") ?? "").trim().toLocaleLowerCase("es");

  useEffect(() => {
    void api<ResumenReal>("/api/mapas/resumen")
      .then(setResumen)
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo leer el resumen."));
  }, []);

  const filas = useMemo<Fila[]>(() => {
    if (ejemplo.activo) {
      return CANTONES_EJEMPLO.map((canton) => ({
        id: `${canton.codigoProvincia}:${canton.nombre}`,
        nombre: canton.nombre,
        detalle: canton.provincia,
        provinciaCodigo: canton.codigoProvincia,
        provinciaNombre: canton.provincia,
        socios: canton.socios,
        indice: canton.indice,
        crecimiento: canton.crecimiento,
        nivel: canton.nivel,
        ejemplo: true,
        lng: canton.lng,
        lat: canton.lat,
      })).sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0));
    }
    return (resumen?.provincias ?? []).map((provincia) => ({
      id: provincia.codigo,
      nombre: provincia.nombre,
      detalle: "Sin cantones con registros",
      provinciaCodigo: provincia.codigo,
      provinciaNombre: provincia.nombre,
      socios: null,
      indice: null,
      crecimiento: null,
      nivel: null,
      ejemplo: false,
      lng: null,
      lat: null,
    }));
  }, [ejemplo.activo, resumen]);

  const visibles = filas.filter((fila) => {
    if (nivel !== "Todas" && fila.nivel !== nivel) {
      return false;
    }
    if (!consulta) {
      return true;
    }
    return [fila.nombre, fila.detalle, fila.provinciaNombre].some((texto) => texto.toLocaleLowerCase("es").includes(consulta));
  });

  const seleccion = filas.find(
    (fila) => fila.provinciaCodigo === zona.provinciaCodigo && fila.nombre === (zona.zonaNombre ?? zona.provinciaNombre),
  );

  return (
    <div className="opportunity-layout">
      {error ? <p className="error span-completo">{error}</p> : null}
      <section className="panel ladder-panel">
        <div className="ladder-toolbar">
          <span>
            <Icono nombre="filtro" /> Nivel
          </span>
          {NIVELES.map((item) => (
            <button key={item} type="button" className={nivel === item ? "active" : ""} aria-pressed={nivel === item} onClick={() => setNivel(item)}>
              {item}
            </button>
          ))}
          {ejemplo.activo ? <em className="chip-ejemplo">Ejemplo</em> : null}
        </div>
        <div className="ladder">
          {visibles.map((fila, indice) => {
            const activa = fila.id === seleccion?.id;
            return (
              <button
                type="button"
                key={fila.id}
                className={`ladder-row ${activa ? "selected" : ""}`}
                aria-pressed={activa}
                onClick={() => fijar(focoDesdeFila(fila))}
              >
                <span className="ladder-rank">{String(indice + 1).padStart(2, "0")}</span>
                <span className="ladder-name">
                  <b>{fila.nombre}</b>
                  {fila.detalle}
                </span>
                <span className="ladder-score">
                  <span>
                    <i style={{ width: `${fila.indice ?? 0}%` }} />
                  </span>
                  <b>{fila.indice ?? "—"}</b>
                </span>
                <span className="ladder-metric">
                  <b>{fila.socios === null ? "—" : formatoEntero(fila.socios)}</b>
                  {fila.socios === null ? "sin registros" : "prospectos de ejemplo"}
                </span>
                <span className="growth">{fila.crecimiento === null ? "—" : `+${fila.crecimiento}%`}</span>
              </button>
            );
          })}
          {visibles.length === 0 ? (
            <div className="empty-state">
              <strong>{ejemplo.activo ? "No hay zonas con estos criterios" : "Sin oportunidades calculadas"}</strong>
              <span>
                {ejemplo.activo
                  ? "Pruebe otro nivel o limpie la búsqueda."
                  : "No hay registros de socios. El modelo predictivo tampoco está en producción."}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="dossier">
        <span className="eyebrow">Expediente de zona</span>
        {seleccion ? (
          <>
            <h2>{seleccion.nombre}</h2>
            {seleccion.ejemplo ? <em className="chip-ejemplo">Ejemplo</em> : null}
            {seleccion.indice !== null ? (
              <div className="dossier-score" style={{ ["--score" as string]: `${seleccion.indice * 3.6}deg` }}>
                <strong>{seleccion.indice}</strong>
                <span>índice</span>
              </div>
            ) : (
              <p className="dossier-vacio">Sin índice para esta provincia.</p>
            )}
            <dl>
              <div>
                <dt>Cantón</dt>
                <dd>{seleccion.ejemplo ? seleccion.detalle : "Sin registros"}</dd>
              </div>
              <div>
                <dt>Prospectos</dt>
                <dd>{seleccion.socios === null ? "—" : formatoEntero(seleccion.socios)}</dd>
              </div>
              <div>
                <dt>Crecimiento</dt>
                <dd>{seleccion.crecimiento === null ? "—" : `+${seleccion.crecimiento}%`}</dd>
              </div>
              <div>
                <dt>Nivel</dt>
                <dd>{seleccion.nivel ?? "Sin nivel"}</dd>
              </div>
            </dl>
            <p>Sin recomendación. No hay un modelo predictivo en producción.</p>
            <Link to={`/mapa?provincia=${encodeURIComponent(seleccion.provinciaCodigo)}`}>
              Ver en atlas <Icono nombre="flecha" />
            </Link>
          </>
        ) : (
          <>
            <h2>Sin expediente</h2>
            <p>Elija una fila. Si no hay registros, el expediente no inventa un índice.</p>
          </>
        )}
      </aside>
    </div>
  );
}

function focoDesdeFila(fila: Fila): FocoZona {
  return {
    provinciaCodigo: fila.provinciaCodigo,
    provinciaNombre: fila.provinciaNombre,
    zonaNombre: fila.nombre,
    indice: fila.indice,
    socios: fila.socios,
    crecimiento: fila.crecimiento,
    nivel: fila.nivel,
    ejemplo: fila.ejemplo,
    lng: fila.lng,
    lat: fila.lat,
  };
}
