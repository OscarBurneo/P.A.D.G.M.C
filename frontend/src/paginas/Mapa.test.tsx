import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const permisos = vi.hoisted(() => ({ lista: ["mapas.ver", "mapas.ver_puntos"] }));

vi.mock("../sesion", () => ({
  useSesion: () => ({
    cuenta: {
      id: "1",
      identificador: "admin",
      nombre: "Administrador",
      correo: "admin@example.com",
      activo: true,
      rol: { codigo: "administrador", nombre: "Administrador" },
      permisos: permisos.lista,
    },
    recargar: vi.fn(async () => undefined),
    cerrar: vi.fn(async () => undefined),
  }),
  puede: (cuenta: { permisos?: string[] } | null, permiso: string) => Boolean(cuenta?.permisos?.includes(permiso)),
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
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    permisos.lista = ["mapas.ver", "mapas.ver_puntos"];
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
          dominios: {
            provincia: ["Loja", "Pichincha"],
            canton: ["Catamayo", "Quito"],
            canton_por_provincia: [
              { provincia: "Loja", canton: "Catamayo" },
              { provincia: "Pichincha", canton: "Quito" },
            ],
            agencia: ["Agencia Norte"],
            fecha: ["2024-03-15", "2024-06-01"],
            zona: [{ codigo: "loja", nombre: "Loja", con_agencia: true }],
          },
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
    await usuario.click(screen.getByRole("button", { name: /Agencia: Todos/ }));
    await usuario.click(screen.getByRole("option", { name: "Agencia Norte" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no se muestran como vigentes");
    expect(screen.queryByText(/Versión de datos abc123abc123/)).not.toBeInTheDocument();
    const rutas = api.mock.calls.map((llamada) => String(llamada[0]));
    expect(rutas.some((ruta) => ruta.includes("agencia=Agencia"))).toBe(true);
  });

  it("abre desplegables con Todos y limita el cantón a la provincia", async () => {
    const usuario = userEvent.setup();
    render(
      <MemoryRouter>
        <Mapa />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("button", { name: "Provincia declarada: Todos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cantón declarado: Todos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fecha desde: Todos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zona geográfica: Todos" })).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Provincia declarada: Todos" }));
    expect(screen.getByRole("option", { name: "Todos" })).toHaveAttribute("aria-selected", "true");
    await usuario.click(screen.getByRole("option", { name: "Loja" }));
    expect(screen.getByRole("button", { name: "Provincia declarada: Loja" })).toHaveAttribute("aria-expanded", "true");

    await usuario.click(screen.getByRole("button", { name: "Cantón declarado: Todos" }));
    expect(screen.getByRole("option", { name: "Catamayo" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Quito" })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole("option", { name: "Catamayo" }));
    const rutas = api.mock.calls.map((llamada) => String(llamada[0]));
    expect(rutas.some((ruta) => ruta.includes("provincia=Loja") && ruta.includes("canton=Catamayo"))).toBe(true);

    await usuario.click(screen.getByRole("button", { name: "Fecha desde: Todos" }));
    expect(screen.getByRole("dialog", { name: "Fecha desde" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "15 de marzo de 2024" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "14 de marzo de 2024" })).toBeDisabled();
  });

  it("oculta los puntos individuales cuando el rol no tiene mapas.ver_puntos", async () => {
    permisos.lista = ["mapas.ver"];
    render(
      <MemoryRouter>
        <Mapa />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Leyenda del calor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Densidad/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Puntos al acercar/ })).not.toBeInTheDocument();
    const rutas = api.mock.calls.map((llamada) => String(llamada[0]));
    expect(rutas.some((ruta) => ruta.startsWith("/api/mapas/calor"))).toBe(true);
    expect(rutas.some((ruta) => ruta.startsWith("/api/mapas/puntos"))).toBe(false);
  });
});
