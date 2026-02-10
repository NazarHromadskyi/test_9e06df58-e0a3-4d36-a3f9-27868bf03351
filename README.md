# Campaign Reports API

NestJS service for ingesting campaign reports from Probation API, storing them in PostgreSQL, and returning aggregated analytics.

## Current Architecture

The app runs in two processes:

1. **API process** (`src/main.ts`)  
   Exposes HTTP endpoints, enqueues long-running fetch jobs, returns `202 Accepted` with a `job_id`.
2. **Worker process** (`src/worker.ts`)  
   Listens to BullMQ queue in Redis, fetches/processes Probation data in background, writes to DB.

Both processes share:
- PostgreSQL (data)
- Redis (BullMQ queue + cache)
- common core module logic (`CampaignReportsCoreModule`)

### Module layering (`campaign-reports`)

- `CampaignReportsModule` = HTTP facade (controller only)
- `CampaignReportsCoreModule` = core/business layer (services, repository, queue wiring, Probation integration)

This keeps HTTP concerns separate from background processing logic.

## Key Features

- Async background ingestion via BullMQ (`POST /campaign-reports/fetch`)
- Deterministic job deduplication by request payload
- Job status polling and cancel endpoint
- Upsert into PostgreSQL with transactional batches
- Aggregated reports endpoint with Redis-backed caching

## Tech Stack

- NestJS
- TypeORM + PostgreSQL
- BullMQ + Redis
- RxJS
- Docker / Docker Compose

## Prerequisites

- Node.js 20+
- npm
- Docker + Docker Compose

## Setup

```bash
cp .env.example .env
npm install
```

## Run

### Docker Compose (recommended)

Starts `postgres`, `redis`, `app`, and `worker`:

```bash
docker compose up -d
docker compose logs -f app worker
```

Stop:

```bash
docker compose down
```

### Local development

Start infra only:

```bash
docker compose up -d postgres redis
```

Run API and worker in separate terminals:

```bash
npm run start:dev
npm run start:worker
```

## API Endpoints

Swagger: `http://localhost:3000/api/docs`

### `POST /campaign-reports/fetch`

Enqueue fetch job and return immediately.

Request:

```json
{
  "from_date": "2024-01-01 00:00:00",
  "to_date": "2024-01-31 23:00:00",
  "event_name": "install",
  "take": 1000
}
```

Response (`202`):

```json
{
  "success": true,
  "message": "Fetch job enqueued",
  "data": {
    "job_id": "cr_fetch_...",
    "deduped": false,
    "status_url": "/campaign-reports/fetch/cr_fetch_..."
  }
}
```

### `GET /campaign-reports/fetch/:jobId`

Get job state/progress/result.

### `POST /campaign-reports/fetch/:jobId/cancel`

Cancel queued job (cannot cancel `active` jobs).

### `GET /campaign-reports/aggregated`

Aggregated counts by `ad_id` and date, with pagination.

Query params:
- `from_date` (required)
- `to_date` (required)
- `event_name` (required)
- `take` (optional, default `10`)
- `page` (optional, default `1`)

### `GET /campaign-reports/stats`

Returns total stored records.

### Health

- `GET /health`
- `GET /health/liveness`
- `GET /health/readiness`

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | API port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `DB_DATABASE` | PostgreSQL database | `campaign_reports` |
| `REDIS_HOST` | Redis host | empty in dev (`in-memory cache fallback`) |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_DB` | Redis DB index | `0` |
| `REDIS_PASSWORD` | Redis password | empty |
| `PROBATION_API_URL` | Probation API base URL | `https://probation.impulseapi.link` |
| `PROBATION_API_KEY` | Probation API key | required for fetch |

## Scripts

```bash
npm run build
npm run start:dev
npm run start:prod
npm run start:worker
npm run start:worker:prod
npm run test
npm run lint
```

## Project Structure

```text
src/
  main.ts
  worker.ts
  app.module.ts
  worker.module.ts
  infrastructure/
    infrastructure.module.ts
  database/
    database.module.ts
    migrations/
  modules/
    campaign-reports/
      campaign-reports.module.ts         # HTTP facade
      campaign-reports-core.module.ts    # core/business module
      campaign-reports.controller.ts
      campaign-reports.service.ts
      campaign-reports-cache.service.ts
      jobs/
        campaign-reports-fetch.constants.ts
        campaign-reports-fetch-jobs.service.ts
        campaign-reports-fetch.processor.ts
      dto/
      entities/
      repositories/
    probation/
      probation.module.ts
      probation.client.ts
      probation.service.ts
    health/
      health.module.ts
      health.controller.ts
```
