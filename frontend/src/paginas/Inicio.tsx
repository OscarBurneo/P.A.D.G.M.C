import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { cargarTerritorio, type ResumenReal, type Territorio } from "../cobertura";
import { Dona } from "../componentes/Dona";
import { Icono } from "../componentes/Icono";
import { Sparkline } from "../componentes/Sparkline";
import { TablaZonas, type FilaZona } from "../componentes/TablaZonas";
import {
  CALIDAD_EJEMPLO,
  CANTONES_EJEMPLO,
  COLORES_SERIE,
  SERIES_EJEMPLO,
  sociosEjemplo,
  zonasAltas,
} from "../datos/ejemplo";
import { useEjemplo } from "../ejemplo";
import { formatoEntero, formatoNumero } from "../formato";
import { puede, useSesion } from "../sesion";

const MapaEcuador = lazy(() => import("../componentes/MapaEcuador").then((modulo) => ({ default: modulo.MapaEcuador })));

type Modo = "calor" | "puntos";
type Corte = "provincia" | "canton";

export function Inicio() {
  const { cuenta } = useSesion();
  const ejemplo = useEjemplo();
  const [params] = useSearchParams();
  const [modo, setModo] = useState<Modo>("calor");
  const [corte, setCorte] = useState<Corte>("provincia");
  const [resumen, setResumen] = useState<ResumenReal | null>(null);
  const [territorio, setTerritorio] = useState<Territorio | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const consulta = (params.get("q") ?? "").trim().toLocaleLowerCase("es");
  const puedeImportar = puede(cuenta, "importaciones.cargar");
  const puedeMapa = puede(cuenta, "mapas.ver");

  useEffect(() => {
    if (!puedeMapa) {
      return;
    }
    void api<ResumenReal>("/api/mapas/resumen")
      .then(setResumen)
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo leer el resumen."));
    void cargarTerritorio().then(setTerritorio).catch(() => undefined);
  }, [puedeMapa]);

  const filas = useMemo(() => filasVisibles(ejemplo.activo, resumen, consulta), [ejemplo.activo, resumen, consulta]);
  const partes = useMemo(() => partesDona(ejemplo.activo, resumen, corte), [ejemplo.activo, resumen, corte]);
  const provinciaMapa =
    consulta && territorio
      ? (territorio.provincias.find(
          (item) => !item.es_galapagos && item.nombre.toLocaleLowerCase("es").includes(consulta),
        )?.codigo ?? null)
      : null;

  return (
    <section className="tablero">
      <header className="encabezado-pagina">
        <div>
          <p className="sobrelinea">Inteligencia territorial</p>
          <h1>Resumen geoespacial</h1>
          <p className="lead">
            Monitoree la concentración de potenciales socios en las provincias con agencia e identifique zonas de oportunidad.
          </p>
        </div>
        <div className="acciones-pagina">
          <label>
            Periodo
            <select defaultValue="30" aria-describedby="nota-periodo">
              <option value="30">Últimos 30 días</option>
              <option value="90" disabled>
                Últimos 90 días (requiere registros)
              </option>
            </select>
          </label>
          <p id="nota-periodo" className="sr">
            El periodo no cambia cifras reales porque todavía no hay cargas.
          </p>
          {puedeImportar ? (
            <Link className="boton" to="/importar">
              <Icono nombre="importar" /> Importar CSV
            </Link>
          ) : null}
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {!ejemplo.activo ? (
        <p className="nota">
          No hay registros de socios para calcular indicadores.
          <button type="button" className="secundario" onClick={() => ejemplo.cambiar(true)}>
            Mostrar datos de ejemplo
          </button>
        </p>
      ) : null}
      <div className="kpis">
        <Kpi
          icono="personas"
          titulo="Potenciales socios"
          valor={ejemplo.activo ? formatoEntero(sociosEjemplo()) : "0"}
          detalle={ejemplo.activo ? "+12,4 % vs. periodo anterior" : "Sin registros importados"}
          serie={ejemplo.activo ? SERIES_EJEMPLO.socios : [0, 0, 0, 0]}
          color="#2F92C5"
          ejemplo={ejemplo.activo}
        />
        <Kpi
          icono="pin"
          titulo="Zonas analizadas"
          valor={ejemplo.activo ? formatoEntero(CANTONES_EJEMPLO.length) : "0"}
          detalle={ejemplo.activo ? "Cantones de la vista de ejemplo" : "Sin zonas con registros"}
          serie={ejemplo.activo ? SERIES_EJEMPLO.zonas : [0, 0, 0, 0]}
          color="#5EA9D2"
          ejemplo={ejemplo.activo}
        />
        <Kpi
          icono="diana"
          titulo="Alta oportunidad"
          valor={ejemplo.activo ? formatoEntero(zonasAltas()) : "0"}
          detalle={ejemplo.activo ? "Nivel alto o muy alto, de ejemplo" : "Sin índice calculado"}
          serie={ejemplo.activo ? SERIES_EJEMPLO.alta : [0, 0, 0, 0]}
          color="#0067AF"
          ejemplo={ejemplo.activo}
        />
        <Kpi
          icono="calidad"
          titulo="Calidad de datos"
          valor={ejemplo.activo ? `${formatoNumero(CALIDAD_EJEMPLO)} %` : "—"}
          detalle={ejemplo.activo ? "Porcentaje ilustrativo de registros válidos" : "Sin registros válidos"}
          serie={ejemplo.activo ? SERIES_EJEMPLO.calidad : [0, 0, 0, 0]}
          color="#0A6B40"
          ejemplo={ejemplo.activo}
        />
      </div>
      <div className="panel-medio">
        <article className="tarjeta">
          <header className="tarjeta-cabecera">
            <div>
              <p className="etiqueta">Distribución geográfica</p>
              <h2>Concentración de potenciales socios</h2>
            </div>
            <div className="segmento" role="group" aria-label="Tipo de capa">
              <button type="button" aria-pressed={modo === "calor"} onClick={() => setModo("calor")}>
                Calor
              </button>
              <button type="button" aria-pressed={modo === "puntos"} onClick={() => setModo("puntos")}>
                Puntos
              </button>
            </div>
          </header>
          {puedeMapa ? (
            <Suspense fallback={<p className="estado">Cargando el mapa del Ecuador…</p>}>
              <MapaEcuador
                compacto
                modo={modo}
                ejemplo={ejemplo.activo}
                provincia={provinciaMapa}
                onProvincia={(codigo) => navigate(`/mapa?provincia=${encodeURIComponent(codigo)}`)}
              />
            </Suspense>
          ) : (
            <p className="nota">Su rol no incluye el mapa agregado.</p>
          )}
          <footer className="tarjeta-pie">
            <span>{ejemplo.activo ? "Capa ilustrativa sobre límites reales" : "Límites provinciales, sin capa de calor"}</span>
            {puedeMapa ? <Link to="/mapa">Explorar mapa completo</Link> : null}
          </footer>
        </article>
        <article className="tarjeta">
          <header className="tarjeta-cabecera">
            <div>
              <p className="etiqueta">Composición</p>
              <h2>{corte === "provincia" ? "Distribución por provincia" : "Distribución por cantón"}</h2>
            </div>
            <div className="segmento" role="group" aria-label="Agrupación de la dona">
              <button type="button" aria-pressed={corte === "provincia"} onClick={() => setCorte("provincia")}>
                Provincia
              </button>
              <button type="button" aria-pressed={corte === "canton"} onClick={() => setCorte("canton")}>
                Cantón
              </button>
            </div>
          </header>
          <Dona
            partes={partes}
            tituloTotal={corte === "provincia" ? "Distribución de ejemplo por provincia" : "Distribución de ejemplo por cantón"}
            vacio={resumen?.nota ?? "Sin registros para distribuir."}
          />
          <footer className="tarjeta-pie">
            <span>{ejemplo.activo ? "Porcentajes de la vista de ejemplo" : "La cobertura real sigue en cero"}</span>
            <Link to="/oportunidades">Ver reporte detallado</Link>
          </footer>
        </article>
      </div>
      <article className="tarjeta">
        <header className="tarjeta-cabecera">
          <div>
            <p className="etiqueta">Priorización comercial</p>
            <h2>Zonas con mayor oportunidad</h2>
          </div>
          <Link to="/oportunidades">Ver todas</Link>
        </header>
        <TablaZonas filas={filas} />
      </article>
    </section>
  );
}

