"""Catálogos propuestos del Sprint 0.

La matriz, los campos de cuenta y los parámetros marcados como
``pendiente_de_aprobacion`` no constituyen un acuerdo del cliente (P-02, P-09).
"""

ESTADO_PENDIENTE = "pendiente_de_aprobacion"
VERSION_MATRIZ_INICIAL = "0.1.0-propuesta"

ROLES: tuple[tuple[str, str, str], ...] = (
    (
        "administrador",
        "Administrador",
        "Gestiona cuentas, roles, permisos, auditoría y parámetros.",
    ),
    (
        "usuario",
        "Usuario registrado",
        "Consulta las vistas habilitadas para su rol, sin datos personales ni puntos individuales.",
    ),
)

# codigo, nombre, modulo, descripcion
PERMISOS: tuple[tuple[str, str, str, str], ...] = (
    ("sesion.cerrar", "Cerrar la propia sesión", "auth", "Invalida la sesión actual en el servidor."),
    ("usuarios.leer", "Consultar cuentas", "usuarios", "Lista y consulta cuentas sin datos secretos."),
    ("usuarios.crear", "Crear cuentas", "usuarios", "Da de alta una cuenta del diccionario propuesto."),
    ("usuarios.editar", "Editar cuentas", "usuarios", "Modifica solo los campos editables."),
    ("usuarios.desactivar", "Desactivar cuentas", "usuarios", "Desactiva una cuenta y revoca sus sesiones."),
    ("roles.leer", "Consultar roles", "autorizacion", "Consulta el catálogo de roles."),
    ("roles.asignar", "Asignar roles", "autorizacion", "Cambia el rol de una cuenta."),
    ("permisos.leer", "Consultar permisos", "autorizacion", "Consulta la matriz de permisos."),
    ("permisos.editar", "Modificar permisos", "autorizacion", "Modifica permisos por rol, sin excepciones por cuenta."),
    ("auditoria.leer", "Consultar auditoría", "auditoria", "Consulta eventos inmutables."),
    ("mapas.ver", "Ver mapa agregado", "mapas", "Consulta el mapa sin coordenadas individuales."),
    ("mapas.detalle", "Ver detalle de mapa", "mapas", "Consulta el detalle reservado al administrador."),
    (
        "ubicaciones.consultar",
        "Consultar ubicaciones agregadas",
        "ubicaciones",
        "Consulta el agregado geográfico sin coordenadas individuales.",
    ),
    ("parametros.leer", "Consultar parámetros", "admin", "Consulta parámetros de negocio, nunca secretos."),
    ("parametros.editar", "Modificar parámetros", "admin", "Modifica parámetros dentro del catálogo propuesto."),
    ("analitica.ejemplo", "Ejecutar proceso de ejemplo", "analitica", "Ejecuta el proceso analítico de demostración."),
    (
        "importaciones.cargar",
        "Cargar importaciones",
        "importaciones",
        "Reservado para la carga CSV/XLSX de un sprint posterior.",
    ),
    (
        "validacion.consultar",
        "Consultar validación",
        "validacion",
        "Reservado para el informe de validación de un sprint posterior.",
    ),
)

PERMISOS_USUARIO = (
    "sesion.cerrar",
    "mapas.ver",
    "ubicaciones.consultar",
)

PERMISOS_ADMINISTRADOR = tuple(item[0] for item in PERMISOS)

MATRIZ_INICIAL: dict[str, tuple[str, ...]] = {
    "administrador": PERMISOS_ADMINISTRADOR,
    "usuario": PERMISOS_USUARIO,
}

# No se retiran: evitan dejar la plataforma sin gobierno de cuentas.
PERMISOS_IRREVOCABLES_ADMINISTRADOR = frozenset(
    {
        "usuarios.leer",
        "usuarios.crear",
        "usuarios.editar",
        "usuarios.desactivar",
        "roles.leer",
        "roles.asignar",
        "permisos.leer",
        "permisos.editar",
    }
)

# Toda cuenta autenticada puede cerrar su propia sesión.
PERMISOS_OBLIGATORIOS_EN_TODO_ROL = frozenset({"sesion.cerrar"})

PARAMETROS: dict[str, dict[str, object]] = {
    "sesion_inactividad_minutos": {
        "tipo": "entero",
        "minimo": 5,
        "maximo": 720,
        "defecto": 30,
        "descripcion": "Minutos sin actividad tras los cuales la sesión queda invalidada.",
        "estado_aprobacion": ESTADO_PENDIENTE,
        "pendiente": "P-09",
    },
    "sesion_duracion_maxima_horas": {
        "tipo": "entero",
        "minimo": 1,
        "maximo": 72,
        "defecto": 8,
        "descripcion": "Horas máximas de vida de una sesión desde su creación.",
        "estado_aprobacion": ESTADO_PENDIENTE,
        "pendiente": "P-09",
    },
    "contrasena_longitud_minima": {
        "tipo": "entero",
        "minimo": 8,
        "maximo": 128,
        "defecto": 10,
        "descripcion": "Longitud mínima de la contraseña. También exige letras y números.",
        "estado_aprobacion": ESTADO_PENDIENTE,
        "pendiente": "P-09",
    },
    "proteger_ultima_cuenta_administradora": {
        "tipo": "booleano",
        "defecto": True,
        "descripcion": ("Impide desactivar o quitar el rol administrador a la última cuenta administradora activa."),
        "estado_aprobacion": ESTADO_PENDIENTE,
        "pendiente": "P-09",
    },
}

CAMPOS_CUENTA = {
    "estado_aprobacion": ESTADO_PENDIENTE,
    "pendiente": "P-09",
    "identificador": "Único, inmutable, de 3 a 80 caracteres (letras, números, . _ @ -).",
    "campos_editables": ["nombre", "correo", "contrasena"],
    "campos_no_editables": ["identificador", "hash_contrasena"],
    "desactivacion": "Operación aparte. Revoca todas las sesiones. No hay reactivación en el Sprint 0.",
}
