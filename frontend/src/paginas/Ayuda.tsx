import { Link } from "react-router-dom";
import { useMarca } from "../marca";

export function Ayuda() {
  const marca = useMarca();
  return (
    <section className="panel ancho">
      <p className="sobrelinea">Centro de ayuda</p>
      <h1>Cómo usar {marca.nombre}</h1>
      <article>
        <h2>Barra lateral</h2>
        <p>
          Puede contraerla a iconos en pantallas anchas. En el teléfono se abre con el botón de menú. Solo aparecen las
          secciones que su rol puede usar.
        </p>
      </article>
      <article>
        <h2>Datos de ejemplo</h2>
        <p>
          Mientras no existan socios importados, el resumen puede mostrar una vista de ejemplo. Esa vista lleva un aviso
          permanente y la etiqueta «Ejemplo» en cada indicador. «Ver solo datos reales» deja los indicadores en cero.
        </p>
      </article>
      <article>
        <h2>Mapa del Ecuador</h2>
        <p>
          La vista inicial encuadra el continente. Galápagos queda en un recuadro. Las provincias con agencia se resaltan
          y puede acercar cualquiera desde la lista o el selector. El filtro de cantón se activará cuando haya contornos
          cantonales.
        </p>
        <p>
          <Link to="/mapa">Abrir el mapa</Link>
        </p>
      </article>
      <article>
        <h2>Cobertura</h2>
        <p>
          La lista de provincias con agencia se guarda en la base, no en el código de las pantallas. Quien administra la
          configuración puede activar o quitar provincias. La propuesta inicial cubre Loja, El Oro, Zamora Chinchipe,
          Pichincha (incluye el Distrito Metropolitano de Quito), Santo Domingo de los Tsáchilas, Manabí, Chimborazo y
          Guayas.
        </p>
      </article>
    </section>
  );
}
