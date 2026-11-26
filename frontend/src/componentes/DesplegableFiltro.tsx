import { useEffect, useRef, useState } from "react";

export type OpcionFiltro = { valor: string; etiqueta: string };

export type DominiosFiltro = {
  provincia?: string[];
  canton?: string[];
  canton_por_provincia?: { provincia: string; canton: string }[];
  agencia?: string[];
  fecha?: string[];
  zona?: { codigo: string; nombre: string }[];
};

export function cantonesDe(dominios: DominiosFiltro | null | undefined, provinciasElegidas: string[]) {
  const pares = dominios?.canton_por_provincia ?? [];
  const lista = pares.length > 0 ? pares.map((par) => par.canton) : (dominios?.canton ?? []);
  const origen =
    pares.length > 0 && provinciasElegidas.length > 0
      ? pares.filter((par) => provinciasElegidas.includes(par.provincia)).map((par) => par.canton)
      : lista;
  return [...new Set(origen)].sort((a, b) => a.localeCompare(b, "es"));
}

export function DesplegableFiltro({
  etiqueta,
  opciones,
  seleccionados,
  multiple = false,
  onChange,
}: {
  etiqueta: string;
  opciones: OpcionFiltro[];
  seleccionados: string[];
  multiple?: boolean;
  onChange: (valores: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const resumen =
    seleccionados.length === 0
      ? "Todos"
      : opciones
          .filter((opcion) => seleccionados.includes(opcion.valor))
          .map((opcion) => opcion.etiqueta)
          .join(", ") || seleccionados.join(", ");

  useEffect(() => {
    if (!abierto) {
      return;
    }
    function fuera(evento: MouseEvent) {
      if (!caja.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }
    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  function elegirOpcion(valor: string | null) {
    if (valor === null) {
      onChange([]);
      setAbierto(false);
      return;
    }
    if (!multiple) {
      onChange([valor]);
      setAbierto(false);
      return;
    }
    onChange(seleccionados.includes(valor) ? seleccionados.filter((item) => item !== valor) : [...seleccionados, valor]);
  }

  return (
    <div className="desplegable" ref={caja}>
      <span className="desplegable-etiqueta">{etiqueta}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`${etiqueta}: ${resumen}`}
        onClick={() => setAbierto((valor) => !valor)}
      >
        {resumen}
      </button>
      {abierto ? (
        <ul role="listbox" aria-label={etiqueta} aria-multiselectable={multiple || undefined}>
          <li role="presentation">
            <button type="button" role="option" aria-selected={seleccionados.length === 0} onClick={() => elegirOpcion(null)}>
              Todos
            </button>
          </li>
          {opciones.length === 0 ? (
            <li role="presentation">
              <span>Sin valores publicados</span>
            </li>
          ) : (
            opciones.map((opcion) => (
              <li key={opcion.valor} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={seleccionados.includes(opcion.valor)}
                  onClick={() => elegirOpcion(opcion.valor)}
                >
                  {opcion.etiqueta}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
