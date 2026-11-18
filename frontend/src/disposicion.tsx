import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { Icono } from "./componentes/Icono";
import { Logo } from "./componentes/Logo";
import { useEjemplo } from "./ejemplo";
import { useFoco } from "./foco";
import { formatoCoordenadas, iniciales } from "./formato";
import { useMarca } from "./marca";
import { CAPITULOS, EXTRAS, NOTAS_BITACORA, type Capitulo, type PaginaExtra } from "./navegacion";
import { puede, useSesion } from "./sesion";

export function Disposicion({ children }: { children: ReactNode }) {
  const { cuenta, cerrar } = useSesion();
  const marca = useMarca();
  const ejemplo = useEjemplo();
  const { zona, fijar } = useFoco();
  const ubicacion = useLocation();
  const [params] = useSearchParams();
  const cabecera = useRef<HTMLElement>(null);
  const [bitacoraAbierta, setBitacoraAbierta] = useState(() => {
    const guardado = localStorage.getItem("padgmc-bitacora");
    if (guardado === "0") {
      return false;
    }
    if (guardado === "1") {
      return true;
    }
    return window.innerWidth > 1180;
  });
  const [masAbierto, setMasAbierto] = useState(false);
  const [menu, setMenu] = useState(false);
  const [avisos, setAvisos] = useState(false);

  const capitulos = CAPITULOS.filter((enlace) => !enlace.permiso || puede(cuenta, enlace.permiso));
  const extras = EXTRAS.filter((enlace) => !enlace.permiso || puede(cuenta, enlace.permiso));
  const capitulo = CAPITULOS.find((enlace) => coincideRuta(ubicacion.pathname, enlace.a, enlace.fin));
  const extra = EXTRAS.find((enlace) => coincideRuta(ubicacion.pathname, enlace.a));
  const pagina = capitulo ?? extra;
  const indiceRiel = capitulo ? CAPITULOS.findIndex((item) => item.a === capitulo.a) : -1;
  const coordenadas = zona.lng !== null && zona.lat !== null ? formatoCoordenadas(zona.lng, zona.lat) : null;
  const puedeMapa = puede(cuenta, "mapas.ver");

  useEffect(() => {
    setMasAbierto(false);
    setMenu(false);
    setAvisos(false);
  }, [ubicacion.pathname]);

  useEffect(() => {
    const nodo = cabecera.current;
    if (!nodo) {
      return;
    }
    const observar = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--header", `${nodo.offsetHeight}px`);
    });
    observar.observe(nodo);
    return () => observar.disconnect();
  }, []);

  useEffect(() => {
    if (!ejemplo.activo && zona.ejemplo) {
      fijar({
        ...zona,
        zonaNombre: zona.provinciaNombre,
        indice: null,
        socios: null,
        crecimiento: null,
        nivel: null,
        ejemplo: false,
      });
    }
  }, [ejemplo.activo, fijar, zona]);

  useEffect(() => {
    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setMasAbierto(false);
        setMenu(false);
        setAvisos(false);
        if (window.innerWidth <= 1180) {
          alternarBitacora(false);
        }
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  function alternarBitacora(valor?: boolean) {
    setBitacoraAbierta((actual) => {
      const siguiente = valor ?? !actual;
      localStorage.setItem("padgmc-bitacora", siguiente ? "1" : "0");
      return siguiente;
    });
  }

  function consultaDe(ruta: string) {
    if (ubicacion.pathname === ruta) {
      return ubicacion.search;
    }
    const q = params.get("q");
    return q ? `?q=${encodeURIComponent(q)}` : "";
  }

  const partes = partirMarca(marca.nombre);

  return (
    <div className={`atlas ${bitacoraAbierta ? "notebook-open" : "notebook-closed"}`}>
      <header className="masthead" ref={cabecera}>
        <NavLink className="brand" to="/" end aria-label={`Ir al resumen de ${marca.nombre}`}>
          <Logo tamano={38} />
          <span>
            <strong>
              {partes.base}
              {partes.acento ? <span>{partes.acento}</span> : null}
            </strong>
            <small>Padre Julián Lorente</small>
          </span>
        </NavLink>

        <nav className="chapter-nav" aria-label="Capítulos">
          {capitulos.map((enlace) => (
            <NavLink
              key={enlace.a}
              to={{ pathname: enlace.a, search: consultaDe(enlace.a) }}
              end={enlace.fin}
            >
              <small>{enlace.n}</small>
              <span>{enlace.texto}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mast-tools">
          <Buscador />
          <div className="menu-ancla">
            <button
              type="button"
              className="tool-button alert"
              aria-expanded={avisos}
              aria-label="Avisos"
              onClick={() => {
                setAvisos((valor) => !valor);
                setMenu(false);
                setMasAbierto(false);
              }}
            >
              <Icono nombre="campana" />
            </button>
            {avisos ? (
              <p className="popover" role="status">
                No hay avisos. Todavía no existen cargas de socios.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="tool-button"
            aria-pressed={bitacoraAbierta}
            aria-label={bitacoraAbierta ? "Ocultar bitácora" : "Mostrar bitácora"}
            title={bitacoraAbierta ? "Ocultar bitácora" : "Mostrar bitácora"}
            onClick={() => alternarBitacora()}
          >
            <Icono nombre="bitacora" />
          </button>
          <MenuMas
            extras={extras}
            abierto={masAbierto}
            consultaDe={consultaDe}
            onAlternar={() => {
              setMasAbierto((valor) => !valor);
              setMenu(false);
              setAvisos(false);
            }}
            onCerrar={() => setMasAbierto(false)}
          />
          <MenuSesion
            nombre={cuenta?.nombre ?? ""}
            rol={cuenta?.rol.nombre ?? ""}
            abierto={menu}
            onAlternar={() => {
              setMenu((valor) => !valor);
              setMasAbierto(false);
              setAvisos(false);
            }}
            onCerrarSesion={() => void cerrar()}
          />
        </div>
      </header>

      <main className="atlas-body">
        <aside className="coordinate-rail" aria-hidden="true">
          <span className="rail-number">{capitulo?.n ?? "··"}</span>
          <div className="rail-line">
            <i
              style={{
                top: `${indiceRiel >= 0 ? (indiceRiel / Math.max(CAPITULOS.length - 1, 1)) * 100 : 100}%`,
              }}
            />
          </div>
          <small>{coordenadas?.lat ?? "—"}</small>
          <small>{coordenadas?.lng ?? "—"}</small>
        </aside>

        <section className="stage">
          {pagina ? <EncabezadoPagina pagina={pagina} coordenadas={coordenadas} /> : null}
          <p className="sr">
            {coordenadas
              ? `Coordenadas del foco ${coordenadas.lat} ${coordenadas.lng}`
              : "Sin coordenadas de foco"}
          </p>
          {["/", "/mapa", "/oportunidades"].includes(ubicacion.pathname) ? (
            ejemplo.activo ? (
              <div className="banda-ejemplo" role="status">
                <strong>Vista de ejemplo.</strong>
                <span>Las cifras marcadas no son registros de la cooperativa.</span>
                <button type="button" className="secundario" onClick={() => ejemplo.cambiar(false)}>
                  Ver solo datos reales
                </button>
              </div>
            ) : (
              <p className="nota ejemplo-off">
                Sin registros de socios. Los indicadores quedan vacíos.
                <button type="button" className="secundario" onClick={() => ejemplo.cambiar(true)}>
                  Mostrar vista de ejemplo
                </button>
              </p>
            )
          ) : null}
          {children}
        </section>

        <Bitacora
          nota={NOTAS_BITACORA[ubicacion.pathname] ?? "Sin nota para esta pantalla."}
          etiqueta={pagina?.texto ?? "pantalla"}
          puedeMapa={puedeMapa}
          abierta={bitacoraAbierta}
          onCerrar={() => alternarBitacora(false)}
        />
      </main>
      {bitacoraAbierta ? (
        <button type="button" className="notebook-scrim" aria-label="Cerrar bitácora" onClick={() => alternarBitacora(false)} />
      ) : null}
    </div>
  );
}

function EncabezadoPagina({
  pagina,
  coordenadas,
}: {
  pagina: Capitulo | PaginaExtra;
  coordenadas: { lat: string; lng: string } | null;
}) {
  const { zona } = useFoco();
  const numero = "n" in pagina ? pagina.n : null;
  return (
    <header className="stage-heading">
      <div>
        <span className="chapter-code">
          <Icono nombre={pagina.icono} /> {numero ? `Capítulo ${numero}` : "Sección"}
        </span>
        <h1>{pagina.titulo}</h1>
        <p>{pagina.nota}</p>
      </div>
      <div className="heading-meta">
        <span>
          {zona.ejemplo
            ? "Vista de ejemplo, no son registros"
            : coordenadas
              ? `${coordenadas.lat} · ${coordenadas.lng}`
              : "Sin fecha de carga de socios"}
        </span>
        {zona.provinciaNombre ? <b>{zona.provinciaNombre}</b> : <b className="meta-vacia">Sin provincia en foco</b>}
      </div>
    </header>
  );
}

function Bitacora({
  nota,
  etiqueta,
  puedeMapa,
  abierta,
  onCerrar,
}: {
  nota: string;
  etiqueta: string;
  puedeMapa: boolean;
  abierta: boolean;
  onCerrar: () => void;
}) {
  const ejemplo = useEjemplo();
  const { zona } = useFoco();
  const hayFoco = Boolean(zona.provinciaNombre || zona.zonaNombre);
  const destino =
    puedeMapa && zona.provinciaCodigo ? `/mapa?provincia=${encodeURIComponent(zona.provinciaCodigo)}` : null;

  return (
    <aside className="field-notebook" aria-label="Bitácora contextual" aria-hidden={!abierta}>
      <div className="notebook-head">
        <span>Bitácora</span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar bitácora">
          <Icono nombre="cerrar" />
        </button>
      </div>
      <div className={`focus-card ${hayFoco ? "" : "vacio"}`}>
        <span>Zona en foco</span>
        {hayFoco ? (
          <>
            <h2>{zona.zonaNombre ?? zona.provinciaNombre}</h2>
            {zona.ejemplo ? <em className="chip-ejemplo">Ejemplo</em> : null}
            {zona.indice !== null ? (
              <div className="focus-score">
                <b>{zona.indice}</b>
                <span>
                  <i style={{ width: `${zona.indice}%` }} />
                </span>
              </div>
            ) : (
              <p className="foco-vacio">Sin índice. No hay registros para esta zona.</p>
            )}
            <p>
              {zona.socios !== null ? `${zona.socios.toLocaleString("es-EC")} potenciales socios` : "Sin potenciales socios"}
              {zona.crecimiento !== null ? ` · ${zona.crecimiento > 0 ? "+" : ""}${zona.crecimiento}% de crecimiento` : ""}
              {zona.ejemplo ? " (vista de ejemplo)" : ""}
            </p>
            {destino ? (
              <NavLink to={destino}>
                Ubicar en atlas <Icono nombre="flecha" />
              </NavLink>
            ) : (
              <p className="foco-vacio">Sin provincia para abrir en el atlas.</p>
            )}
          </>
        ) : (
          <>
            <h2>Sin zona en foco</h2>
            <p>Elija una provincia en el atlas. Los índices aparecen con registros o en la vista de ejemplo.</p>
          </>
        )}
      </div>
      <div className="note-block">
        <span>Nota de {etiqueta.toLocaleLowerCase("es")}</span>
        <p>{nota}</p>
      </div>
      <div className="security-note">
        <Icono nombre="candado" />
        <p>
          <b>Datos protegidos</b>
          Las acciones de cuentas, roles y cobertura quedan registradas para trazabilidad.
        </p>
      </div>
      <button type="button" className="ejemplo-toggle" onClick={() => ejemplo.cambiar(!ejemplo.activo)}>
        {ejemplo.activo ? "Ver solo datos reales" : "Mostrar vista de ejemplo"}
      </button>
    </aside>
  );
}

function Buscador() {
  const [params, setParams] = useSearchParams();
  const [texto, setTexto] = useState(params.get("q") ?? "");

  useEffect(() => {
    setTexto(params.get("q") ?? "");
  }, [params]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const siguientes = new URLSearchParams(params);
    const consulta = texto.trim();
    if (consulta) {
      siguientes.set("q", consulta);
    } else {
      siguientes.delete("q");
    }
    setParams(siguientes, { replace: true });
  }

  return (
    <form className="atlas-search" role="search" onSubmit={enviar}>
      <Icono nombre="buscar" />
      <label className="sr" htmlFor="busqueda">
        Filtrar zonas o usuarios
      </label>
      <input
        id="busqueda"
        value={texto}
        placeholder="Filtrar zonas o usuarios"
        onChange={(evento) => setTexto(evento.target.value)}
      />
      {texto ? (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => {
            setTexto("");
            const siguientes = new URLSearchParams(params);
            siguientes.delete("q");
            setParams(siguientes, { replace: true });
          }}
        >
          <Icono nombre="cerrar" />
        </button>
      ) : null}
    </form>
  );
}

function MenuMas({
  extras,
  abierto,
  consultaDe,
  onAlternar,
  onCerrar,
}: {
  extras: PaginaExtra[];
  abierto: boolean;
  consultaDe: (ruta: string) => string;
  onAlternar: () => void;
  onCerrar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ubicacion = useLocation();
  useCerrarFuera(ref, abierto, onCerrar);
  const activo = extras.some((enlace) => coincideRuta(ubicacion.pathname, enlace.a));

  return (
    <div className="menu-ancla" ref={ref}>
      <button type="button" className={`tool-button mas ${activo ? "activo" : ""}`} aria-expanded={abierto} aria-haspopup="menu" onClick={onAlternar}>
        Más
      </button>
      {abierto ? (
        <div className="popover menu" role="menu">
          {extras.map((enlace) => (
            <NavLink key={enlace.a} role="menuitem" to={{ pathname: enlace.a, search: consultaDe(enlace.a) }} onClick={onCerrar}>
              <Icono nombre={enlace.icono} />
              {enlace.texto}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MenuSesion({
  nombre,
  rol,
  abierto,
  onAlternar,
  onCerrarSesion,
}: {
  nombre: string;
  rol: string;
  abierto: boolean;
  onAlternar: () => void;
  onCerrarSesion: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useCerrarFuera(ref, abierto, onAlternar);
  return (
    <div className="menu-ancla" ref={ref}>
      <button type="button" className="tool-button sesion-boton" aria-expanded={abierto} aria-label={`Sesión de ${nombre}`} onClick={onAlternar}>
        <span className="avatar" aria-hidden="true">
          {iniciales(nombre)}
        </span>
      </button>
      {abierto ? (
        <div className="popover menu">
          <p className="sesion-nombre">
            <strong>{nombre}</strong>
            <span>{rol}</span>
          </p>
          <button type="button" onClick={onCerrarSesion}>
            <Icono nombre="salir" /> Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}

function useCerrarFuera(ref: RefObject<HTMLElement | null>, abierto: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!abierto) {
      return;
    }
    function clic(evento: MouseEvent) {
      if (!ref.current?.contains(evento.target as Node)) {
        cerrar();
      }
    }
    document.addEventListener("mousedown", clic);
    return () => document.removeEventListener("mousedown", clic);
  }, [abierto, cerrar, ref]);
}

function coincideRuta(pathname: string, ruta: string, fin?: boolean) {
  if (fin || ruta === "/") {
    return pathname === ruta;
  }
  return pathname === ruta || pathname.startsWith(`${ruta}/`);
}

function partirMarca(nombre: string) {
  const indice = nombre.indexOf("Oportunidades");
  if (indice > 0) {
    return { base: nombre.slice(0, indice), acento: nombre.slice(indice) };
  }
  return { base: nombre, acento: "" };
}
