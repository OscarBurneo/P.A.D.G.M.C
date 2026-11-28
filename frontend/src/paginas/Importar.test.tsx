import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Importar } from "./Importar";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, api };
});

const lote = {
  id: "lote-1",
  nombre: "socios.csv",
  fuente: "CSV",
  actor: "admin",
  validos: 1,
  observadas: 0,
  rechazadas: 0,
  total: 1,
  cuadra: true,
  actualizado_en: "2024-03-15T12:00:00Z",
  estado: "Pendiente",
  estado_codigo: "pendiente",
  informe: null,
};

describe("selector de importación", () => {
  beforeEach(() => {
    api.mockReset();
    api.mockImplementation((ruta: string, opciones?: RequestInit) => {
      if (opciones?.method === "POST") {
        return Promise.resolve(lote);
      }
      if (ruta.startsWith("/api/importaciones")) {
        return Promise.resolve({ nota: "Historial", columnas: [], lotes: [lote] });
      }
      return Promise.resolve({});
    });
  });

  it("limpia el archivo elegido y vuelve a enviar el mismo archivo", async () => {
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <Importar />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("columnheader", { name: "Actor" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actualizado" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "admin" })).toBeInTheDocument();
    const entrada = screen.getByLabelText("Archivo CSV o XLSX");
    const archivo = new File(["identificador_socio,nombre\n"], "socios.csv", { type: "text/csv" });
    await usuario.upload(entrada, archivo);
    expect(entrada).toHaveValue("");
    await usuario.upload(entrada, archivo);
    const envios = api.mock.calls.filter((llamada) => llamada[1]?.method === "POST");
    expect(envios).toHaveLength(2);
  });
});
