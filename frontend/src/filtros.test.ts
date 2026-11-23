import { describe, expect, it } from "vitest";
import { borradorDesdeParametros, consultaApi, hayFiltros, quitarCampo, restablecerParametros } from "./filtros";

describe("filtros del mapa", () => {
  it("traduce el foco de provincia a la zona de la API y combina con Y", () => {
    const params = new URLSearchParams("provincia=loja&attr_agencia=Agencia+Norte&q=loja");
    const borrador = borradorDesdeParametros(params);
    expect(borrador.zonas).toEqual(["loja"]);
    expect(consultaApi(borrador)).toBe("?zona=loja&agencia=Agencia+Norte");
    expect(hayFiltros(borrador)).toBe(true);
  });

  it("restablecer quita los filtros y conserva la búsqueda de la tira", () => {
    const params = new URLSearchParams("zona=loja&zona=guayas&attr_provincia=Loja&q=oro&fecha_desde=2024-01-01");
    const limpios = restablecerParametros(params);
    expect(limpios.getAll("zona")).toEqual([]);
    expect(limpios.get("provincia")).toBeNull();
    expect(limpios.get("fecha_desde")).toBeNull();
    expect(limpios.get("q")).toBe("oro");
    expect(hayFiltros(quitarCampo(borradorDesdeParametros(params), "zona"))).toBe(true);
  });
});
