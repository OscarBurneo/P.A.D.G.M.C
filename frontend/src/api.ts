export type Rol = { codigo: string; nombre: string };

export type Cuenta = {
  id: string;
  identificador: string;
  nombre: string;
  correo: string;
  activo: boolean;
  rol: Rol;
  permisos?: string[];
  creado_en?: string;
};

export type ErrorCampo = { campo: string; mensaje: string };

export class ErrorApi extends Error {
  estado: number;
  errores: ErrorCampo[];

  constructor(detalle: string, estado: number, errores: ErrorCampo[] = []) {
    super(detalle);
    this.estado = estado;
    this.errores = errores;
  }
}

const base = import.meta.env.VITE_API_BASE ?? "";

export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const encabezados = new Headers(opciones.headers);
  if (opciones.body && !encabezados.has("Content-Type")) {
    encabezados.set("Content-Type", "application/json");
  }
  const respuesta = await fetch(`${base}${ruta}`, {
    ...opciones,
    headers: encabezados,
    credentials: "include",
  });
  if (respuesta.status === 204) {
    return undefined as T;
  }
  const cuerpo = (await respuesta.json().catch(() => ({}))) as {
    detalle?: string;
    errores?: ErrorCampo[];
  };
  if (!respuesta.ok) {
    const extra = (cuerpo.errores ?? [])
      .map((error) => `${error.campo}: ${error.mensaje}`)
      .join(" ");
    throw new ErrorApi(extra || cuerpo.detalle || "No se pudo completar la operación.", respuesta.status);
  }
  return cuerpo as T;
}
