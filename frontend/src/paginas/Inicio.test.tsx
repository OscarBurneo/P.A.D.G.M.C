import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Inicio } from "./Inicio";

vi.mock("../api", () => ({
  api: vi.fn(() => Promise.resolve({ dominios: {}, vacio: true, kpis: { total: 0, mes: null, provincia: null, agencia: null }, tendencia: [], provincias: [], agencias: [], eficiencia: { meses: [], filas: [], maximo: 0 }, ranking: [], filtros_activos: [] })),
}));

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

describe("inicio", () => {
  it("abre el dashboard analítico", async () => {
    render(
      <MemoryRouter>
        <Inicio />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("button", { name: "Provincia: Todos" })).toBeInTheDocument();
  });
});
