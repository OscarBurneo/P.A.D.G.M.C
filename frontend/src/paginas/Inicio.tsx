import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { type ResumenReal } from "../cobertura";
import { Icono } from "../componentes/Icono";
import {
  CALIDAD_EJEMPLO,
  CANTONES_EJEMPLO,
  indiceMedioEjemplo,
  rankingProvinciasEjemplo,
  sociosEjemplo,
  zonasAltas,
} from "../datos/ejemplo";
import { useEjemplo } from "../ejemplo";
import { formatoEntero, formatoNumero } from "../formato";
import { puede, useSesion } from "../sesion";

const TOP_RANKING = 5;

type Lote = {
  id?: string;
  nombre?: string;
  fuente?: string;
  validos?: number;
  invalidos?: number;
  actualizado_en?: string;
  estado?: string;
};

export function Inicio() {
  const { cuenta } = useSesion();
  const ejemplo = useEjemplo();
  const [params] = useSearchParams();
  const [resumen, setResumen] = useState<ResumenReal | null>(null);
  const [error, setError] = useState("");
  const [lotes, setLotes] = useState<Lote[] | null>(null);
  const [notaLotes, setNotaLotes] = useState("");
  const [errorLotes, setErrorLotes] = useState("");
  const puedeMapa = puede(cuenta, "mapas.ver");
  const puedeLotes = puede(cuenta, "importaciones.cargar");
  const consulta = (params.get("q") ?? "").trim().toLocaleLowerCase("es");

  useEffect(() => {
    if (!puedeMapa) {
      return;
    }
    void api<ResumenReal>("/api/mapas/resumen")
      .then(setResumen)
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo leer el resumen."));
  }, [puedeMapa]);

  useEffect(() => {
    if (!puedeLotes) {
      return;
    }
    void api<{ lotes: Lote[]; nota: string }>("/api/importaciones")
      .then((respuesta) => {
        setLotes(respuesta.lotes);
        setNotaLotes(respuesta.nota);
      })
      .catch((causa: unknown) => setErrorLotes(causa instanceof Error ? causa.message : "No se pudo leer los lotes."));
  }, [puedeLotes]);

  const ranking = useMemo(() => {
    if (!ejemplo.activo) {
      return [];
    }
    return rankingProvinciasEjemplo()
      .filter((fila) => !consulta || fila.nombre.toLocaleLowerCase("es").includes(consulta))
      .slice(0, TOP_RANKING);
  }, [consulta, ejemplo.activo]);
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

      <article className="panel ranking-panel">
        <div className="panel-title">
          <div>
            <span>Ranking</span>
            <h2>Provincias con mayor oportunidad</h2>
          </div>
          {ejemplo.activo ? <em className="chip-ejemplo">Ejemplo</em> : null}
        </div>
        {ejemplo.activo ? (
          ranking.length > 0 ? (
            <ol className="ranking-lista">
              {ranking.map((fila, posicion) => (
                <li key={fila.codigo}>
                  {puedeMapa ? (
                    <Link className="ranking-fila" to={`/mapa?provincia=${encodeURIComponent(fila.codigo)}`}>
                      <FilaRanking posicion={posicion} nombre={fila.nombre} indice={fila.indice} crecimiento={fila.crecimiento} socios={fila.socios} />
                    </Link>
                  ) : (
                    <div className="ranking-fila">
                      <FilaRanking posicion={posicion} nombre={fila.nombre} indice={fila.indice} crecimiento={fila.crecimiento} socios={fila.socios} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-state">
              <strong>Ninguna provincia coincide</strong>
              <span>Pruebe otro texto en el buscador.</span>
            </div>
          )
        ) : (
          <div className="empty-state">
            <strong>Sin ranking de oportunidad</strong>
            <span>
              {resumen
                ? `${resumen.provincias.length} provincias con agencia y ${formatoEntero(resumen.total_registros)} registros. El resumen no trae índice ni tendencia.`
                : "El resumen no trae índice ni tendencia por provincia."}
            </span>
          </div>
        )}
      </article>
      <EstadoDatos
        ejemplo={ejemplo.activo}
        puedeLotes={puedeLotes}
        lotes={lotes}
        nota={notaLotes}
        error={errorLotes}
      />

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

function FilaRanking({
  posicion,
  nombre,
  indice,
  crecimiento,
  socios,
}: {
  posicion: number;
  nombre: string;
  indice: number;
  crecimiento: number;
  socios: number;
}) {
  const tendencia = `${crecimiento > 0 ? "+" : ""}${crecimiento} %`;
  return (
    <>
      <span className="ranking-puesto">{String(posicion + 1).padStart(2, "0")}</span>
      <span>
        <b>{nombre}</b>
        <small>{formatoEntero(socios)} ilustrativos</small>
      </span>
      <span className="ranking-valor">
        {indice}
        <span>{tendencia}</span>
      </span>
    </>
  );
}

function EstadoDatos({
  ejemplo,
  puedeLotes,
  lotes,
  nota,
  error,
}: {
  ejemplo: boolean;
  puedeLotes: boolean;
  lotes: Lote[] | null;
  nota: string;
  error: string;
}) {
  const lote = lotes?.[0];
  const hayLote = Boolean(lote);
  const mostrarEjemplo = ejemplo && !hayLote;

  return (
    <article className="panel estado-datos">
      <div className="panel-title">
        <div>
          <span>Estado de los datos</span>
          <h2>Último lote</h2>
        </div>
        {mostrarEjemplo ? <em className="chip-ejemplo">Ejemplo</em> : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {mostrarEjemplo ? (
        <dl>
          <div>
            <dt>Lote</dt>
            <dd>Vista de ejemplo</dd>
          </div>
          <div>
            <dt>Fuente</dt>
            <dd>Cantones ilustrativos, no un archivo</dd>
          </div>
          <div>
            <dt>Válidos</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Inválidos</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Actualización</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>No es un lote</dd>
          </div>
        </dl>
      ) : hayLote && lote ? (
        <dl>
          <div>
            <dt>Lote</dt>
            <dd>{lote.nombre ?? "Sin nombre"}</dd>
          </div>
          <div>
            <dt>Fuente</dt>
            <dd>{lote.fuente ?? "—"}</dd>
          </div>
          <div>
            <dt>Válidos</dt>
            <dd>{lote.validos === undefined ? "—" : formatoEntero(lote.validos)}</dd>
          </div>
          <div>
            <dt>Inválidos</dt>
            <dd>{lote.invalidos === undefined ? "—" : formatoEntero(lote.invalidos)}</dd>
          </div>
          <div>
            <dt>Actualización</dt>
            <dd>{lote.actualizado_en ? new Date(lote.actualizado_en).toLocaleString("es-EC") : "—"}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{lote.estado ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <div className="empty-state">
          <strong>Sin lote cargado</strong>
          <span>
            {!puedeLotes
              ? "Su rol no consulta las importaciones."
              : nota || "No hay lotes. La API no entrega nombre, válidos, inválidos, fecha ni estado."}
          </span>
        </div>
      )}
      <p className="nota-capa">
        {mostrarEjemplo
          ? `${formatoEntero(sociosEjemplo())} registros ilustrativos en ${CANTONES_EJEMPLO.length} cantones. No hay conteo de válidos, inválidos ni fecha de carga.`
          : "Pendiente: un lote con nombre, fuente, válidos, inválidos, fecha y estado. Hoy /api/importaciones solo devuelve la lista vacía."}
      </p>
    </article>
  );
}
