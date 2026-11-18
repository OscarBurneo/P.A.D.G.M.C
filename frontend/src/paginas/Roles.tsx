import { useEffect, useState } from "react";
import { api } from "../api";
import { useSesion } from "../sesion";

type Permiso = { codigo: string; nombre: string; descripcion: string; modulo: string };
type Rol = { codigo: string; nombre: string; descripcion: string; permisos: string[] };
type Respuesta = {
  estado_aprobacion: string;
  nota: string;
  matriz: { version: string; estado_aprobacion: string } | null;
  roles: Rol[];
};

export function Roles() {
  const { recargar } = useSesion();
  const [roles, setRoles] = useState<Rol[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [version, setVersion] = useState("");
  const [seleccion, setSeleccion] = useState("usuario");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function cargar() {
    const [catalogoRoles, catalogoPermisos] = await Promise.all([
      api<Respuesta>("/api/roles"),
      api<{ permisos: Permiso[] }>("/api/permisos"),
    ]);
    setRoles(catalogoRoles.roles);
    setVersion(catalogoRoles.matriz?.version ?? "");
    setPermisos(catalogoPermisos.permisos);
    const rol = catalogoRoles.roles.find((item) => item.codigo === seleccion) ?? catalogoRoles.roles[0];
    if (rol) {
      setSeleccion(rol.codigo);
      setMarcados(rol.permisos);
    }
  }

  useEffect(() => {
    void cargar().catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "Error"));
  }, []);

  function elegir(codigo: string) {
    setSeleccion(codigo);
    setMarcados(roles.find((rol) => rol.codigo === codigo)?.permisos ?? []);
    setMensaje("");
  }

  function alternar(codigo: string) {
    setMarcados((actual) =>
      actual.includes(codigo) ? actual.filter((item) => item !== codigo) : [...actual, codigo],
    );
  }

  async function guardar() {
    setError("");
    setMensaje("");
    try {
      await api(`/api/roles/${seleccion}/permisos`, {
        method: "PUT",
        body: JSON.stringify({ permisos: marcados }),
      });
      setMensaje("Permisos guardados. Aplican en la siguiente solicitud y siguen pendientes de aprobación.");
      await cargar();
      await recargar();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudieron guardar los permisos.");
    }
  }

  return (
    <section className="hoja">
      <p className="aviso">
        Matriz {version || "sin versión"}. Propuesta por rol, sin excepciones por cuenta. Estado: pendiente de aprobación (P-02, P-09).
      </p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {mensaje ? <p className="ok">{mensaje}</p> : null}
      <div className="dos-columnas">
        <div className="lista-roles">
          {roles.map((rol) => (
            <button
              key={rol.codigo}
              type="button"
              aria-pressed={rol.codigo === seleccion}
              className={rol.codigo === seleccion ? "activo" : "secundario"}
              onClick={() => elegir(rol.codigo)}
            >
              <strong>{rol.nombre}</strong>
              <span>{rol.descripcion}</span>
            </button>
          ))}
        </div>
        <fieldset>
          <legend>Permisos de {seleccion}</legend>
          {permisos.map((permiso) => (
            <label key={permiso.codigo} className="check">
              <input
                type="checkbox"
                checked={marcados.includes(permiso.codigo)}
                onChange={() => alternar(permiso.codigo)}
              />
              <span>
                <strong>{permiso.nombre}</strong>
                <small>{permiso.descripcion}</small>
              </span>
            </label>
          ))}
          <button type="button" onClick={() => void guardar()}>
            Guardar permisos
          </button>
        </fieldset>
      </div>
    </section>
  );
}
