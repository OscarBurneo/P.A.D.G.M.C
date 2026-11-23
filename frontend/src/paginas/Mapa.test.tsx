import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Mapa } from "./Mapa";

const { api, cargarTerritorio } = vi.hoisted(() => ({
  api: vi.fn(),
  cargarTerritorio: vi.fn(),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, api };
});

vi.mock("../cobertura", async () => {
  const actual = await vi.importActual<typeof import("../cobertura")>("../cobertura");
  return { ...actual, cargarTerritorio };
});

vi.mock("../componentes/MapaEcuador", () => ({
  MapaEcuador: () => <div>Lienzo</div>,
}));

vi.mock("../ejemplo", () => ({
  useEjemplo: () => ({ activo: false, cambiar: vi.fn() }),
}));

vi.mock("../foco", () => ({
  useFoco: () => ({
    zona: { zonaNombre: null, provinciaNombre: null },
    fijar: vi.fn(),
    limpiar: vi.fn(),
  }),
}));

const leyenda = {
  variable: "Registros aceptados",
  unidad: "registros por celda de 0,01 grados",
  significado: "Intensidad relativa del peso.",
  cero: "La provincia existe y el conteo es 0.",
  ausencia: "No hay celdas. No equivale al valor cero.",
  ausencia_datos: false,
  intervalos: [{ etiqueta: "Bajo", desde: 1, hasta: 3, patron: "puntos", significado: "Bajo: de 1 a 3." }],
  escala: "Luminancia y patrón.",
};

const resumen = {
  total_registros: 2,
  zonas_analizadas: 1,
  alta_concentracion: 1,
  registros_sin_zona: 0,
  zonas_en_cero: [],
  calidad_registros: 100,
  nota: "Con datos.",
  provincias: [],
  ranking: [],
  version_datos: "abc123abc123",
  filtros_activos: [] as { campo: string; etiqueta: string; operador: string; valores: string[] }[],
  seleccion_vacia: false,
  indicadores_seleccion: {
    propuesto: true,
    nota: "Propuesto.",
    metricas: [
      {
        codigo: "total_registros",
        nombre: "Registros aceptados",
        unidad: "registro",
        valor: 2,
        disponible: true,
      },
    ],
  },
};

describe("mapa con leyenda y filtros", () => {
  beforeEach(() => {
    api.mockReset();
    cargarTerritorio.mockReset();
    cargarTerritorio.mockResolvedValue({
      fuente: { nombre: "gb", licencia: "CC0", licencia_url: "", cita: "cita", doi: "", url: "", nota: "", srid: 4326 },
      encuadre_continental: { oeste: -81, sur: -5, este: -75, norte: 2 },
      recuadro_galapagos: null,
      provincias: [
        {
          codigo: "loja",
          codigo_limite: "loja",
          nombre: "Loja",
          con_agencia: true,
          es_galapagos: false,
          nota: null,
          orden: 1,
          bbox: { oeste: -80.2, sur: -4.6, este: -79, norte: -3.4 },
        },
      ],
    });
    api.mockImplementation((ruta: string) => {
      if (ruta.startsWith("/api/mapas/filtros")) {
        return Promise.resolve({
          propuesto: true,
          version: "0.1.0-propuesto",
          nota: "Propuesto.",
          dominios: { provincia: ["Loja"], canton: ["Loja"], agencia: ["Agencia Norte"] },
        });
      }
      if (ruta.includes("agencia=")) {
        return Promise.reject(new Error("sin red"));
      }
      if (ruta.startsWith("/api/mapas/calor")) {
        return Promise.resolve({
          celdas: [{ longitud: -79.2, latitud: -3.99, peso: 2 }],
          total_registros: 2,
          version_datos: "abc123abc123",
          leyenda,
        });
      }
      if (ruta.startsWith("/api/mapas/resumen")) {
        return Promise.resolve(resumen);
      }
      return Promise.resolve({});
    });
  });

  it("lee la leyenda, aplica un filtro y no conserva la vista si la actualización falla", async () => {
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <Mapa />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Leyenda del calor" })).toBeInTheDocument();
    expect(screen.getAllByText(/Registros aceptados/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bajo: 1 a 3/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cero\./)).toBeInTheDocument();
    expect(screen.getByText(/Ausencia de datos\./)).toBeInTheDocument();
    expect(screen.getByText(/Versión de datos abc123abc123/)).toBeInTheDocument();
    await usuario.selectOptions(screen.getByLabelText("Agencia"), "Agencia Norte");
    expect(await screen.findByRole("alert")).toHaveTextContent("no se muestran como vigentes");
    expect(screen.queryByText(/Versión de datos abc123abc123/)).not.toBeInTheDocument();
    const rutas = api.mock.calls.map((llamada) => String(llamada[0]));
    expect(rutas.some((ruta) => ruta.includes("agencia=Agencia"))).toBe(true);
  });
});
