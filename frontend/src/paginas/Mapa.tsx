import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import {
  cargarTerritorio,
  type MetricaSeleccion,
  type ProvinciaTerritorio,
  type ResumenReal,
  type Territorio,
} from "../cobertura";
import { cantonesDe, DesplegableFiltro } from "../componentes/DesplegableFiltro";
import { Icono } from "../componentes/Icono";
import { SelectorFecha } from "../componentes/SelectorFecha";
import { LeyendaCalor, type LeyendaCalorDatos } from "../componentes/LeyendaCalor";
import { MapaEcuador, type CapasMapa, type PuntoRegistro } from "../componentes/MapaEcuador";
import { resumenProvinciaEjemplo } from "../datos/ejemplo";
import { useEjemplo } from "../ejemplo";
import {
  OPERADORES,
  borradorDesdeParametros,
  consultaApi,
  escribirFiltros,
  hayFiltros,
  quitarCampo,
  restablecerParametros,
  type BorradorFiltros,
} from "../filtros";
import { textoDensidadKm2, textoSinZona } from "../formato";
import { type FocoZona, useFoco } from "../foco";

type ParProvinciaCanton = { provincia: string; canton: string };

type CatalogoFiltros = {
  propuesto: boolean;
  nota: string;
  version: string;
  dominios: {
    provincia: string[];
    canton: string[];
    canton_por_provincia?: ParProvinciaCanton[];
    agencia: string[];
    fecha?: string[];
    zona?: { codigo: string; nombre: string; con_agencia?: boolean }[];
  };
};

type Calor = {
  celdas: { longitud: number; latitud: number; peso: number }[];
  total_registros: number;
  version_datos: string;
  leyenda: LeyendaCalorDatos;
  seleccion_vacia?: boolean;
};

type RespuestaPuntos = {
  puntos?: PuntoRegistro[];
  version_datos?: string;
  truncado?: boolean;
};

