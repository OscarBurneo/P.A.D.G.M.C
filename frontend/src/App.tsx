import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Disposicion } from "./disposicion";
import { Auditoria } from "./paginas/Auditoria";
import { Ayuda } from "./paginas/Ayuda";
import { Fuentes } from "./paginas/Fuentes";
import { Importar } from "./paginas/Importar";
import { Ingreso } from "./paginas/Ingreso";
import { Inicio } from "./paginas/Inicio";
import { Oportunidades } from "./paginas/Oportunidades";
import { Parametros } from "./paginas/Parametros";
import { Roles } from "./paginas/Roles";
import { Usuarios } from "./paginas/Usuarios";
import { puede, useSesion } from "./sesion";

const Mapa = lazy(() => import("./paginas/Mapa").then((modulo) => ({ default: modulo.Mapa })));

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
              {puede(cuenta, "mapas.ver") ? <Mapa /> : <SinPermiso />}
            </Suspense>
          </RutaPrivada>
        }
      />
      <Route
        path="/oportunidades"
        element={
          <RutaPrivada>
            {puede(cuenta, "mapas.ver") ? <Oportunidades /> : <SinPermiso />}
          </RutaPrivada>
        }
      />
      <Route
        path="/importar"
        element={
          <RutaPrivada>
            {puede(cuenta, "importaciones.cargar") ? <Importar /> : <SinPermiso />}
          </RutaPrivada>
        }
      />
      <Route
        path="/fuentes"
        element={
          <RutaPrivada>
            {puede(cuenta, "importaciones.cargar") ? <Fuentes /> : <SinPermiso />}
          </RutaPrivada>
        }
      />
      <Route
        path="/ayuda"
        element={
          <RutaPrivada>
            <Ayuda />
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
