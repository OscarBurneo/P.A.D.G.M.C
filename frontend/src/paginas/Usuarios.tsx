import { FormEvent, MouseEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { ErrorApi, api, type Cuenta } from "../api";
import { Icono } from "../componentes/Icono";
import { iniciales } from "../formato";
import { puede, useSesion } from "../sesion";

type Listado = { cuentas: Cuenta[]; total?: number };
type Rol = { codigo: string; nombre: string; descripcion?: string };
type Confirmacion = { clave: number; nombre: string; correo: string };

const VACIO = { identificador: "", correo: "", nombre: "", contrasena: "", rol_codigo: "usuario" };
const DURACION_CONFIRMACION_MS = 6000;
const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Usuarios() {
  const { cuenta, recargar } = useSesion();
  const [params] = useSearchParams();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [errorModal, setErrorModal] = useState("");
  const [formulario, setFormulario] = useState(VACIO);
  const [rolFiltro, setRolFiltro] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const dialogoRef = useRef<HTMLDivElement>(null);
  const identificadorRef = useRef<HTMLInputElement>(null);
  const enviandoRef = useRef(false);
  const consulta = (params.get("q") ?? "").trim().toLocaleLowerCase("es");
  const puedeDesactivar = puede(cuenta, "usuarios.desactivar");
  enviandoRef.current = enviando;

  async function cargar() {
    const listado = await api<Listado>("/api/usuarios");
    setCuentas(listado.cuentas);
    setAviso("P-09: el diccionario de cuentas está pendiente de aprobación.");
    if (puede(cuenta, "roles.leer")) {
      const catalogo = await api<{ roles: Rol[] }>("/api/roles");
      setRoles(catalogo.roles);
    }
  }

  useEffect(() => {
    void cargar().catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "Error"));
  }, [cuenta]);

  useEffect(() => {
    if (!confirmacion) {
      return;
    }
    const id = window.setTimeout(() => setConfirmacion(null), DURACION_CONFIRMACION_MS);
    return () => window.clearTimeout(id);
  }, [confirmacion]);

  useLayoutEffect(() => {
    if (!abierto) {
      return;
    }
    const boton = disparadorRef.current;
    const dialogo = dialogoRef.current;
    const raiz = document.getElementById("raiz");
    document.body.classList.add("modal-abierto");
    raiz?.setAttribute("inert", "");
    raiz?.setAttribute("aria-hidden", "true");
    identificadorRef.current?.focus();

    function tecla(evento: KeyboardEvent) {
      if (!dialogo) {
        return;
      }
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        if (!enviandoRef.current) {
          setAbierto(false);
        }
        return;
      }
      if (evento.key !== "Tab") {
        return;
      }
      const enfocables = [...dialogo.querySelectorAll<HTMLElement>(ENFOCABLES)];
      if (enfocables.length === 0) {
        return;
      }
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      const activo = document.activeElement;
      if (evento.shiftKey && (activo === primero || !dialogo.contains(activo))) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (activo === ultimo || !dialogo.contains(activo))) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.classList.remove("modal-abierto");
      raiz?.removeAttribute("inert");
      raiz?.removeAttribute("aria-hidden");
      boton?.focus();
    };
  }, [abierto]);

  function cerrarModal() {
    if (enviandoRef.current) {
      return;
    }
    setAbierto(false);
  }

  function alFondo(evento: MouseEvent<HTMLDivElement>) {
    if (evento.target !== evento.currentTarget) {
      return;
    }
    cerrarModal();
  }

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    if (enviandoRef.current) {
      return;
    }
    const nombre = formulario.nombre.trim();
    const correo = formulario.correo.trim();
    setEnviando(true);
    setErrorModal("");
    try {
      await api("/api/usuarios", { method: "POST", body: JSON.stringify(formulario) });
    } catch (causa) {
      setErrorModal(causa instanceof ErrorApi ? causa.message : "No se pudo crear la cuenta.");
      setEnviando(false);
      return;
    }
    setFormulario(VACIO);
    setAbierto(false);
    setConfirmacion({ clave: Date.now(), nombre, correo });
    setEnviando(false);
    try {
      await cargar();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "Error");
    }
  }

  async function cambiarRol(id: string, rolCodigo: string) {
    setError("");
    try {
      await api(`/api/usuarios/${id}/rol`, {
        method: "PUT",
        body: JSON.stringify({ rol_codigo: rolCodigo }),
      });
      await cargar();
      await recargar();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo cambiar el rol.");
    }
  }

  async function desactivar(id: string, nombre: string) {
    if (!window.confirm(`¿Desactivar la cuenta de ${nombre}? Se cerrarán todas sus sesiones.`)) {
      return;
    }
    setError("");
    try {
      await api(`/api/usuarios/${id}/desactivar`, { method: "POST" });
      await cargar();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo desactivar la cuenta.");
    }
  }

  const catalogo = roles.length
    ? roles
    : [...new Map(cuentas.map((item) => [item.rol.codigo, item.rol])).values()];
  const visibles = cuentas.filter((item) => {
    if (rolFiltro && item.rol.codigo !== rolFiltro) {
      return false;
    }
    if (!consulta) {
      return true;
    }
    return [item.nombre, item.correo, item.identificador, item.rol.nombre].some((texto) =>
      texto.toLocaleLowerCase("es").includes(consulta),
    );
  });
  const opcionesRol = roles.length ? roles : [{ codigo: "usuario", nombre: "Usuario registrado" }];

  return (
    <div className="users-layout">
      {confirmacion ? (
        <div className="ok aviso-flotante" role="status">
          <Icono nombre="check" />
          <p>{textoConfirmacion(confirmacion)}</p>
          <button type="button" className="aviso-cerrar" aria-label="Cerrar confirmación" onClick={() => setConfirmacion(null)}>
            <Icono nombre="cerrar" />
          </button>
        </div>
      ) : null}
      <p className="aviso">{aviso}</p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="role-ribbon" aria-label="Filtrar por rol">
        {catalogo.map((rol) => {
          const cantidad = cuentas.filter((item) => item.rol.codigo === rol.codigo).length;
          const activo = rolFiltro === rol.codigo;
          return (
            <button
              key={rol.codigo}
              type="button"
              className={activo ? "active" : ""}
              aria-pressed={activo}
              onClick={() => setRolFiltro(activo ? null : rol.codigo)}
            >
              <span>{cantidad}</span>
              <b>{rol.nombre}</b>
              <small>{resumenRol(rol)}</small>
            </button>
          );
        })}
      </section>
      <section className="panel access-panel">
        <div className="panel-title">
          <div>
            <span>Directorio</span>
            <h2>{rolFiltro ? `Rol: ${catalogo.find((rol) => rol.codigo === rolFiltro)?.nombre ?? rolFiltro}` : "Usuarios autorizados"}</h2>
          </div>
          {puede(cuenta, "usuarios.crear") ? (
            <button
              type="button"
              ref={disparadorRef}
              aria-haspopup="dialog"
              aria-expanded={abierto}
              aria-controls={abierto ? "dialogo-nueva-cuenta" : undefined}
              onClick={() => setAbierto(true)}
            >
              <Icono nombre="personas" />
              Crear cuenta
            </button>
          ) : null}
        </div>
        <div className="user-list">
          {visibles.map((item) => {
            const puedeApagar = puedeDesactivar && item.activo;
            return (
              <article key={item.id} className={item.activo ? "" : "inactive"}>
                <span className="initials" aria-hidden="true">
                  {iniciales(item.nombre)}
                </span>
                <div>
                  <b>{item.nombre}</b>
                  <small>{item.correo}</small>
                </div>
                <span className="role-tag">
                  {puede(cuenta, "roles.asignar") && item.activo ? (
                    <select
                      aria-label={`Rol de ${item.nombre}`}
                      value={item.rol.codigo}
                      onChange={(evento) => void cambiarRol(item.id, evento.target.value)}
                    >
                      {(roles.length ? roles : [item.rol]).map((rol) => (
                        <option key={rol.codigo} value={rol.codigo}>
                          {rol.nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    item.rol.nombre
                  )}
                </span>
                <span className="area">{item.identificador}</span>
                <button
                  type="button"
                  className="access-switch"
                  role="switch"
                  aria-checked={item.activo}
                  aria-label={
                    item.activo
                      ? `Desactivar la cuenta de ${item.nombre}`
                      : `${item.nombre} está inactiva. No hay forma de reactivarla en esta versión.`
                  }
                  disabled={!puedeApagar}
                  title={
                    !item.activo
                      ? "La API solo permite desactivar. No existe reactivación."
                      : puedeDesactivar
                        ? "Desactivar cuenta"
                        : "Su rol no puede desactivar cuentas."
                  }
                  onClick={() => void desactivar(item.id, item.nombre)}
                >
                  <i />
                </button>
              </article>
            );
          })}
          {visibles.length === 0 ? (
            <div className="empty-state">
              <strong>No hay usuarios que coincidan</strong>
              <span>Cambie el rol o la búsqueda.</span>
            </div>
          ) : null}
        </div>
      </section>
      {abierto
        ? createPortal(
            <div className="modal-fondo" onClick={alFondo}>
              <div
                id="dialogo-nueva-cuenta"
                className="panel modal-dialogo"
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-nueva-cuenta"
                aria-describedby="nota-nueva-cuenta"
                aria-busy={enviando}
                ref={dialogoRef}
                onClick={(evento) => evento.stopPropagation()}
              >
                <div className="modal-cabecera">
                  <h2 id="titulo-nueva-cuenta">Nueva cuenta</h2>
                  <button type="button" className="modal-cerrar" aria-label="Cerrar" onClick={cerrarModal} disabled={enviando}>
                    <Icono nombre="cerrar" />
                  </button>
                </div>
                <form className="formulario" onSubmit={(evento) => void crear(evento)}>
                  <p id="nota-nueva-cuenta" className="nota-inline">
                    No hay un envío de invitación. El alta crea la cuenta en el directorio.
                  </p>
                  <label>
                    Identificador
                    <input
                      ref={identificadorRef}
                      value={formulario.identificador}
                      onChange={(evento) => setFormulario({ ...formulario, identificador: evento.target.value })}
                      required
                      disabled={enviando}
                    />
                  </label>
                  <label>
                    Nombre
                    <input
                      value={formulario.nombre}
                      onChange={(evento) => setFormulario({ ...formulario, nombre: evento.target.value })}
                      required
                      disabled={enviando}
                    />
                  </label>
                  <label>
                    Correo
                    <input
                      type="email"
                      value={formulario.correo}
                      onChange={(evento) => setFormulario({ ...formulario, correo: evento.target.value })}
                      required
                      disabled={enviando}
                    />
                  </label>
                  <label>
                    Contraseña
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={formulario.contrasena}
                      onChange={(evento) => setFormulario({ ...formulario, contrasena: evento.target.value })}
                      required
                      disabled={enviando}
                    />
                  </label>
                  <label>
                    Rol
                    <select
                      value={formulario.rol_codigo}
                      onChange={(evento) => setFormulario({ ...formulario, rol_codigo: evento.target.value })}
                      disabled={enviando}
                    >
                      {opcionesRol.map((rol) => (
                        <option key={rol.codigo} value={rol.codigo}>
                          {rol.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  {errorModal ? (
                    <p className="error" role="alert">
                      {errorModal}
                    </p>
                  ) : null}
                  <div className="modal-acciones">
                    <button type="button" className="secundario" onClick={cerrarModal} disabled={enviando}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={enviando}>
                      {enviando ? "Creando cuenta…" : "Crear cuenta"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function textoConfirmacion(aviso: Confirmacion) {
  if (aviso.nombre && aviso.correo) {
    return `Usuario creado: ${aviso.nombre} (${aviso.correo}).`;
  }
  return `Usuario creado: ${aviso.nombre || aviso.correo}.`;
}

function resumenRol(rol: Rol) {
  if (rol.codigo === "administrador") {
    return "Gestión total";
  }
  if (rol.codigo === "usuario") {
    return "Consulta habilitada";
  }
  return rol.descripcion ?? rol.nombre;
}
