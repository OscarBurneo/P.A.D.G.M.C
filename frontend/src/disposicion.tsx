import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { Icono } from "./componentes/Icono";
import { Logo } from "./componentes/Logo";
import { zonasAltas } from "./datos/ejemplo";
import { useEjemplo } from "./ejemplo";
import { iniciales } from "./formato";
import { useMarca } from "./marca";
import { PIE, PRINCIPALES } from "./navegacion";
import { puede, useSesion } from "./sesion";

export function Disposicion({ children }: { children: ReactNode }) {
  const { cuenta, cerrar } = useSesion();
  const marca = useMarca();
  const ejemplo = useEjemplo();
  const ubicacion = useLocation();
  const [colapsada, setColapsada] = useState(() => localStorage.getItem("padgmc-barra") === "1");
  const [abierta, setAbierta] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    setAbierta(false);
    setMenu(false);
  }, [ubicacion.pathname]);

  function alternarBarra() {
    setColapsada((valor) => {
      localStorage.setItem("padgmc-barra", valor ? "0" : "1");
      return !valor;
    });
  }

  const visibles = PRINCIPALES.filter((enlace) => !enlace.permiso || puede(cuenta, enlace.permiso));
  const pie = PIE.filter((enlace) => !enlace.permiso || puede(cuenta, enlace.permiso));
  const altas = ejemplo.activo && puede(cuenta, "mapas.ver") ? zonasAltas() : 0;

  return (
    <div className={`marco ${colapsada ? "colapsada" : ""}`}>
      {abierta ? (
        <button type="button" className="velo" aria-label="Cerrar el menú" onClick={() => setAbierta(false)} />
      ) : null}
      <aside className={`barra ${abierta ? "abierta" : ""}`}>
        <div className="barra-cabecera">
          <Logo />
          <div className="marca-texto">
            <strong>{marca.nombre}</strong>
            <span>{marca.subtitulo}</span>
          </div>
          <button type="button" className="icono-boton colapsar" onClick={alternarBarra} aria-label={colapsada ? "Expandir la barra" : "Contraer la barra"}>
            <Icono nombre="panel" />
          </button>
        </div>
        <p className="grupo-nav">Espacio de trabajo</p>
        <nav aria-label="Principal">
          {visibles.map((enlace) => (
            <NavLink key={enlace.a} to={enlace.a} end={enlace.fin} title={enlace.texto}>
              <Icono nombre={enlace.icono} />
              <span>{enlace.texto}</span>
              {enlace.a === "/oportunidades" && altas > 0 ? (
                <em className="insignia" title="Cantidad de ejemplo">
                  {altas}
                </em>
              ) : null}
            </NavLink>
          ))}
        </nav>
        {puede(cuenta, "mapas.ver") ? (
          <div className="tarjeta-predictiva">
            <Icono nombre="diana" />
            <strong>Análisis predictivo</strong>
            <p>Cuando existan registros, esta vista señalará zonas con mayor potencial. Hoy no hay un modelo en producción.</p>
            <NavLink to="/oportunidades">Ver el tablero</NavLink>
          </div>
        ) : null}
        <div className="barra-pie">
          <nav aria-label="Ayuda y configuración">
            {pie.map((enlace) => (
              <NavLink key={enlace.a} to={enlace.a} title={enlace.texto}>
                <Icono nombre={enlace.icono} />
                <span>{enlace.texto}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sesion-actual">
            <span className="avatar" aria-hidden="true">
              {iniciales(cuenta?.nombre ?? "")}
            </span>
            <div className="sesion-texto">
              <strong>{cuenta?.nombre}</strong>
              <span>{cuenta?.rol.nombre}</span>
            </div>
            <button type="button" className="icono-boton" aria-expanded={menu} aria-label="Opciones de la sesión" onClick={() => setMenu((valor) => !valor)}>
              ···
            </button>
            {menu ? (
              <div className="menu-sesion">
                <button
                  type="button"
                  onClick={() => {
                    void cerrar();
                  }}
                >
                  <Icono nombre="salir" /> Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
      <div className="columna">
        <header className="superior">
          <button type="button" className="icono-boton menu-movil" aria-label="Abrir el menú" onClick={() => setAbierta(true)}>
            <Icono nombre="menu" />
          </button>
          <Buscador />
          <EstadoServicio />
          <Avisos />
        </header>
        <div className="pagina">
          {ejemplo.activo ? (
            <div className="banda-ejemplo" role="status">
              <strong>Vista de ejemplo.</strong>
              <span>Las cifras de socios, los índices y la capa de calor no son registros de la cooperativa.</span>
              <button type="button" className="secundario" onClick={() => ejemplo.cambiar(false)}>
                Ver solo datos reales
              </button>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

function Buscador() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ubicacion = useLocation();
  const [texto, setTexto] = useState(params.get("q") ?? "");

  useEffect(() => {
    setTexto(params.get("q") ?? "");
  }, [params]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const consulta = texto.trim();
    const destino = ubicacion.pathname === "/oportunidades" ? "/oportunidades" : "/";
    navigate(consulta ? `${destino}?q=${encodeURIComponent(consulta)}` : destino);
  }

  return (
    <form className="buscador" role="search" onSubmit={enviar}>
      <Icono nombre="buscar" />
      <label className="sr" htmlFor="busqueda">
        Buscar zonas, cantones o indicadores
      </label>
      <input
        id="busqueda"
        value={texto}
        placeholder="Buscar zonas, cantones o indicadores"
        onChange={(evento) => setTexto(evento.target.value)}
      />
    </form>
  );
}

function EstadoServicio() {
  const [texto, setTexto] = useState("Comprobando el servicio…");
  const [clase, setClase] = useState("neutro");

  useEffect(() => {
    void api<{ estado: string }>("/api/salud")
      .then(async (salud) => {
        if (salud.estado !== "ok") {
          setTexto("Servicio no disponible");
          setClase("malo");
          return;
        }
        try {
          const resumen = await api<{ total_registros: number }>("/api/mapas/resumen");
          if (resumen.total_registros > 0) {
            setTexto("Datos sincronizados");
            setClase("ok");
          } else {
            setTexto("Sin cargas de socios");
            setClase("neutro");
          }
        } catch {
          setTexto("Servicio en línea");
          setClase("ok");
        }
      })
      .catch(() => {
        setTexto("Sin conexión");
        setClase("malo");
      });
  }, []);

  return (
    <p className={`estado-sync ${clase}`}>
      <span className="punto" aria-hidden="true" />
      {texto}
    </p>
  );
}

function Avisos() {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="avisos">
      <button type="button" className="icono-boton" aria-expanded={abierto} aria-label="Avisos" onClick={() => setAbierto((valor) => !valor)}>
        <Icono nombre="campana" />
      </button>
      {abierto ? <p className="popover">No hay avisos. Todavía no existen cargas de socios.</p> : null}
    </div>
  );
}
