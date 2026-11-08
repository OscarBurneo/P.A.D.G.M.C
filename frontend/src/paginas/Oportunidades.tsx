import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TablaZonas, type FilaZona } from "../componentes/TablaZonas";
import { CANTONES_EJEMPLO } from "../datos/ejemplo";
import { useEjemplo } from "../ejemplo";

export function Oportunidades() {
  const ejemplo = useEjemplo();
  const [params] = useSearchParams();
  const consulta = (params.get("q") ?? "").trim().toLocaleLowerCase("es");
  const filas = useMemo<FilaZona[]>(() => {
    if (!ejemplo.activo) {
      return [];
    }
    return CANTONES_EJEMPLO.filter((canton) =>
      [canton.provincia, canton.nombre, canton.nivel].some((texto) => texto.toLocaleLowerCase("es").includes(consulta)),
    )
      .slice()
      .sort((a, b) => b.indice - a.indice)
      .map((canton) => ({
        codigo: canton.codigoProvincia,
        provincia: canton.provincia,
        canton: canton.nombre,
        socios: canton.socios,
        indice: canton.indice,
        crecimiento: canton.crecimiento,
        nivel: canton.nivel,
      }));
  }, [consulta, ejemplo.activo]);

  return (
    <section className="tablero">
      <header className="encabezado-pagina">
        <div>
          <p className="sobrelinea">Priorización</p>
          <h1>Oportunidades</h1>
          <p className="lead">
            Las zonas se agrupan por provincia y cantón. El índice comercial se calculará cuando existan registros importados.
          </p>
        </div>
        <Link className="boton secundario" to="/mapa">
          Ver en el mapa
        </Link>
      </header>
      {ejemplo.activo ? (
        <TablaZonas filas={filas} />
      ) : (
        <article className="tarjeta">
          <h2>Sin oportunidades calculadas</h2>
          <p>No hay registros de socios. El modelo predictivo tampoco está en producción.</p>
          <button type="button" onClick={() => ejemplo.cambiar(true)}>
            Mostrar la vista de ejemplo
          </button>
        </article>
      )}
    </section>
  );
}
