import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ProveedorEjemplo } from "./ejemplo";
import { ProveedorFoco } from "./foco";
import { ProveedorMarca } from "./marca";
import { ProveedorSesion } from "./sesion";
import "./estilos.css";

const nodo = document.getElementById("raiz");
if (!nodo) {
  throw new Error("No se encontró el nodo raíz.");
}

createRoot(nodo).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorMarca>
        <ProveedorEjemplo>
          <ProveedorSesion>
            <ProveedorFoco>
              <App />
            </ProveedorFoco>
          </ProveedorSesion>
        </ProveedorEjemplo>
      </ProveedorMarca>
    </BrowserRouter>
  </StrictMode>,
);
