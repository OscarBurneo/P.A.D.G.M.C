import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Inicio } from "./Inicio";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, api };
});

vi.mock("../sesion", () => ({
  useSesion: () => ({
    cuenta: {
      id: "1",
      identificador: "admin",
      nombre: "Administrador",
      correo: "admin@padgmc.example",
      activo: true,
      rol: { codigo: "administrador", nombre: "Administrador" },
      permisos: ["mapas.ver"],
    },
    recargar: vi.fn(async () => undefined),
  }),
  puede: (cuenta: { permisos?: string[] } | null, permiso: string) => Boolean(cuenta?.permisos?.includes(permiso)),
}));

vi.mock("../ejemplo", () => ({
  useEjemplo: () => ({ activo: false, cambiar: vi.fn() }),
}));

const resumen = {
  total_registros: 2,
  zonas_analizadas: 1,
  alta_concentracion: 1,
  registros_sin_zona: 3,
  calidad_registros: 100,
  nota: "Con datos.",
  definicion_indice: "Índice de concentración.",
  provincias: [
    {
      codigo: "loja",
      nombre: "Loja",
      nota: null,
      registros: 2,
      cantones: [] as [],
      agencias: 2,
      densidad: 1,
      densidad_km2: 0.0002,
      indice: 100,
      tendencia: null,
    },
  ],
  ranking: [
    {
      codigo: "loja",
      nombre: "Loja",
      registros: 2,
      agencias: 2,
      densidad: 1,
      densidad_km2: 0.0002,
      indice: 100,
      tendencia: null,
    },
  ],
};

describe("concentración en el inicio", () => {
  beforeEach(() => {
    api.mockReset();
    api.mockImplementation((ruta: string) => {
      if (ruta === "/api/mapas/resumen") {
        return Promise.resolve(resumen);
      }
      return Promise.resolve({ lotes: [], nota: "" });
    });
  });

  it("muestra la densidad por km² y los registros sin zona", async () => {
    render(
      <MemoryRouter>
        <Inicio />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Provincias con mayor concentración" })).toBeInTheDocument();
    expect(screen.getByText(/\/km²/)).toBeInTheDocument();
    expect(screen.getByText("3 registros no intersectan ninguna provincia.")).toBeInTheDocument();
    expect(screen.queryByText(/alta oportunidad/i)).not.toBeInTheDocument();
  });
});