export function Mapa() {
  const ejemplo = useEjemplo();
  const { zona, fijar: fijarFoco, limpiar } = useFoco();
  const [params, setParams] = useSearchParams();
  const [territorio, setTerritorio] = useState<Territorio | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoFiltros | null>(null);
  const [celdas, setCeldas] = useState<{ longitud: number; latitud: number; peso: number }[]>([]);
  const [puntos, setPuntos] = useState<PuntoRegistro[]>([]);
  const [puntosTruncados, setPuntosTruncados] = useState(false);
  const [leyenda, setLeyenda] = useState<LeyendaCalorDatos | null>(null);
  const [resumen, setResumen] = useState<ResumenReal | null>(null);
  const [datosListos, setDatosListos] = useState(false);
  const [vigenteVista, setVigenteVista] = useState(false);
  const [error, setError] = useState("");
  const [errorDatos, setErrorDatos] = useState("");
  const [densidad, setDensidad] = useState(true);
  const [registros, setRegistros] = useState(true);
  const [agencias, setAgencias] = useState(true);
  const claveParametros = params.toString();
  const filtros = useMemo(() => borradorDesdeParametros(params), [claveParametros, params]);
  const consultaDatos = useMemo(() => consultaApi(filtros), [filtros]);
  const foco = filtros.zonas.length === 1 ? filtros.zonas[0] : null;
  const busqueda = (params.get("q") ?? "").trim().toLocaleLowerCase("es");

  useEffect(() => {
    void cargarTerritorio()
      .then(setTerritorio)
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No se pudo cargar la cobertura."));
    void api<CatalogoFiltros>("/api/mapas/filtros")
      .then(setCatalogo)
      .catch(() => setCatalogo(null));
  }, []);

  useEffect(() => {
    let vivo = true;
    setDatosListos(false);
    setVigenteVista(false);
    setErrorDatos("");
    setCeldas([]);
    setPuntos([]);
    setPuntosTruncados(false);
    setLeyenda(null);
    setResumen(null);
    void Promise.all([
      api<Calor>(`/api/mapas/calor${consultaDatos}`),
      api<ResumenReal>(`/api/mapas/resumen${consultaDatos}`),
      api<RespuestaPuntos>(`/api/mapas/puntos${consultaDatos}`),
    ])
      .then(([calor, territorial, individuales]) => {
        if (!vivo) {
          return;
        }
        const versiones = [calor.version_datos, territorial.version_datos, individuales.version_datos].filter(Boolean);
        if (new Set(versiones).size > 1) {
          throw new Error("El calor y los indicadores no comparten la versión de datos.");
        }
        setCeldas(calor.celdas);
        setPuntos(individuales.puntos ?? []);
        setPuntosTruncados(Boolean(individuales.truncado));
        setLeyenda(calor.leyenda);
        setResumen(territorial);
        setVigenteVista(true);
        setDatosListos(true);
      })
      .catch((causa: unknown) => {
        if (!vivo) {
          return;
        }
        const mensaje = causa instanceof Error ? causa.message : "No se pudo actualizar la vista.";
        setCeldas([]);
        setPuntos([]);
        setPuntosTruncados(false);
        setLeyenda(null);
        setResumen(null);
        setVigenteVista(false);
        setDatosListos(true);
        setErrorDatos(`${mensaje} Los datos anteriores no se muestran como vigentes.`);
      });
    return () => {
      vivo = false;
    };
  }, [consultaDatos]);

  const capas = useMemo<CapasMapa>(
    () => ({ densidad, registros, agencias }),
    [densidad, registros, agencias],
  );

  function aplicar(parcial: Partial<BorradorFiltros>) {
    setParams(escribirFiltros(params, { ...filtros, ...parcial }), { replace: true });
  }

  function elegir(codigo: string | null) {
    if (!codigo) {
      limpiar();
    }
    aplicar({ zonas: codigo ? [codigo] : [] });
  }

  function quitar(campo: string) {
    setParams(escribirFiltros(params, quitarCampo(filtros, campo)), { replace: true });
  }

  const provincias = territorio?.provincias ?? [];
  const conAgencia = provincias.filter((item) => item.con_agencia);
  const zonasOpciones = useMemo(() => {
    const delCatalogo = catalogo?.dominios.zona ?? [];
    if (delCatalogo.length > 0) {
      return delCatalogo.map((item) => ({ valor: item.codigo, etiqueta: item.nombre }));
    }
    return provincias.map((item) => ({ valor: item.codigo, etiqueta: item.nombre }));
  }, [catalogo, provincias]);
  const cantonesVisibles = useMemo(
    () => cantonesDe(catalogo?.dominios, filtros.provincias),
    [catalogo, filtros.provincias],
  );
  const fechas = catalogo?.dominios.fecha ?? [];
  const elegida = provincias.find((item) => item.codigo === foco) ?? null;
  const tira = busqueda ? conAgencia.filter((item) => item.nombre.toLocaleLowerCase("es").includes(busqueda)) : conAgencia;
  const medidas = useMemo(() => medidasReales(resumen), [resumen]);
  const hayDatosReales = celdas.length > 0 || (resumen?.total_registros ?? 0) > 0 || (resumen?.registros_sin_zona ?? 0) > 0;
  const filtrosActivos = hayFiltros(filtros);
  const vistaEjemplo = ejemplo.activo && datosListos && vigenteVista && !hayDatosReales && !filtrosActivos;
  const real = elegida ? medidaPublicada(medidas, elegida.codigo) : null;
  const muestra = !real && vistaEjemplo && elegida ? resumenProvinciaEjemplo(elegida.codigo) : null;

  useEffect(() => {
    if (!elegida || !datosListos) {
      return;
    }
    const publicada = medidaPublicada(medidas, elegida.codigo);
    if (publicada) {
      fijarFoco(focoDesdeReal(elegida, publicada));
      return;
    }
    if (ejemplo.activo && vigenteVista && !hayDatosReales && !hayFiltros(filtros)) {
      fijarFoco(focoDesdeProvincia(elegida, resumenProvinciaEjemplo(elegida.codigo)));
      return;
    }
    fijarFoco(focoSinRegistros(elegida));
  }, [datosListos, ejemplo.activo, elegida, fijarFoco, filtros, hayDatosReales, medidas, vigenteVista]);

  return (
    <div className="map-workbench">
      {error ? <p className="error span-completo">{error}</p> : null}
      {errorDatos ? (
        <p className="error span-completo" role="alert">
          {errorDatos}
        </p>
      ) : null}
      {!datosListos ? <p className="aviso span-completo">Actualizando la vista…</p> : null}
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
            {ejemplo.activo && celdas.length === 0
              ? "Puntos ilustrativos, no son socios"
              : "Puntos al acercar, sin nombre ni identificador"}
          </span>
        </button>
        <button type="button" className={agencias ? "active" : ""} aria-pressed={agencias} onClick={() => setAgencias((valor) => !valor)}>
          <i>{agencias ? <Icono nombre="check" /> : null}</i>
          <span>
            <b>Agencias</b>
            Provincias con presencia configurada
          </span>
        </button>
        <DesplegableFiltro
          etiqueta="Zona geográfica"
          opciones={zonasOpciones}
          seleccionados={filtros.zonas}
          multiple
          onChange={(valores) => {
            if (valores.length === 0) {
              limpiar();
            }
            aplicar({ zonas: valores });
          }}
        />
        <p id="nota-zona" className="nota-capa">
          La zona usa los límites ADM1 ya cargados. Varias zonas se combinan con O. Todos muestra el país.
        </p>
        <DesplegableFiltro
          etiqueta="Provincia declarada"
          opciones={(catalogo?.dominios.provincia ?? []).map((valor) => ({ valor, etiqueta: valor }))}
          seleccionados={filtros.provincias}
          multiple
          onChange={(valores) => {
            const permitidos = new Set(cantonesDe(catalogo?.dominios, valores));
            aplicar({
              provincias: valores,
              cantones: valores.length === 0 ? filtros.cantones : filtros.cantones.filter((canton) => permitidos.has(canton)),
            });
          }}
        />
        <DesplegableFiltro
          etiqueta="Cantón declarado"
          opciones={cantonesVisibles.map((valor) => ({ valor, etiqueta: valor }))}
          seleccionados={filtros.cantones}
          multiple
          onChange={(valores) => aplicar({ cantones: valores })}
        />
        <DesplegableFiltro
          etiqueta="Agencia"
          opciones={(catalogo?.dominios.agencia ?? []).map((valor) => ({ valor, etiqueta: valor }))}
          seleccionados={filtros.agencias}
          multiple
          onChange={(valores) => aplicar({ agencias: valores })}
        />
        <SelectorFecha
          etiqueta="Fecha desde"
          valor={filtros.fechaDesde}
          fechas={fechas}
          maximo={filtros.fechaHasta || undefined}
          onChange={(valor) => aplicar({ fechaDesde: valor })}
        />
        <SelectorFecha
          etiqueta="Fecha hasta"
          valor={filtros.fechaHasta}
          fechas={fechas}
          minimo={filtros.fechaDesde || undefined}
          onChange={(valor) => aplicar({ fechaHasta: valor })}
        />
        <button
          type="button"
          className="secundario"
          disabled={!hayFiltros(filtros)}
          onClick={() => {
            limpiar();
            setParams(restablecerParametros(params), { replace: true });
          }}
        >
          Restablecer filtros
        </button>
        <div aria-label="Filtros activos">
          {(resumen?.filtros_activos ?? []).length === 0 ? (
            <p className="nota-capa">Sin filtros. Se muestra el conjunto autorizado completo.</p>
          ) : (
            <ul className="filtros-activos">
              {(resumen?.filtros_activos ?? []).map((filtro) => (
                <li key={filtro.campo} className="chip-filtro">
                  <span>
                    {filtro.etiqueta} {OPERADORES[filtro.operador] ?? filtro.operador} {filtro.valores.join(", ")}
                  </span>
                  <button type="button" onClick={() => quitar(filtro.campo)}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {catalogo?.propuesto ? <p className="nota-capa">Catálogo de filtros {catalogo.version}, propuesto y pendiente de aprobación.</p> : null}
        <p id="nota-canton" className="nota-capa">
          No hay contornos de cantón: ese filtro usa el texto declarado. La zona geográfica sí usa el límite provincial.
          {!ejemplo.activo && celdas.length === 0
            ? " Densidad y registros no tienen coordenadas reales que dibujar."
            : celdas.length > 0
              ? ` La capa de calor agrupa las filas aceptadas. Al acercar, cada registro se ve como un punto.${puntosTruncados ? " La vista de puntos está recortada al límite del servidor." : ""}`
              : " La capa encendida es ilustrativa, no son socios."}
          {resumen ? ` ${textoSinZona(resumen.registros_sin_zona)}` : ""}
          {resumen?.seleccion_vacia ? " La selección no tiene registros: es ausencia de datos, no un cero de la provincia." : ""}
          {elegida?.nota ? ` ${elegida.nota}` : ""}
          {elegida?.es_galapagos ? " Galápagos se consulta en el recuadro, sin cambiar el encuadre continental." : ""}
        </p>
        <div className="dock-reading" aria-label="Indicadores de la selección">
          <span>Provincias con agencia</span>
          <strong>{territorio ? conAgencia.length : "—"}</strong>
          {(resumen?.indicadores_seleccion?.metricas ?? []).map((metrica) => (
            <p key={metrica.codigo}>
              {metrica.nombre}: {textoMetrica(metrica)}
              {metrica.disponible ? ` ${metrica.unidad}` : ""}
            </p>
          ))}
          {resumen?.version_datos ? <p>Versión de datos {resumen.version_datos.slice(0, 12)}</p> : null}
          {resumen?.indicadores_seleccion?.propuesto ? (
            <p>Indicadores propuestos, pendientes de aprobación. El total vacío vale 0; lo que no se puede calcular sale como no disponible.</p>
          ) : null}
        </div>
      </aside>

      <div className="atlas-map">
        <MapaEcuador
          modo="calor"
          capas={capas}
          ejemplo={vistaEjemplo}
          celdas={celdas}
          puntos={puntos}
          provincia={elegida?.es_galapagos ? null : foco}
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
              ) : filtrosActivos ? (
                "Sin registros aceptados en esta selección. Es ausencia de datos, no un valor cero."
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
        <button type="button" className={filtros.zonas.length === 0 ? "active" : ""} onClick={() => elegir(null)}>
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
              className={filtros.zonas.includes(item.codigo) ? "active" : ""}
              aria-label={
                publicada
                  ? etiquetaProvincia(item.nombre, publicada)
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
        {busqueda && tira.length === 0 ? <p className="nota-capa">Ninguna provincia con agencia coincide con la búsqueda.</p> : null}
      </div>

      <div className="leyenda span-leyenda">
        <p>
          <span className="muestra con-agencia" /> Provincia con agencia
        </p>
        <p>
          <span className="muestra sin-agencia" /> Provincia sin agencia
        </p>
        <p>
          <span className="muestra seleccion" /> Provincia seleccionada
        </p>
        <LeyendaCalor leyenda={leyenda} zonasEnCero={resumen?.zonas_en_cero ?? []} ejemplo={vistaEjemplo} />
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
  densidadKm2: number | null;
};

type MuestraEjemplo = {
  socios: number;
  indice: number;
  crecimiento: number;
  nivel: "Muy alta" | "Alta" | "Media";
};

function textoMetrica(metrica: MetricaSeleccion) {
  if (!metrica.disponible || metrica.valor === null) {
    return "No disponible";
  }
  return metrica.valor.toLocaleString("es-EC", { maximumFractionDigits: 4 });
}

function medidasReales(resumen: ResumenReal | null) {
  const medidas = new Map<string, MedidaReal>();
  for (const provincia of resumen?.provincias ?? []) {
    medidas.set(provincia.codigo, {
      registros: provincia.registros,
      indice: provincia.indice ?? null,
      tendencia: provincia.tendencia ?? null,
      densidadKm2: provincia.densidad_km2 ?? null,
    });
  }
  for (const fila of resumen?.ranking ?? []) {
    medidas.set(fila.codigo, {
      registros: fila.registros,
      indice: fila.indice,
      tendencia: fila.tendencia,
      densidadKm2: fila.densidad_km2 ?? null,
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

function etiquetaProvincia(nombre: string, medida: MedidaReal) {
  const densidad = textoDensidadKm2(medida.densidadKm2);
  const indice = medida.indice ?? "sin índice";
  return `${nombre}, ${medida.registros} registros publicados${densidad ? `, ${densidad}` : ""}, índice ${indice}`;
}

function textoReal(medida: MedidaReal) {
  const indice = medida.indice === null ? "sin índice" : `índice ${medida.indice}`;
  const tendencia =
    medida.tendencia === null ? "sin tendencia" : `tendencia ${medida.tendencia > 0 ? "+" : ""}${medida.tendencia}`;
  const densidad = textoDensidadKm2(medida.densidadKm2);
  const extra = densidad ? ` · ${densidad}` : "";
  return `${medida.registros.toLocaleString("es-EC")} registros publicados${extra} · ${indice} · ${tendencia}`;
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
