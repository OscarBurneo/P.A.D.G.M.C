import { Link } from "react-router-dom";
import { useSesion } from "../sesion";

export function Inicio() {
  const { cuenta } = useSesion();
  return (
    <section className="panel ancho">
      <p className="sobrelinea">Sprint 0</p>
      <h1>Hola, {cuenta?.nombre}.</h1>
      <p className="lead">
        La plataforma ya controla quién entra, qué puede hacer y qué quedó registrado. El mapa de
        calor y la importación de socios llegan en los sprints siguientes, cuando la cooperativa
        apruebe el diccionario de datos.
      </p>
      <div className="rejilla">
        <article>
          <h2>Mapa</h2>
          <p>Vista de Loja, todavía sin registros de socios ni coordenadas individuales.</p>
          <Link to="/mapa">Abrir el mapa</Link>
        </article>
        <article>
          <h2>Cuentas y roles</h2>
          <p>El administrador propone una matriz de permisos. Sigue pendiente de aprobación.</p>
          <Link to="/usuarios">Ver cuentas</Link>
        </article>
        <article>
          <h2>Auditoría</h2>
          <p>Cada alta, cambio y fallo deja un evento que la aplicación no puede borrar.</p>
          <Link to="/auditoria">Consultar eventos</Link>
        </article>
      </div>
      <p className="aviso">
        Pendiente de aprobación: matriz de permisos, campos de cuenta, última cuenta administradora,
        inactividad y parámetros de Argon2id (P-02 y P-09).
      </p>
    </section>
  );
}
