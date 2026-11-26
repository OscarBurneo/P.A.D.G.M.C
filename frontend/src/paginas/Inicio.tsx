import { Dashboard } from "./Dashboard";
import { puede, useSesion } from "../sesion";

export function Inicio() {
  const { cuenta } = useSesion();
  if (!puede(cuenta, "mapas.ver")) {
    return <p className="aviso">Su rol no consulta el resumen analítico.</p>;
  }
  return <Dashboard />;
}
