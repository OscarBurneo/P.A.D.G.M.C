import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Auditoria } from "./Auditoria";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, api };
});

function evento(id: string, lote: string | null) {
  return {
    id,
    fecha: "2024-03-15T12:00:00Z",
    actor_etiqueta: "admin",
    actor_tipo: "usuario",
    operacion: "importacion.cargar",
    entidad_tipo: "lote",
    entidad_id: lote,
    resultado: "exito",
    codigo_error: null,
    antes: null,
    despues: null,
    mensaje: "ok",
  };
}

describe("auditoría en pantalla", () => {
  beforeEach(() => {
    api.mockReset();
    api.mockImplementation((ruta: string) => {
      const consulta = new URL(ruta, "http://local").searchParams;
      const offset = Number(consulta.get("offset") ?? "0");
      const lote = consulta.get("lote");
      return Promise.resolve({
        total: lote ? 2 : 40,
        limite: 20,
        offset,
        eventos: [evento(lote ? `lote-${offset}` : `e-${offset}`, lote)],
      });
    });
  });

  it("filtra por lote y pagina el listado", async () => {
    const usuario = userEvent.setup();
    render(<Auditoria />);
    expect(await screen.findByText("1–1 de 40")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByText("21–21 de 40")).toBeInTheDocument();
    await usuario.type(screen.getByLabelText("Lote"), "abc-lote");
    await usuario.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(await screen.findByText("1–1 de 2")).toBeInTheDocument();
    const rutas = api.mock.calls.map((llamada) => String(llamada[0]));
    expect(rutas.some((ruta) => ruta.includes("offset=20"))).toBe(true);
    expect(rutas.some((ruta) => ruta.includes("lote=abc-lote"))).toBe(true);
  });
});
