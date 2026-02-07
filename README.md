# Campaign Reports API

NestJS application for fetching and analyzing advertising campaign reports from Probation API.

## Features

- Fetch campaign reports from external Probation API with automatic pagination
- Store reports in PostgreSQL with deduplication (upsert on conflict)
- Aggregate event counts by ad_id and date with pagination
- Redis-backed caching for aggregated reports (optional in development, required for multi-instance production)
- Docker containerization for easy deployment
- RxJS-based reactive data processing
- Comprehensive error handling and logging

## Tech Stack

- **NestJS** - Node.js framework
- **TypeORM** - ORM for PostgreSQL
- **PostgreSQL** - Database
- **RxJS** - Reactive programming
- **Docker** - Containerization

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd test_9e06df58-e0a3-4d36-a3f9-27868bf03351
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

## Running the Application

### Using Docker (recommended)

```bash
# Start all services (PostgreSQL + App)
docker-compose up -d

# View logs
docker-compose logs -f app
```

### Local Development

```bash
# Start only PostgreSQL
docker-compose up -d postgres

# Run migrations and start app
npm run start:dev
```

## API Endpoints

### POST /campaign-reports/fetch

Fetch campaign reports from Probation API and save to database.

**Request Body:**

```json
{
  "from_date": "2024-01-01 00:00:00",
  "to_date": "2024-01-31 23:00:00",
  "event_name": "install",
  "take": 1000
}
```

**Response:**

```json
{
  "success": true,
  "message": "Reports fetched and saved successfully",
  "data": {
    "total_processed": 1500,
    "duration_ms": 2345
  }
}
```

### GET /campaign-reports/aggregated

Get aggregated event counts by ad_id and date.

**Query Parameters:**

- `from_date` (required): Start date (YYYY-MM-DD)
- `to_date` (required): End date (YYYY-MM-DD)
- `event_name` (required): Event type (install | purchase)
- `take` (optional): Items per page (default: 10)
- `page` (optional): Page number (default: 1)

**Example:**

```
GET /campaign-reports/aggregated?from_date=2024-01-01&to_date=2024-01-31&event_name=install&take=10&page=1
```

**Response:**

```json
{
  "data": [
    {
      "ad_id": "ad_123",
      "date": "2024-01-15",
      "event_count": 150
    }
  ],
  "meta": {
    "page": 1,
    "take": 10,
    "total": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### GET /campaign-reports/stats

Get total record count.

**Response:**

```json
{
  "total_records": 15000
}
```

## Project Structure

```
src/
├── main.ts                          # Application entry point
├── app.module.ts                    # Root module
├── config/
│   ├── configuration.ts             # Environment configuration
│   └── env.validation.ts             # Environment validation schema
├── common/
│   ├── dto/
│   │   ├── pagination.dto.ts        # Pagination DTO
│   │   └── date-range.dto.ts        # Date range and event name DTOs
│   ├── filters/
│   │   └── http-exception.filter.ts  # Global exception filter
│   ├── interceptors/
│   │   └── logging.interceptor.ts    # Request logging
│   ├── operators/
│   │   └── retry-with-backoff.operator.ts  # RxJS retry with backoff
│   ├── parsers/
│   │   └── csv-report.parser.ts      # CSV streaming parser for Probation API
│   ├── utils/
│   │   └── date.utils.ts             # UTC date parsing and formatting
│   └── validators/
│       └── date-range.validator.ts   # Date range validation
├── database/
│   ├── database.module.ts            # TypeORM configuration
│   └── migrations/
│       ├── 1706700000000-CreateCampaignReports.ts
│       └── 1706700001000-AddAggregationIndex.ts
├── modules/
│   ├── campaign-reports/
│   │   ├── campaign-reports.module.ts
│   │   ├── campaign-reports.controller.ts
│   │   ├── campaign-reports.service.ts
│   │   ├── entities/
│   │   │   └── campaign-report.entity.ts
│   │   ├── repositories/
│   │   │   └── campaign-report.repository.ts
│   │   └── dto/
│   │       ├── fetch-reports.dto.ts
│   │       └── aggregated-reports.dto.ts
│   ├── health/
│   │   ├── health.module.ts
│   │   └── health.controller.ts
│   └── probation/
│       ├── probation.module.ts
│       ├── probation.service.ts
│       ├── probation.client.ts       # HTTP client for Probation API
│       └── interfaces/
│           └── probation-response.interface.ts
```

## Environment Variables

| Variable            | Description       | Default                           |
| ------------------- | ----------------- | --------------------------------- |
| `PORT`              | Application port  | 3000                              |
| `NODE_ENV`          | Environment       | development                       |
| `DB_HOST`           | PostgreSQL host   | localhost                         |
| `DB_PORT`           | PostgreSQL port   | 5432                              |
| `DB_USERNAME`       | Database username | postgres                          |
| `DB_PASSWORD`       | Database password | postgres                          |
| `DB_DATABASE`       | Database name     | campaign_reports                  |
| `PROBATION_API_URL` | Probation API URL | https://probation.impulseapi.link |
| `PROBATION_API_KEY` | Probation API key | -                                 |

## Scripts

```bash
npm run start:dev    # Development mode with hot reload
npm run start:prod   # Production mode
npm run build        # Build the application
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```
