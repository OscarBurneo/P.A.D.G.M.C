# Evidencia de percentil 95 de autenticación

Esta medición **no constituye aceptación** de RNF-13. La ficha de carga (P-06) no está aprobada.

- Fecha UTC: 2026-11-08T00:03:47+00:00
- URL: `http://127.0.0.1:8000/api/auth/iniciar-sesion`
- Muestras: 20
- Concurrencia: 1 (secuencial)
- Mínimo: 68.3 ms
- Mediana: 72.5 ms
- p95: 106.1 ms
- Máximo: 112.2 ms
- Objetivo propuesto, no aprobado: p95 < 3000 ms.
- Resultado de esta corrida: dentro del objetivo propuesto.
- Entorno: máquina de desarrollo; Argon2id t=3 m=65536 KiB p=2; una secuencia; sin concurrencia ni ficha aprobada

El script es `backend/scripts/carga_autenticacion.py`.
