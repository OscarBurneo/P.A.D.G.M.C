import { FormEvent, useState } from "react";
import { ErrorApi, api } from "../api";
import { Logo } from "../componentes/Logo";
import { useMarca } from "../marca";
import { useSesion } from "../sesion";

export function Ingreso() {
  const { recargar } = useSesion();
  const marca = useMarca();
  const [identificador, setIdentificador] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError("");
    try {
      await api("/api/auth/iniciar-sesion", {
        method: "POST",
        body: JSON.stringify({ identificador, contrasena }),
      });
      await recargar();
    } catch (causa) {
      setError(causa instanceof ErrorApi ? causa.message : "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="ingreso">
      <section className="relato">
        <Logo tamano={56} />
        <p className="sobrelinea">Cooperativa Padre Julián Lorente</p>
        <h1>Dónde puede crecer la cooperativa.</h1>
        <p>
          {marca.nombre} reúne ubicación y mapas de calor para las provincias donde la cooperativa tiene agencia, no solo
          Loja. La sesión, los roles y la auditoría siguen controlando quién entra.
        </p>
        <ul>
          <li>Datos</li>
          <li>Geolocalización</li>
          <li>Mapas de calor</li>
        </ul>
      </section>
      <section className="tarjeta-ingreso">
        <p className="sobrelinea">Acceso autorizado</p>
        <h2>Entrar a {marca.nombre}</h2>
        <form onSubmit={(evento) => void enviar(evento)}>
          <label>
            Identificador
            <input
              autoComplete="username"
              value={identificador}
              onChange={(evento) => setIdentificador(evento.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              value={contrasena}
              onChange={(evento) => setContrasena(evento.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={enviando}>
            {enviando ? "Comprobando…" : "Entrar"}
          </button>
        </form>
        <p className="nota">
          Sprint 0. Las políticas de cuentas y de sesión están pendientes de aprobación del cliente.
        </p>
      </section>
    </div>
  );
}
