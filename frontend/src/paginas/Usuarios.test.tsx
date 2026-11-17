import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi, type Cuenta } from "../api";
import { Usuarios } from "./Usuarios";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, api };
});

vi.mock("../sesion", () => ({
  useSesion: () => ({
    cuenta: {
      id: "1",
      identificador: "admin",
      nombre: "Administrador",
      correo: "admin@padgmc.example",
      activo: true,
      rol: { codigo: "administrador", nombre: "Administrador" },
      permisos: [
        "usuarios.leer",
        "usuarios.crear",
        "usuarios.desactivar",
        "roles.leer",
        "roles.asignar",
      ],
    },
    recargar: vi.fn(async () => undefined),
  }),
  puede: (cuenta: { permisos?: string[] } | null, permiso: string) => Boolean(cuenta?.permisos?.includes(permiso)),
}));

const ROLES = [
  { codigo: "administrador", nombre: "Administrador", descripcion: "Gestión total" },
  { codigo: "usuario", nombre: "Usuario registrado", descripcion: "Consulta" },
];

const admin: Cuenta = {
  id: "1",
  identificador: "admin",
  nombre: "Administrador",
  correo: "admin@padgmc.example",
  activo: true,
  rol: { codigo: "administrador", nombre: "Administrador" },
};

let cuentas: Cuenta[] = [];
let altaPendiente: Promise<unknown> | null = null;

function responder(ruta: string, init?: RequestInit) {
  if (ruta === "/api/roles") {
    return { roles: ROLES };
  }
  if (ruta === "/api/usuarios" && init?.method === "POST") {
    if (altaPendiente) {
      return altaPendiente;
    }
    const cuerpo = JSON.parse(String(init.body)) as {
      identificador: string;
      correo: string;
      nombre: string;
      rol_codigo: string;
    };
    const nueva: Cuenta = {
      id: "2",
      identificador: cuerpo.identificador,
      correo: cuerpo.correo,
      nombre: cuerpo.nombre,
      activo: true,
      rol: ROLES.find((rol) => rol.codigo === cuerpo.rol_codigo) ?? ROLES[1],
    };
    cuentas = [...cuentas, nueva];
    return nueva;
  }
  if (ruta === "/api/usuarios") {
    return { cuentas };
  }
  throw new Error(`Ruta no simulada: ${ruta}`);
}

function pintar() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Usuarios />
    </MemoryRouter>,
  );
}

async function abrirModal(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("admin@padgmc.example");
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
  return screen.getByRole("dialog", { name: "Nueva cuenta" });
}

describe("alta de cuentas", () => {
  beforeEach(() => {
    cuentas = [admin];
    altaPendiente = null;
    api.mockReset();
    api.mockImplementation((ruta: string, init?: RequestInit) => Promise.resolve(responder(ruta, init)));
  });

  afterEach(() => {
    cleanup();
    document.body.classList.remove("modal-abierto");
  });

  it("abre el modal centrado desde Crear cuenta", async () => {
    const user = userEvent.setup();
    pintar();
    const dialogo = await abrirModal(user);

    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveClass("modal-dialogo");
    expect(document.body).toHaveClass("modal-abierto");
    expect(within(dialogo).getByLabelText("Identificador")).toHaveFocus();
    expect(within(dialogo).getByLabelText("Nombre")).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Correo")).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Contraseña")).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Rol")).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nueva cuenta" })).toBe(within(dialogo).getByRole("heading", { name: "Nueva cuenta" }));
  });

  it("crea la cuenta, cierra el modal, refresca el listado y muestra la confirmación", async () => {
    const user = userEvent.setup();
    pintar();
    const dialogo = await abrirModal(user);
    await user.type(within(dialogo).getByLabelText("Identificador"), "ana.perez");
    await user.type(within(dialogo).getByLabelText("Nombre"), "Ana Pérez");
    await user.type(within(dialogo).getByLabelText("Correo"), "ana@ejemplo.com");
    await user.type(within(dialogo).getByLabelText("Contraseña"), "Clave12345");
    await user.click(within(dialogo).getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const aviso = screen.getByRole("status");
    expect(aviso).toHaveTextContent("Usuario creado: Ana Pérez (ana@ejemplo.com).");
    expect(screen.getByText("ana.perez")).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(
      "/api/usuarios",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          identificador: "ana.perez",
          correo: "ana@ejemplo.com",
          nombre: "Ana Pérez",
          contrasena: "Clave12345",
          rol_codigo: "usuario",
        }),
      }),
    );

    await user.click(within(aviso).getByRole("button", { name: "Cerrar confirmación" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("modal-abierto");
  });

  it("mantiene el modal abierto y muestra el error si el alta falla", async () => {
    api.mockImplementation((ruta: string, init?: RequestInit) => {
      if (ruta === "/api/usuarios" && init?.method === "POST") {
        return Promise.reject(new ErrorApi("El identificador ya existe.", 409));
      }
      return Promise.resolve(responder(ruta, init));
    });
    const user = userEvent.setup();
    pintar();
    const dialogo = await abrirModal(user);
    await user.type(within(dialogo).getByLabelText("Identificador"), "ana.perez");
    await user.type(within(dialogo).getByLabelText("Nombre"), "Ana Pérez");
    await user.type(within(dialogo).getByLabelText("Correo"), "ana@ejemplo.com");
    await user.type(within(dialogo).getByLabelText("Contraseña"), "Clave12345");
    await user.click(within(dialogo).getByRole("button", { name: "Crear cuenta" }));

    const alerta = await within(dialogo).findByRole("alert");
    expect(alerta).toHaveTextContent("El identificador ya existe.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Identificador")).toHaveValue("ana.perez");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("ana.perez")).not.toBeInTheDocument();
  });

  it("cierra con Escape o el fondo sin perder lo escrito, y no cierra mientras envía", async () => {
    const user = userEvent.setup();
    pintar();
    await screen.findByText("admin@padgmc.example");
    const abrir = screen.getByRole("button", { name: "Crear cuenta" });
    await user.click(abrir);
    const dialogo = screen.getByRole("dialog", { name: "Nueva cuenta" });
    await user.type(within(dialogo).getByLabelText("Identificador"), "borrador");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();

    await user.click(abrir);
    const reabierto = screen.getByRole("dialog", { name: "Nueva cuenta" });
    expect(within(reabierto).getByLabelText("Identificador")).toHaveValue("borrador");
    fireEvent.click(reabierto.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(abrir);
    const otraVez = screen.getByRole("dialog", { name: "Nueva cuenta" });
    expect(within(otraVez).getByLabelText("Identificador")).toHaveValue("borrador");

    let liberar: (valor: unknown) => void = () => undefined;
    altaPendiente = new Promise((resolver) => {
      liberar = resolver;
    });
    await user.type(within(otraVez).getByLabelText("Nombre"), "Borrador");
    await user.type(within(otraVez).getByLabelText("Correo"), "borrador@ejemplo.com");
    await user.type(within(otraVez).getByLabelText("Contraseña"), "Clave12345");
    await user.click(within(otraVez).getByRole("button", { name: "Crear cuenta" }));

    expect(within(otraVez).getByRole("button", { name: "Creando cuenta…" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(otraVez).getByLabelText("Identificador")).toHaveValue("borrador");

    liberar({ id: "3" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Usuario creado:");
  });
});
