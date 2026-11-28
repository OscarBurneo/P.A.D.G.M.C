import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectorFecha, limitesFecha } from "./SelectorFecha";

const fechas = ["2024-03-15", "2024-06-01", "2025-01-20"];

describe("selector de fecha", () => {
  it("calcula el rango publicado y lo recorta con el otro extremo", () => {
    expect(limitesFecha(fechas)).toEqual({ desde: "2024-03-15", hasta: "2025-01-20" });
    expect(limitesFecha(fechas, "2024-06-01")).toEqual({ desde: "2024-06-01", hasta: "2025-01-20" });
    expect(limitesFecha(fechas, undefined, "2024-04-02")).toEqual({ desde: "2024-03-15", hasta: "2024-04-02" });
    expect(limitesFecha([])).toEqual({ desde: null, hasta: null });
  });

  it("elige un día, impide los que quedan fuera y limpia la selección", async () => {
    const usuario = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectorFecha etiqueta="Fecha desde" valor="" fechas={fechas} maximo="2024-06-01" onChange={onChange} />,
    );

    await usuario.click(screen.getByRole("button", { name: "Fecha desde: Todos" }));
    expect(screen.getByRole("dialog", { name: "Fecha desde" })).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "marzo 2024" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "14 de marzo de 2024" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "15 de marzo de 2024" })).toBeEnabled();

    await usuario.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(screen.getByRole("grid", { name: "abril 2024" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Año siguiente" }));
    expect(screen.getByRole("grid", { name: "junio 2024" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 de junio de 2024" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "2 de junio de 2024" })).toBeDisabled();

    await usuario.click(screen.getByRole("button", { name: "Mes anterior" }));
    const dia = screen.getByRole("button", { name: "15 de mayo de 2024" });
    dia.focus();
    await usuario.keyboard("{ArrowRight}{Enter}");
    expect(onChange).toHaveBeenCalledWith("2024-05-16");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("limpia el valor y cierra con Escape", async () => {
    const usuario = userEvent.setup();
    const onChange = vi.fn();
    render(<SelectorFecha etiqueta="Fecha hasta" valor="2024-06-01" fechas={fechas} onChange={onChange} />);

    await usuario.click(screen.getByRole("button", { name: "Fecha hasta: 1 de junio de 2024" }));
    expect(screen.getByRole("button", { name: "1 de junio de 2024, seleccionado" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(onChange).toHaveBeenCalledWith("");

    await usuario.click(screen.getByRole("button", { name: "Fecha hasta: 1 de junio de 2024" }));
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fecha hasta: 1 de junio de 2024" })).toHaveFocus();
  });
});
