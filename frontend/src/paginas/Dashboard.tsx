import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { cantonesDe, DesplegableFiltro, type DominiosFiltro } from "../componentes/DesplegableFiltro";
import {
  borradorDesdeParametros,
  consultaApi,
  escribirFiltros,
  hayFiltros,
  quitarCampo,
  type BorradorFiltros,
  type FiltroActivo,
} from "../filtros";
import { formatoEntero, formatoNumero } from "../formato";

type PuntoTendencia = {
  periodo: string;
  etiqueta: string;
  anio: number;
  registros: number;
  promedio_movil: number | null;
  anio_anterior: number;
};

type Barra = { nombre: string; registros: number };

type ResumenDashboard = {
  vacio: boolean;
  filtros_activos: FiltroActivo[];
  kpis: {
    total: number;
    mes: {
      periodo: string;
      etiqueta: string;
      frente_a: string;
      registros: number;
      anterior: number;
      variacion: number | null;
    } | null;
    provincia: { nombre: string; registros: number } | null;
    agencia: { nombre: string; registros: number } | null;
  };
  tendencia: PuntoTendencia[];
  provincias: Barra[];
  agencias: Barra[];
  eficiencia: {
    meses: { periodo: string; etiqueta: string }[];
    filas: { agencia: string; valores: number[] }[];
    maximo: number;
  };
  ranking: { agencia: string; total: number; porcentaje: number; variacion: number | null }[];
};

