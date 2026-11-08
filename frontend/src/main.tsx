import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ProveedorSesion } from "./sesion";
import "./estilos.css";

const nodo = document.getElementById("raiz");
if (!nodo) {
  throw new Error("No se encontró el nodo raíz.");
}

createRoot(nodo).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>,
);
