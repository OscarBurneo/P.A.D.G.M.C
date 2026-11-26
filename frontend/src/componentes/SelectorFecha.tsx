import { useEffect, useId, useRef, useState } from "react";
import { DayPicker, type Matcher } from "react-day-picker";
import { es } from "react-day-picker/locale";
import "react-day-picker/style.css";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function fechaLocal(iso: string) {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, (mes || 1) - 1, dia || 1);
}

export function aIso(fecha: Date) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function etiquetaFecha(iso: string) {
  const fecha = fechaLocal(iso);
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

export function limitesFecha(fechas: string[], minimo?: string, maximo?: string) {
  const ordenadas = [...new Set(fechas.filter((fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha)))].sort();
  if (ordenadas.length === 0) {
    return { desde: null, hasta: null };
  }
  let desde = ordenadas[0];
  let hasta = ordenadas[ordenadas.length - 1];
  if (minimo && minimo > desde) {
    desde = minimo;
  }
  if (maximo && maximo < hasta) {
    hasta = maximo;
  }
  if (desde > hasta) {
    return { desde: null, hasta: null };
  }
  return { desde, hasta };
}

function inicioDeMes(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

function sumarMeses(fecha: Date, cantidad: number) {
  return new Date(fecha.getFullYear(), fecha.getMonth() + cantidad, 1);
}

function acotarMes(destino: Date, piso: Date, techo: Date) {
  if (destino < piso) {
    return piso;
  }
  if (destino > techo) {
    return techo;
  }
  return destino;
}

export function SelectorFecha({
  etiqueta,
  valor,
  fechas,
  minimo,
  maximo,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  fechas: string[];
  minimo?: string;
  maximo?: string;
  onChange: (valor: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const tituloId = useId();
  const limites = limitesFecha(fechas, minimo, maximo);
  const piso = limites.desde ? inicioDeMes(fechaLocal(limites.desde)) : null;
  const techo = limites.hasta ? inicioDeMes(fechaLocal(limites.hasta)) : null;
  const [mes, setMes] = useState(() => inicioDeMes(fechaLocal(valor || limites.desde || aIso(new Date()))));
  const resumen = valor ? etiquetaFecha(valor) : "Todos";

  useEffect(() => {
    if (!abierto) {
      return;
    }
    setMes(inicioDeMes(fechaLocal(valor || limites.desde || aIso(new Date()))));
    const marco = window.requestAnimationFrame(() => {
      const dia = caja.current?.querySelector<HTMLButtonElement>(
        "button[data-selected], button.rdp-day_button:not(:disabled)",
      );
      (dia ?? disparador.current)?.focus();
    });
    function fuera(evento: MouseEvent) {
      if (!caja.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }
    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAbierto(false);
        disparador.current?.focus();
      }
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      window.cancelAnimationFrame(marco);
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto, limites.desde, valor]);

  function mover(cantidad: number) {
    if (!piso || !techo) {
      return;
    }
    setMes((actual) => acotarMes(sumarMeses(actual, cantidad), piso, techo));
  }

  function puedeMover(cantidad: number) {
    if (!piso || !techo) {
      return false;
    }
    const destino = acotarMes(sumarMeses(mes, cantidad), piso, techo);
    return destino.getFullYear() !== mes.getFullYear() || destino.getMonth() !== mes.getMonth();
  }

  const inhabilitado: Matcher | Matcher[] = limites.desde && limites.hasta
    ? [{ before: fechaLocal(limites.desde) }, { after: fechaLocal(limites.hasta) }]
    : true;

  return (
    <div className="selector-fecha" ref={caja}>
      <span className="selector-fecha-etiqueta" id={tituloId}>
        {etiqueta}
      </span>
      <button
        ref={disparador}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`${etiqueta}: ${resumen}`}
        onClick={() => setAbierto((estado) => !estado)}
      >
        {resumen}
      </button>
      {abierto ? (
        <div className="selector-fecha-popover" role="dialog" aria-label={etiqueta}>
          <div className="selector-fecha-nav">
            <button type="button" aria-label="Año anterior" disabled={!puedeMover(-12)} onClick={() => mover(-12)}>
              «
            </button>
            <button type="button" aria-label="Mes anterior" disabled={!puedeMover(-1)} onClick={() => mover(-1)}>
              ‹
            </button>
            <strong aria-live="polite">
              {MESES[mes.getMonth()]} {mes.getFullYear()}
            </strong>
            <button type="button" aria-label="Mes siguiente" disabled={!puedeMover(1)} onClick={() => mover(1)}>
              ›
            </button>
            <button type="button" aria-label="Año siguiente" disabled={!puedeMover(12)} onClick={() => mover(12)}>
              »
            </button>
          </div>
          {limites.desde ? (
            <DayPicker
              mode="single"
              locale={es}
              month={mes}
              onMonthChange={(siguiente) => setMes(inicioDeMes(siguiente))}
              selected={valor ? fechaLocal(valor) : undefined}
              onSelect={(dia) => {
                if (!dia) {
                  return;
                }
                onChange(aIso(dia));
                setAbierto(false);
                disparador.current?.focus();
              }}
              disabled={inhabilitado}
              startMonth={piso ?? undefined}
              endMonth={techo ?? undefined}
              hideNavigation
              labels={{
                labelDayButton: (fecha) => {
                  const texto = etiquetaFecha(aIso(fecha));
                  return aIso(fecha) === valor ? `${texto}, seleccionado` : texto;
                },
              }}
            />
          ) : (
            <p>No hay fechas publicadas en este rango.</p>
          )}
          <button
            type="button"
            className="secundario"
            onClick={() => {
              onChange("");
              setAbierto(false);
              disparador.current?.focus();
            }}
          >
            Limpiar
          </button>
        </div>
      ) : null}
    </div>
  );
}
