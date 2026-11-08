"""Aplicación FastAPI del monolito modular."""

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.base_datos import SesionLocal
from app.configuracion import ajustes
from app.correlacion import fijar_correlacion
from app.errores import ErrorAplicacion
from app.modulos.admin.rutas import router as router_admin
from app.modulos.analitica.rutas import router as router_analitica
from app.modulos.auditoria.rutas import router as router_auditoria
from app.modulos.auditoria.servicio import registrar
from app.modulos.auth.rutas import router as router_auth
from app.modulos.auth.servicio import resolver_sesion
from app.modulos.autorizacion.rutas import router as router_autorizacion
from app.modulos.importaciones.rutas import router as router_importaciones
from app.modulos.mapas.rutas import router as router_mapas
from app.modulos.salud.rutas import router as router_salud
from app.modulos.ubicaciones.rutas import router as router_ubicaciones
from app.modulos.usuarios.rutas import router as router_usuarios
from app.modulos.validacion.rutas import router as router_validacion
from app.semilla import sembrar
from app.textos import MENSAJE_VALIDACION


@asynccontextmanager
async def ciclo_vida(_: FastAPI):
    if ajustes.sembrar_al_iniciar:
        db = SesionLocal()
        try:
            sembrar(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title="P.A.D.G.M.C",
    summary="Plataforma de análisis de datos geoespaciales con mapas de calor",
    description=(
        "Sprint 0 para la Cooperativa de Ahorro y Crédito Padre Julián Lorente (Loja). "
        "Las políticas marcadas como pendiente de aprobación no son un acuerdo del cliente."
    ),
    version="0.1.0",
    lifespan=ciclo_vida,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ajustes.origenes_cors,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def correlacion(request: Request, call_next):
    entrante = request.headers.get("x-correlacion-id", "")
    try:
        valor = str(uuid.UUID(entrante)) if entrante else str(uuid.uuid4())
    except ValueError:
        valor = str(uuid.uuid4())
    fijar_correlacion(valor)
    respuesta = await call_next(request)
    respuesta.headers["X-Correlacion-Id"] = valor
    return respuesta


@app.exception_handler(ErrorAplicacion)
async def manejar_error(_: Request, exc: ErrorAplicacion) -> JSONResponse:
    return JSONResponse(
        status_code=exc.estado,
        content={"detalle": exc.detalle, "codigo": exc.codigo},
    )


@app.exception_handler(RequestValidationError)
async def manejar_validacion(request: Request, exc: RequestValidationError) -> JSONResponse:
    _auditar_validacion(request)
    errores = []
    for error in exc.errors():
        partes = [str(parte) for parte in error.get("loc", []) if parte != "body"]
        errores.append({"campo": ".".join(partes) or "cuerpo", "mensaje": error.get("msg", "dato inválido")})
    return JSONResponse(
        status_code=422,
        content={"detalle": MENSAJE_VALIDACION, "errores": errores},
    )


def _auditar_validacion(request: Request) -> None:
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return
    token = request.cookies.get(ajustes.cookie_nombre)
    if not token:
        return
    db = SesionLocal()
    try:
        usuario = resolver_sesion(db, token, tocar=False)
        if usuario is None:
            return
        registrar(
            db,
            actor_tipo="usuario",
            actor_id=usuario.id,
            actor_etiqueta=usuario.identificador,
            operacion="solicitud.invalida",
            entidad_tipo="solicitud",
            entidad_id=request.url.path[:80],
            resultado="fallo",
            codigo_error="validacion",
            despues={"metodo": request.method},
            mensaje="Datos inválidos. El cuerpo no se guarda.",
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@app.get("/")
def raiz() -> dict:
    return {
        "nombre": "P.A.D.G.M.C",
        "descripcion": "Plataforma de análisis de datos geoespaciales con mapas de calor",
        "salud": "/api/salud",
        "documentacion": "/docs",
    }


app.include_router(router_salud)
app.include_router(router_auth)
app.include_router(router_usuarios)
app.include_router(router_autorizacion)
app.include_router(router_auditoria)
app.include_router(router_mapas)
app.include_router(router_ubicaciones)
app.include_router(router_importaciones)
app.include_router(router_validacion)
app.include_router(router_analitica)
app.include_router(router_admin)