function Kpi({
  icono,
  titulo,
  valor,
  detalle,
  serie,
  color,
  ejemplo,
}: {
  icono: "personas" | "pin" | "diana" | "calidad";
  titulo: string;
  valor: string;
  detalle: string;
  serie: number[];
  color: string;
  ejemplo: boolean;
}) {
  return (
    <article className="kpi">
      <div className="kpi-titulo">
        <span className="kpi-icono">
          <Icono nombre={icono} />
        </span>
        <h2>{titulo}</h2>
        {ejemplo ? <span className="chip-ejemplo">Ejemplo</span> : null}
      </div>
      <Sparkline valores={serie} color={color} />
      <p className="valor">{valor}</p>
      <p className="detalle">{detalle}</p>
    </article>
  );
}

function filasVisibles(ejemplo: boolean, resumen: ResumenReal | null, consulta: string): FilaZona[] {
  if (ejemplo) {
    return CANTONES_EJEMPLO.filter((canton) => coincide(consulta, canton.provincia, canton.nombre, canton.nivel))
      .slice()
      .sort((a, b) => b.indice - a.indice)
      .map((canton) => ({
        codigo: canton.codigoProvincia,
        provincia: canton.provincia,
        canton: canton.nombre,
        socios: canton.socios,
        indice: canton.indice,
        crecimiento: canton.crecimiento,
        nivel: canton.nivel,
      }));
  }
  return (resumen?.provincias ?? [])
    .filter((provincia) => coincide(consulta, provincia.nombre))
    .map((provincia) => ({
      codigo: provincia.codigo,
      provincia: provincia.nombre,
      canton: "Sin cantones con registros",
      socios: null,
      indice: null,
      crecimiento: null,
      nivel: null,
    }));
}

function partesDona(ejemplo: boolean, resumen: ResumenReal | null, corte: Corte) {
  if (!ejemplo) {
    return (resumen?.provincias ?? []).map((provincia, indice) => ({
      nombre: provincia.nombre,
      valor: 0,
      color: COLORES_SERIE[indice % COLORES_SERIE.length],
    }));
  }
  if (corte === "canton") {
    return CANTONES_EJEMPLO.map((canton, indice) => ({
      nombre: canton.nombre,
      valor: canton.socios,
      color: COLORES_SERIE[indice % COLORES_SERIE.length],
    }));
  }
  const acumulado = new Map<string, number>();
  for (const canton of CANTONES_EJEMPLO) {
    acumulado.set(canton.provincia, (acumulado.get(canton.provincia) ?? 0) + canton.socios);
  }
  return [...acumulado.entries()].map(([nombre, valor], indice) => ({
    nombre,
    valor,
    color: COLORES_SERIE[indice % COLORES_SERIE.length],
  }));
}

function coincide(consulta: string, ...textos: string[]) {
  if (!consulta) {
    return true;
  }
  return textos.some((texto) => texto.toLocaleLowerCase("es").includes(consulta));
}

