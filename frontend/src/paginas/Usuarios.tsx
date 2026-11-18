import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorApi, api, type Cuenta } from "../api";
import { iniciales } from "../formato";
import { puede, useSesion } from "../sesion";

type Listado = { cuentas: Cuenta[]; total?: number };
type Rol = { codigo: string; nombre: string; descripcion?: string };

const VACIO = { identificador: "", correo: "", nombre: "", contrasena: "", rol_codigo: "usuario" };

export function Usuarios() {
  const { cuenta, recargar } = useSesion();
  const [params] = useSearchParams();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [formulario, setFormulario] = useState(VACIO);
  const [rolFiltro, setRolFiltro] = useState<string | null>(null);
  const consulta = (params.get("q") ?? "").trim().toLocaleLowerCase("es");
  const puedeDesactivar = puede(cuenta, "usuarios.desactivar");

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

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setError("");
    try {
      await api("/api/usuarios", { method: "POST", body: JSON.stringify(formulario) });
      setFormulario(VACIO);
      await cargar();
    } catch (causa) {
      setError(causa instanceof ErrorApi ? causa.message : "No se pudo crear la cuenta.");
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

  return (
    <div className="users-layout">
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
            <a href="#nueva-cuenta">Crear cuenta</a>
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
      {puede(cuenta, "usuarios.crear") ? (
        <form id="nueva-cuenta" className="panel formulario" onSubmit={(evento) => void crear(evento)}>
          <h2>Nueva cuenta</h2>
          <p className="nota-inline">No hay un envío de invitación. El alta crea la cuenta en el directorio.</p>
          <label>
            Identificador
            <input
              value={formulario.identificador}
              onChange={(evento) => setFormulario({ ...formulario, identificador: evento.target.value })}
              required
            />
          </label>
          <label>
            Nombre
            <input
              value={formulario.nombre}
              onChange={(evento) => setFormulario({ ...formulario, nombre: evento.target.value })}
              required
            />
          </label>
          <label>
            Correo
            <input
              type="email"
              value={formulario.correo}
              onChange={(evento) => setFormulario({ ...formulario, correo: evento.target.value })}
              required
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
            />
          </label>
          <label>
            Rol
            <select value={formulario.rol_codigo} onChange={(evento) => setFormulario({ ...formulario, rol_codigo: evento.target.value })}>
              {(roles.length ? roles : [{ codigo: "usuario", nombre: "Usuario registrado" }]).map((rol) => (
                <option key={rol.codigo} value={rol.codigo}>
                  {rol.nombre}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Crear cuenta</button>
        </form>
      ) : null}
    </div>
  );
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
