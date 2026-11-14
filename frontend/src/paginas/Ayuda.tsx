import { Link } from "react-router-dom";
import { useMarca } from "../marca";

export function Ayuda() {
  const marca = useMarca();
  return (
    <div className="hoja ayuda">
      <article className="panel">
        <h2>Capítulos</h2>
        <p>
          La barra superior de {marca.nombre} numera las pantallas 01 a 06. Solo aparecen las que su rol puede usar. Roles,
          auditoría, parámetros y esta ayuda están en «Más», para no cortar los capítulos.
        </p>
        <p>
          En pantallas estrechas los capítulos pasan a la línea siguiente con el texto completo. No quedan escondidos fuera
          del borde.
        </p>
      </article>
      <article className="panel">
        <h2>Bitácora y provincia en foco</h2>
        <p>
          El panel derecho se abre solo en pantallas anchas y se puede ocultar. En el teléfono queda encima del contenido.
          La provincia y la zona en foco salen de lo que usted elige en el atlas. Si no hay selección, el panel queda vacío:
          no muestra una provincia fija.
        </p>
      </article>
      <article className="panel">
        <h2>Datos de ejemplo</h2>
        <p>
          Mientras no existan socios importados, el resumen puede mostrar una vista de ejemplo. Esa vista lleva un aviso
          permanente y la etiqueta «Ejemplo». «Ver solo datos reales» deja los indicadores sin cifras inventadas.
        </p>
      </article>
      <article className="panel">
        <h2>Mapa del Ecuador</h2>
        <p>
          El atlas usa el mapa real: Ecuador continental, recuadro de Galápagos y capas de densidad, registros y agencias.
          Sin socios importados, densidad y registros no dibujan puntos. Las agencias salen de la cobertura configurada.
          El filtro de cantón se activará cuando haya contornos cantonales.
        </p>
        <p>
          <Link to="/mapa">Abrir el atlas</Link>
        </p>
      </article>
      <article className="panel">
        <h2>Cobertura</h2>
        <p>
          La lista de provincias con agencia se guarda en la base. Quien administra la configuración puede activar o quitar
          provincias. La propuesta inicial cubre Loja, El Oro, Zamora Chinchipe, Pichincha (incluye el Distrito
          Metropolitano de Quito), Santo Domingo de los Tsáchilas, Manabí, Chimborazo y Guayas.
        </p>
      </article>
    </div>
  );
}
