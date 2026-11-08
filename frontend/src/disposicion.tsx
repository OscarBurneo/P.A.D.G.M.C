import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { puede, useSesion } from "./sesion";

const ENLACES = [
  { a: "/", texto: "Inicio", permiso: null },
  { a: "/mapa", texto: "Mapa", permiso: "mapas.ver" },
  { a: "/usuarios", texto: "Cuentas", permiso: "usuarios.leer" },
  { a: "/roles", texto: "Roles", permiso: "roles.leer" },
  { a: "/auditoria", texto: "Auditoría", permiso: "auditoria.leer" },
  { a: "/parametros", texto: "Parámetros", permiso: "parametros.leer" },
];

export function Disposicion({ children }: { children: ReactNode }) {
  const { cuenta, cerrar } = useSesion();
  return (
    <div className="marco">
      <aside className="barra">
        <p className="marca">
          P.A.D.G.M.C
          <span>Padre Julián Lorente · Loja</span>
        </p>
        <nav aria-label="Principal">
          {ENLACES.filter((enlace) => !enlace.permiso || puede(cuenta, enlace.permiso)).map((enlace) => (
            <NavLink key={enlace.a} to={enlace.a} end={enlace.a === "/"}>
              {enlace.texto}
            </NavLink>
          ))}
        </nav>
        <div className="sesion-actual">
          <strong>{cuenta?.nombre}</strong>
          <span>{cuenta?.rol.nombre}</span>
          <button type="button" onClick={() => void cerrar()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
