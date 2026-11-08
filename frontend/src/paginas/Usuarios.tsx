import { FormEvent, useEffect, useState } from "react";
import { ErrorApi, api, type Cuenta } from "../api";
import { puede, useSesion } from "../sesion";

type Listado = { cuentas: Cuenta[]; diccionario: { estado_aprobacion: string; pendiente: string } };
type Roles = { roles: { codigo: string; nombre: string }[] };

const VACIO = { identificador: "", correo: "", nombre: "", contrasena: "", rol_codigo: "usuario" };

export function Usuarios() {
  const { cuenta, recargar } = useSesion();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [roles, setRoles] = useState<Roles["roles"]>([]);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [formulario, setFormulario] = useState(VACIO);

  async function cargar() {
    const listado = await api<Listado>("/api/usuarios");
    setCuentas(listado.cuentas);
    setAviso("P-09: el diccionario de cuentas está pendiente de aprobación.");
    if (puede(cuenta, "roles.leer")) {
      const catalogo = await api<Roles>("/api/roles");
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

  return (
    <section className="panel ancho">
      <p className="sobrelinea">Administración</p>
      <h1>Cuentas</h1>
      <p className="aviso">{aviso}</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="cuentas-layout">
        <div className="tabla-contenedor">
        <table>
          <caption>Personas autorizadas</caption>
          <thead>
            <tr>
              <th>Identificador</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map((item) => (
              <tr key={item.id}>
                <td>{item.identificador}</td>
                <td>{item.nombre}</td>
                <td>{item.correo}</td>
                <td>
                  {puede(cuenta, "roles.asignar") && item.activo ? (
                    <select
                      aria-label={`Rol de ${item.identificador}`}
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
                </td>
                <td>{item.activo ? "Activa" : "Desactivada"}</td>
                <td>
                  {puede(cuenta, "usuarios.desactivar") && item.activo ? (
                    <button type="button" className="secundario" onClick={() => void desactivar(item.id, item.nombre)}>
                      Desactivar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {puede(cuenta, "usuarios.crear") ? (
          <form className="formulario" onSubmit={(evento) => void crear(evento)}>
            <h2>Nueva cuenta</h2>
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
                value={formulario.contrasena}
                onChange={(evento) => setFormulario({ ...formulario, contrasena: evento.target.value })}
                required
              />
            </label>
            <label>
              Rol
              <select
                value={formulario.rol_codigo}
                onChange={(evento) => setFormulario({ ...formulario, rol_codigo: evento.target.value })}
              >
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
    </section>
  );
}