const ESCALA = ["#E8F4F9", "#D6E8F0", "#9FCFE5", "#5EA9D2", "#2F92C5", "#003B68"];

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const [dominios, setDominios] = useState<DominiosFiltro | null>(null);
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [error, setError] = useState("");
  const filtros = useMemo(() => borradorDesdeParametros(params), [params]);
  const consulta = useMemo(() => consultaApi({ ...filtros, zonas: [] }), [filtros]);

  useEffect(() => {
    void api<{ dominios: DominiosFiltro }>("/api/mapas/filtros")
      .then((respuesta) => setDominios(respuesta.dominios))
      .catch(() => setDominios(null));
  }, []);

  useEffect(() => {
    let vivo = true;
    void api<ResumenDashboard>(`/api/dashboard/resumen${consulta}`)
      .then((respuesta) => {
        if (vivo) {
          setResumen(respuesta);
          setError("");
        }
      })
      .catch((causa: unknown) => {
        if (!vivo) {
          return;
        }
        setResumen(null);
        setError(causa instanceof Error ? causa.message : "No se pudo leer el dashboard.");
      });
    return () => {
      vivo = false;
    };
  }, [consulta]);

  function aplicar(parcial: Partial<BorradorFiltros>) {
    setParams(escribirFiltros(params, { ...filtros, ...parcial }), { replace: true });
  }

  function fijarProvincia(nombre: string) {
    const siguiente = filtros.provincias.length === 1 && filtros.provincias[0] === nombre ? [] : [nombre];
    const permitidos = new Set(cantonesDe(dominios, siguiente));
    aplicar({
      provincias: siguiente,
      cantones: siguiente.length === 0 ? filtros.cantones : filtros.cantones.filter((canton) => permitidos.has(canton)),
    });
  }

  function fijarAgencia(nombre: string) {
    const siguiente = filtros.agencias.length === 1 && filtros.agencias[0] === nombre ? [] : [nombre];
    aplicar({ agencias: siguiente });
  }

  const fechas = dominios?.fecha ?? [];
  const fechasDesde = filtros.fechaHasta ? fechas.filter((fecha) => fecha <= filtros.fechaHasta) : fechas;
  const fechasHasta = filtros.fechaDesde ? fechas.filter((fecha) => fecha >= filtros.fechaDesde) : fechas;
  const cantones = cantonesDe(dominios, filtros.provincias);
  const anio = resumen?.tendencia.at(-1)?.anio;
  const maximoProvincia = Math.max(1, ...(resumen?.provincias.map((fila) => fila.registros) ?? [1]));
  const maximoAgencia = Math.max(1, ...(resumen?.agencias.map((fila) => fila.registros) ?? [1]));

  return (
    <div className="dashboard">
      {error ? <p className="error">{error}</p> : null}
      <section className="barra-filtros" aria-label="Filtros del dashboard">
        <DesplegableFiltro
          etiqueta="Provincia"
          multiple
          opciones={(dominios?.provincia ?? []).map((valor) => ({ valor, etiqueta: valor }))}
          seleccionados={filtros.provincias}
          onChange={(valores) => {
            const permitidos = new Set(cantonesDe(dominios, valores));
            aplicar({
              provincias: valores,
              cantones: valores.length === 0 ? filtros.cantones : filtros.cantones.filter((canton) => permitidos.has(canton)),
            });
          }}
        />
        <DesplegableFiltro
          etiqueta="Cantón"
          multiple
          opciones={cantones.map((valor) => ({ valor, etiqueta: valor }))}
          seleccionados={filtros.cantones}
          onChange={(valores) => aplicar({ cantones: valores })}
        />
        <DesplegableFiltro
          etiqueta="Agencia"
          multiple
          opciones={(dominios?.agencia ?? []).map((valor) => ({ valor, etiqueta: valor }))}
          seleccionados={filtros.agencias}
          onChange={(valores) => aplicar({ agencias: valores })}
        />
        <DesplegableFiltro
          etiqueta="Fecha desde"
          opciones={fechasDesde.map((valor) => ({ valor, etiqueta: valor }))}
          seleccionados={filtros.fechaDesde ? [filtros.fechaDesde] : []}
          onChange={(valores) => aplicar({ fechaDesde: valores[0] ?? "" })}
        />
        <DesplegableFiltro
          etiqueta="Fecha hasta"
          opciones={fechasHasta.map((valor) => ({ valor, etiqueta: valor }))}
          seleccionados={filtros.fechaHasta ? [filtros.fechaHasta] : []}
          onChange={(valores) => aplicar({ fechaHasta: valores[0] ?? "" })}
        />
      </section>
      {hayFiltros(filtros) ? (
        <ul className="filtros-activos" aria-label="Filtros activos">
          {(resumen?.filtros_activos ?? []).map((filtro) => (
            <li key={filtro.campo} className="chip-filtro">
              <span>
                {filtro.etiqueta}: {filtro.valores.join(", ")}
              </span>
              <button type="button" onClick={() => aplicar(quitarCampo(filtros, filtro.campo))}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!resumen ? <p className="estado">Cargando el dashboard…</p> : null}
      {resumen?.vacio ? <p className="aviso">No hay registros aceptados para esta selección.</p> : null}
      {resumen && !resumen.vacio ? (
        <>
          <section className="kpis" aria-label="Indicadores">
            <article>
              <span>Total de registros</span>
              <strong>{formatoEntero(resumen.kpis.total)}</strong>
              <p>Registros aceptados en la selección</p>
            </article>
            <article>
              <span>Registros del mes</span>
              <strong>
                {resumen.kpis.mes ? formatoEntero(resumen.kpis.mes.registros) : "—"}
                {resumen.kpis.mes ? <Variacion valor={resumen.kpis.mes.variacion} /> : null}
              </strong>
              <p>
                {resumen.kpis.mes
                  ? `${resumen.kpis.mes.etiqueta} · frente a ${resumen.kpis.mes.frente_a}`
                  : "Sin fechas para comparar"}
              </p>
            </article>
            <article>
              <span>Provincia con más registros</span>
              <strong>{resumen.kpis.provincia?.nombre ?? "—"}</strong>
              <p>
                {resumen.kpis.provincia
                  ? `${formatoEntero(resumen.kpis.provincia.registros)} registros en el periodo`
                  : "Sin provincia"}
              </p>
            </article>
            <article>
              <span>Agencia con más registros</span>
              <strong>{resumen.kpis.agencia?.nombre ?? "—"}</strong>
              <p>
                {resumen.kpis.agencia
                  ? `${formatoEntero(resumen.kpis.agencia.registros)} registros en el periodo`
                  : "Sin agencia"}
              </p>
            </article>
          </section>
          <p className="nota-interaccion">Al hacer clic en una barra se filtra todo el dashboard.</p>
          <section className="panel panel-dashboard">
            <div className="panel-title compact">
              <div>
                <span>Serie temporal</span>
                <h2>Tendencia con promedio móvil y comparación año contra año</h2>
              </div>
            </div>
            {resumen.tendencia.length === 0 ? (
              <p>No hay fechas para armar la serie.</p>
            ) : (
              <>
                <ul className="leyenda-serie" aria-label="Leyenda de la serie">
                  <li>
                    <i className="swatch actual" /> {anio}
                  </li>
                  <li>
                    <i className="swatch anterior" /> {anio ? anio - 1 : "Año anterior"}
                  </li>
                  <li>
                    <i className="swatch movil" /> Promedio móvil 3 meses
                  </li>
                </ul>
                <div className="grafico-linea">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={resumen.tendencia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#D6E8F0" vertical={false} />
                      <XAxis dataKey="etiqueta" tick={{ fill: "#668397", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#668397", fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                      <Tooltip />
                      <Line type="monotone" dataKey="anio_anterior" name="Año anterior" stroke="#5EA9D2" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="registros" name="Registros" stroke="#003B68" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line
                        type="monotone"
                        dataKey="promedio_movil"
                        name="Promedio móvil 3 meses"
                        stroke="#FFCB35"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </section>
          <div className="dos-paneles">
            <ListaBarras
              kicker="Territorio"
              titulo="Registros por provincia"
              filas={resumen.provincias}
              maximo={maximoProvincia}
              activo={filtros.provincias}
              onElegir={fijarProvincia}
            />
            <ListaBarras
              kicker="Red de agencias"
              titulo="Registros por agencia"
              filas={resumen.agencias}
              maximo={maximoAgencia}
              activo={filtros.agencias}
              onElegir={fijarAgencia}
            />
          </div>
          <section className="panel panel-dashboard">
            <div className="panel-title compact">
              <div>
                <span>Eficiencia histórica</span>
                <h2>Registros por agencia y por mes</h2>
              </div>
            </div>
            <p>Cada celda cuenta los registros aceptados. El color crece con la cantidad.</p>
            {resumen.eficiencia.filas.length === 0 ? (
              <p>No hay agencias para la matriz.</p>
            ) : (
              <div className="matriz-scroll">
                <table className="matriz">
                  <thead>
                    <tr>
                      <th />
                      {resumen.eficiencia.meses.map((mes) => (
                        <th key={mes.periodo}>{mes.etiqueta}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.eficiencia.filas.map((fila) => (
                      <tr key={fila.agencia}>
                        <th scope="row">{fila.agencia}</th>
                        {fila.valores.map((valor, indice) => (
                          <td key={`${fila.agencia}-${indice}`}>
                            <span
                              style={{
                                background: tono(valor, resumen.eficiencia.maximo),
                                color: valor / Math.max(resumen.eficiencia.maximo, 1) >= 0.6 ? "#fff" : "#003B68",
                              }}
                            >
                              {formatoEntero(valor)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="escala-matriz">
              Menos
              {ESCALA.map((color) => (
                <i key={color} style={{ background: color }} />
              ))}
              Más registros
            </p>
          </section>
          <section className="panel panel-dashboard">
            <div className="panel-title compact">
              <div>
                <span>Ranking</span>
                <h2>Participación de agencias</h2>
              </div>
            </div>
            {resumen.ranking.length === 0 ? (
              <p>No hay agencias en la selección.</p>
            ) : (
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Agencia</th>
                      <th>Registros</th>
                      <th>Variación</th>
                      <th>Participación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.ranking.map((fila, indice) => (
                      <tr key={fila.agencia}>
                        <td>{indice + 1}</td>
                        <td>{fila.agencia}</td>
                        <td>{formatoEntero(fila.total)}</td>
                        <td>
                          <Variacion valor={fila.variacion} />
                        </td>
                        <td>{formatoNumero(fila.porcentaje)} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function ListaBarras({
  kicker,
  titulo,
  filas,
  maximo,
  activo,
  onElegir,
}: {
  kicker: string;
  titulo: string;
  filas: Barra[];
  maximo: number;
  activo: string[];
  onElegir: (nombre: string) => void;
}) {
  return (
    <section className="panel panel-dashboard">
      <div className="panel-title compact">
        <div>
          <span>{kicker}</span>
          <h2>{titulo}</h2>
        </div>
      </div>
      {filas.length === 0 ? (
        <p>Sin registros para este corte.</p>
      ) : (
        <ul className="barras">
          {filas.map((fila) => (
            <li key={fila.nombre}>
              <button
                type="button"
                aria-pressed={activo.includes(fila.nombre)}
                aria-label={`${fila.nombre}, ${formatoEntero(fila.registros)} registros`}
                onClick={() => onElegir(fila.nombre)}
              >
                <span>{fila.nombre}</span>
                <i>
                  <b style={{ width: `${Math.max(4, (100 * fila.registros) / maximo)}%` }} />
                </i>
                <strong>{formatoEntero(fila.registros)}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Variacion({ valor }: { valor: number | null }) {
  if (valor === null) {
    return <em className="variacion">Sin base</em>;
  }
  const signo = valor > 0 ? "+" : "";
  return <em className={valor < 0 ? "variacion baja" : "variacion alta"}>{`${signo}${formatoNumero(valor)} %`}</em>;
}

function tono(valor: number, maximo: number) {
  if (valor <= 0 || maximo <= 0) {
    return ESCALA[0];
  }
  const indice = Math.min(ESCALA.length - 1, Math.ceil((valor / maximo) * (ESCALA.length - 1)));
  return ESCALA[indice];
}
