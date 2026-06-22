# Radar de Licitaciones

SaaS que vigila **SECOP II** por las pymes y les avisa qué procesos públicos pueden
ganar, con un panel (mini-CRM) para gestionar sus postulaciones.

De **Brandsoft / Aura Sabor**.

## Arquitectura

```
frontend/   Next.js + Tailwind  ·  landing de ventas + app (login, panel, oportunidades)
backend/    FastAPI (Python)     ·  auth, planes, API de oportunidades, lógica de filtros
backend/worker/  Rastreador      ·  consulta SECOP II en segundo plano y dispara alertas
PostgreSQL  base multiusuario
```

| Pieza                              | Estado |
|------------------------------------|--------|
| Conexión a la API de SECOP II      | esqueleto (`app/services/secop.py`) |
| Filtro por ciudad/sector/keywords  | esqueleto (`app/services/matching.py`) |
| Almacenamiento + detección de nuevos| esqueleto (worker + modelos) |
| Notificación correo / WhatsApp     | esqueleto (`app/services/notificaciones.py`) |
| Login / cuentas / planes           | esqueleto (`app/api/routes/auth.py`) |
| Panel CRM + landing                | esqueleto (`frontend/`) |
| Pasarela de pagos                  | Fase 2 |

## Arranque rápido (desarrollo local)

### 1. Base de datos

```bash
docker compose up -d        # levanta Postgres en localhost:5432
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # ajusta secretos si quieres
uvicorn app.main:app --reload
```

API y documentación automática en http://localhost:8000/docs

### 3. Worker (rastreador SECOP)

```bash
cd backend
source .venv/bin/activate
python -m worker.rastreador          # corre una pasada y termina
python -m worker.rastreador --loop   # corre en bucle (cada SECOP_POLL_SECONDS)
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:3000
```

## Roadmap

- **Fase 1 — MVP:** login, panel, alertas por correo. (este esqueleto)
- **Fase 2 — Producto:** WhatsApp, pasarela de pagos (Wompi/Mercado Pago), multiusuario.
- **Fase 3 — Escala:** IA que evalúa/ayuda a redactar la oferta, analítica de competencia.
