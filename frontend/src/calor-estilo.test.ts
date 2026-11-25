import { describe, expect, it } from "vitest";
import {
  PARADAS_OPACIDAD_CALOR,
  PARADAS_OPACIDAD_PUNTO,
  PARADAS_RADIO_CALOR,
  fichaPunto,
  valorEnZoom,
} from "./calor-estilo";

describe("escala del calor", () => {
  it("mantiene un radio corto y no lo agranda sin medida al acercar", () => {
    const enPais = valorEnZoom(PARADAS_RADIO_CALOR, 6);
    const enProvincia = valorEnZoom(PARADAS_RADIO_CALOR, 8);
    const alAcercar = valorEnZoom(PARADAS_RADIO_CALOR, 12);
    expect(enPais).toBe(10);
    expect(enProvincia).toBe(14);
    expect(alAcercar).toBe(22);
    expect(alAcercar).toBeLessThan(30);
    expect(alAcercar / enPais).toBeLessThan(2.5);
  });

  it("apaga el calor y enciende los puntos entre el zoom 10 y el 11", () => {
    expect(valorEnZoom(PARADAS_OPACIDAD_CALOR, 8)).toBe(0.8);
    expect(valorEnZoom(PARADAS_OPACIDAD_CALOR, 12)).toBe(0);
    expect(valorEnZoom(PARADAS_OPACIDAD_PUNTO, 9)).toBe(0);
    expect(valorEnZoom(PARADAS_OPACIDAD_PUNTO, 11)).toBe(0.95);
    expect(valorEnZoom(PARADAS_OPACIDAD_PUNTO, 10.25)).toBeGreaterThan(0);
    expect(valorEnZoom(PARADAS_OPACIDAD_PUNTO, 10.25)).toBeLessThan(0.95);
  });

  it("la ficha del punto solo lleva provincia, cantón, agencia y fecha", () => {
    const lineas = fichaPunto({
      provincia: "Loja",
      canton: "Catamayo",
      agencia: "Agencia Centro",
      fecha: "2024-03-15",
      nombre: "Ana Pérez",
      identificador_socio: "SIN-000001",
    });
    expect(lineas).toEqual([
      "Provincia: Loja",
      "Cantón: Catamayo",
      "Agencia: Agencia Centro",
      "Fecha: 2024-03-15",
    ]);
    expect(lineas.join(" ")).not.toMatch(/Ana|SIN-/);
  });
});