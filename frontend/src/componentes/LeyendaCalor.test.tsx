import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeyendaCalor, type LeyendaCalorDatos } from "./LeyendaCalor";

const leyenda: LeyendaCalorDatos = {
  variable: "Registros aceptados",
  unidad: "registros por celda de 0,01 grados",
  significado: "Intensidad relativa del peso.",
  cero: "La provincia existe y el conteo es 0.",
  ausencia: "No hay celdas. No equivale al valor cero.",
  ausencia_datos: false,
  intervalos: [
    { etiqueta: "Bajo", desde: 1, hasta: 2, patron: "puntos", significado: "Bajo: de 1 a 2." },
    { etiqueta: "Muy alto", desde: 3, hasta: 4, patron: "solido", significado: "Muy alto: de 3 a 4." },
  ],
  escala: "Luminancia y patrón.",
};

describe("leyenda del calor", () => {
  it("muestra variable, unidad, intervalos y distingue cero de ausencia", () => {
    render(<LeyendaCalor leyenda={leyenda} zonasEnCero={["Galápagos"]} ejemplo={false} />);
    expect(screen.getByRole("heading", { name: "Leyenda del calor" })).toBeInTheDocument();
    expect(screen.getByText("Registros aceptados")).toBeInTheDocument();
    expect(screen.getByText(/registros por celda de 0,01 grados/)).toBeInTheDocument();
    expect(screen.getByText(/Bajo: 1 a 2/)).toBeInTheDocument();
    expect(screen.getByText(/Patrón puntos/)).toBeInTheDocument();
    expect(screen.getByText(/Patrón sólido/)).toBeInTheDocument();
    expect(screen.getByText(/Cero\./)).toHaveTextContent("Galápagos");
    expect(screen.getByText(/Ausencia de datos\./)).toBeInTheDocument();
  });

  it("marca la ausencia cuando no hay celdas", () => {
    render(
      <LeyendaCalor
        leyenda={{ ...leyenda, ausencia_datos: true, intervalos: [] }}
        zonasEnCero={[]}
        ejemplo={false}
      />,
    );
    expect(screen.getByText(/Esta selección no tiene celdas/)).toBeInTheDocument();
    expect(screen.getByText(/No hay intervalos numéricos/)).toBeInTheDocument();
  });
});
