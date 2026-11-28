import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "./Dashboard";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, api };
});

const resumen = {
  vacio: false,
  filtros_activos: [] as { campo: string; etiqueta: string; operador: string; valores: string[] }[],
  kpis: {
    total: 7,
    mes: {
      periodo: "2024-04",
      etiqueta: "Abril 2024",
      frente_a: "Marzo 2024",
      registros: 4,
      anterior: 2,
      variacion: 100,
    },
    provincia: { nombre: "Loja", registros: 6 },
    agencia: { nombre: "Agencia Centro", registros: 3 },
  },
  tendencia: [
    { periodo: "2024-03", etiqueta: "Mar", anio: 2024, registros: 2, promedio_movil: null, anio_anterior: 0 },
    { periodo: "2024-04", etiqueta: "Abr", anio: 2024, registros: 4, promedio_movil: 2, anio_anterior: 1 },
  ],
  provincias: [
    { nombre: "Loja", registros: 6 },
    { nombre: "Pichincha", registros: 1 },
  ],
  agencias: [{ nombre: "Agencia Centro", registros: 3 }],
  eficiencia: {
    meses: [{ periodo: "2024-04", etiqueta: "Abr" }],
    filas: [{ agencia: "Agencia Centro", valores: [3] }],
    maximo: 3,
  },
  ranking: [{ agencia: "Agencia Centro", total: 3, porcentaje: 42.9, variacion: 50 }],
};

describe("dashboard de inicio", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    api.mockReset();
    api.mockImplementation((ruta: string) => {
      if (ruta.startsWith("/api/mapas/filtros")) {
        return Promise.resolve({
          dominios: {
            provincia: ["Loja", "Pichincha"],
            canton: ["Catamayo", "Quito"],
            canton_por_provincia: [
              { provincia: "Loja", canton: "Catamayo" },
              { provincia: "Pichincha", canton: "Quito" },
            ],
            agencia: ["Agencia Centro"],
            fecha: ["2024-03-10", "2024-04-02"],
          },
        });
      }
      if (ruta.includes("provincia=Loja")) {
        return Promise.resolve({
          ...resumen,
          filtros_activos: [{ campo: "provincia", etiqueta: "Provincia declarada", operador: "en", valores: ["Loja"] }],
        });
      }
      if (ruta.startsWith("/api/dashboard/resumen")) {
        return Promise.resolve(resumen);
      }
      return Promise.resolve({});
    });
  });

  it("muestra los indicadores y filtra el dashboard al pulsar una provincia", async () => {
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(await screen.findByText("7")).toBeInTheDocument();
    expect(screen.getByText("Abril 2024 · frente a Marzo 2024")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Provincia: Todos" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Loja, 6 registros" }));
    expect(await screen.findByRole("button", { name: "Quitar" })).toBeInTheDocument();
    const rutas = api.mock.calls.map((llamada) => String(llamada[0]));
    expect(rutas.some((ruta) => ruta.includes("provincia=Loja"))).toBe(true);
  });
});