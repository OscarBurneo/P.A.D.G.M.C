import { describe, expect, it } from "vitest";
import { textoDensidadKm2, textoSinZona } from "./formato";

describe("densidad provincial", () => {
  it("escribe la densidad por kilómetro cuadrado", () => {
    expect(textoDensidadKm2(null)).toBe("");
    expect(textoDensidadKm2(undefined)).toBe("");
    expect(textoDensidadKm2(0.0002)).toBe(`${(0.0002).toLocaleString("es-EC", { maximumFractionDigits: 4 })} /km²`);
  });

  it("cuenta los registros que no caen en una provincia", () => {
    expect(textoSinZona(0)).toBe("0 registros no intersectan ninguna provincia.");
    expect(textoSinZona(3)).toBe("3 registros no intersectan ninguna provincia.");
  });
});
