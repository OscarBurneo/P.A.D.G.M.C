import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Disposicion } from "./disposicion";
import { Auditoria } from "./paginas/Auditoria";
import { Ingreso } from "./paginas/Ingreso";
import { Inicio } from "./paginas/Inicio";
import { Parametros } from "./paginas/Parametros";
import { Roles } from "./paginas/Roles";
import { Usuarios } from "./paginas/Usuarios";

const Mapa = lazy(() => import("./paginas/Mapa").then((modulo) => ({ default: modulo.Mapa })));
import { puede, useSesion } from "./sesion";

function RutaPrivada({ children }: { children: ReactNode }) {
  const { cargando, cuenta } = useSesion();
  if (cargando) {
    return <p className="estado">Comprobando la sesión…</p>;
  }
  if (!cuenta) {
    return <Navigate to="/ingreso" replace />;
  }
  return <Disposicion>{children}</Disposicion>;
}

export function App() {
  const { cuenta } = useSesion();
  return (
    <Routes>
      <Route path="/ingreso" element={cuenta ? <Navigate to="/" replace /> : <Ingreso />} />
      <Route
        path="/"
        element={
          <RutaPrivada>
            <Inicio />
          </RutaPrivada>
        }
      />
      <Route
        path="/mapa"
        element={
          <RutaPrivada>
            <Suspense fallback={<p className="estado">Cargando el mapa…</p>}>
              <Mapa />
            </Suspense>
          </RutaPrivada>
        }
      />
      <Route
        path="/usuarios"
        element={
          <RutaPrivada>
            {puede(cuenta, "usuarios.leer") ? <Usuarios /> : <SinPermiso />}
          </RutaPrivada>
        }
      />
      <Route
        path="/roles"
        element={
          <RutaPrivada>
            {puede(cuenta, "roles.leer") ? <Roles /> : <SinPermiso />}
          </RutaPrivada>
        }
      />
      <Route
        path="/auditoria"
        element={
          <RutaPrivada>
            {puede(cuenta, "auditoria.leer") ? <Auditoria /> : <SinPermiso />}
          </RutaPrivada>
        }
      />
      <Route
        path="/parametros"
        element={
          <RutaPrivada>
            {puede(cuenta, "parametros.leer") ? <Parametros /> : <SinPermiso />}
          </RutaPrivada>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function SinPermiso() {
  return (
    <section className="panel">
      <h1>Sin permiso</h1>
      <p>Su rol no incluye esta operación. La comprobación también se hace en el servidor.</p>
    </section>
  );
}
