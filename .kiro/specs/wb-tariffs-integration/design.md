# Design Document

## Overview

Сервис представляет собой Node.js приложение на TypeScript, которое выполняет три основные функции:
1. Периодическое получение данных о тарифах из WB API
2. Сохранение и обновление данных в PostgreSQL
3. Синхронизация данных с Google Sheets

Приложение работает в Docker контейнерах и использует планировщик задач для выполнения операций по расписанию.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose                          │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │   PostgreSQL         │      │   App Container      │    │
│  │   Container          │◄─────┤                      │    │
│  │                      │      │  ┌────────────────┐  │    │
│  │  - Port: 5432        │      │  │   Scheduler    │  │    │
│  │  - Volume: postgres  │      │  │   (node-cron)  │  │    │
│  └──────────────────────┘      │  └────────┬───────┘  │    │
│                                │           │          │    │
│                                │  ┌────────▼───────┐  │    │
│                                │  │ Tariff Service │  │    │
│                                │  └────────┬───────┘  │    │
│                                │           │          │    │
│                                │  ┌────────▼───────┐  │    │
│                                │  │  WB API Client │  │    │
│                                │  └────────────────┘  │    │
│                                │           │          │    │
│                                │  ┌────────▼───────┐  │    │
│                                │  │ Database Layer │  │    │
│                                │  │   (Knex.js)    │  │    │
│                                │  └────────────────┘  │    │
│                                │           │          │    │
│                                │  ┌────────▼───────┐  │    │
│                                │  │ Google Sheets  │  │    │
│                                │  │     Sync       │  │    │
│                                └──┴────────────────┴──┘    │
└─────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │ WB API       │  │ Google Sheet │  │ Google Sheet │
            │ (External)   │  │      #1      │  │      #N      │
            └──────────────┘  └──────────────┘  └──────────────┘
```

### Module Structure

```
src/
├── app.ts                          # Entry point with scheduler setup
├── config/
│   ├── env/
│   │   └── env.ts                  # Environment variables (extended)
│   └── knex/
│       └── knexfile.ts             # Knex configuration
├── services/
│   ├── wb-api/
│   │   ├── wb-client.ts            # WB API client
│   │   ├── wb-types.ts             # WB API types and schemas
│   │   └── wb-config.ts            # WB API configuration
│   ├── tariff/
│   │   ├── tariff-service.ts       # Main tariff business logic
│   │   └── tariff-repository.ts    # Database operations for tariffs
│   ├── google-sheets/
│   │   ├── sheets-client.ts        # Google Sheets API client
│   │   ├── sheets-sync.ts          # Sync logic
│   │   └── sheets-config.ts        # Google Sheets configuration
│   └── scheduler/
│       └── scheduler.ts            # Task scheduling logic
├── postgres/
│   ├── knex.ts                     # Knex instance
│   ├── migrations/
│   │   └── YYYYMMDDHHMMSS_create_tariffs_table.ts
│   └── seeds/
└── utils/
    ├── logger.ts                   # Logging utility
    ├── retry.ts                    # Retry logic utility
    └── knex.ts                     # CLI utility (existing)
```

## Components and Interfaces

### 1. WB API Client

**Responsibility:** Взаимодействие с Wildberries API

**Interface:**
```typescript
interface WBClient {
  fetchBoxTariffs(): Promise<BoxTariff[]>;
}

interface BoxTariff {
  warehouseName: string;
  boxTypeName: string;
  boxDeliveryAndStorageExpr: string;
  boxDeliveryBase: string;
  boxDeliveryLiter: string;
  boxStorageBase: string;
  boxStorageLiter: string;
}
```

**Key Features:**
- HTTP client с использованием встроенного fetch
- Аутентификация через Bearer token из env
- Валидация ответа через Zod schema
- Обработка ошибок с retry механизмом

### 2. Tariff Service

**Responsibility:** Бизнес-логика обработки тарифов

**Interface:**
```typescript
interface TariffService {
  fetchAndStoreTariffs(): Promise<void>;
  getLatestDailyTariffs(): Promise<ProcessedTariff[]>;
}

interface ProcessedTariff {
  date: Date;
  warehouseName: string;
  boxType: string;
  deliveryType: string;
  coefficient: number;
  rawData: object;
}
```

**Key Features:**
- Получение данных из WB API Client
- Трансформация данных в формат для БД
- Извлечение коэффициентов из строковых полей
- Вызов Tariff Repository для сохранения

### 3. Tariff Repository

**Responsibility:** Операции с базой данных для тарифов

**Interface:**
```typescript
interface TariffRepository {
  upsertDailyTariffs(tariffs: ProcessedTariff[]): Promise<number>;
  getLatestDailyTariffs(): Promise<ProcessedTariff[]>;
  getTariffsByDate(date: Date): Promise<ProcessedTariff[]>;
}
```

**Key Features:**
- Использование Knex.js для SQL операций
- Upsert логика через onConflict
- Транзакционная обработка batch операций
- Индексированные запросы

### 4. Google Sheets Client

**Responsibility:** Взаимодействие с Google Sheets API

**Interface:**
```typescript
interface SheetsClient {
  authenticate(): Promise<void>;
  updateSheet(spreadsheetId: string, range: string, values: any[][]): Promise<void>;
  clearSheet(spreadsheetId: string, range: string): Promise<void>;
}
```

**Key Features:**
- Аутентификация через Service Account
- googleapis библиотека
- Batch операции для эффективности
- Обработка rate limits

### 5. Google Sheets Sync

**Responsibility:** Синхронизация данных с Google таблицами

**Interface:**
```typescript
interface SheetsSync {
  syncAllSheets(): Promise<SyncResult[]>;
  syncSheet(spreadsheetId: string): Promise<SyncResult>;
}

interface SyncResult {
  spreadsheetId: string;
  success: boolean;
  rowsUpdated: number;
  error?: string;
}
```

**Key Features:**
- Получение данных из Tariff Service
- Форматирование данных для Google Sheets
- Сортировка по коэффициенту
- Обработка ошибок для каждой таблицы независимо

### 6. Scheduler

**Responsibility:** Планирование и выполнение задач

**Interface:**
```typescript
interface Scheduler {
  start(): void;
  stop(): void;
  scheduleHourlyTariffFetch(): void;
  scheduleSheetsSync(): void;
}
```

**Key Features:**
- Использование node-cron для планирования
- Ежечасное выполнение fetchAndStoreTariffs
- Синхронизация Google Sheets каждые 6 часов
- Graceful shutdown handling

## Data Models

### Database Schema

**Table: tariffs**

```sql
CREATE TABLE tariffs (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  warehouse_name VARCHAR(255) NOT NULL,
  box_type VARCHAR(100) NOT NULL,
  delivery_type VARCHAR(100) NOT NULL,
  coefficient DECIMAL(10, 2) NOT NULL,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_daily_tariff 
    UNIQUE (date, warehouse_name, box_type, delivery_type)
);

CREATE INDEX idx_tariffs_date ON tariffs(date DESC);
CREATE INDEX idx_tariffs_warehouse ON tariffs(warehouse_name);
CREATE INDEX idx_tariffs_coefficient ON tariffs(coefficient);
```

**Rationale:**
- `date` - партиционирование по дням для исторических данных
- `unique_daily_tariff` - предотвращение дубликатов в рамках одного дня
- `raw_data` - JSONB для хранения полного ответа API (гибкость)
- `coefficient` - DECIMAL для точных расчетов
- Индексы для быстрых запросов по дате и сортировке

### Google Sheets Format

**Worksheet: stocks_coefs**

| Warehouse | Box Type | Delivery Type | Coefficient | Date |
|-----------|----------|---------------|-------------|------|
| Коледино  | Короб    | Монопаллет    | 1.25        | 2025-10-22 |
| Электросталь | Короб | Суперсейф     | 1.50        | 2025-10-22 |

**Sorting:** По возрастанию coefficient

## Error Handling

### WB API Errors

**Strategy:** Retry with exponential backoff

```typescript
// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 5 * 60 * 1000, // 5 minutes
  maxDelay: 30 * 60 * 1000,    // 30 minutes
  backoffMultiplier: 2
};
```

**Error Types:**
- Network errors → Retry
- 401/403 → Log critical error, no retry
- 429 Rate limit → Retry with delay from header
- 500+ Server errors → Retry
- Timeout → Retry

### Database Errors

**Strategy:** Transaction rollback and logging

- Connection errors → Log and exit (let Docker restart)
- Constraint violations → Log warning, continue
- Transaction errors → Rollback and log

### Google Sheets Errors

**Strategy:** Continue with next sheet

- Authentication errors → Log critical, skip all
- Individual sheet errors → Log error, continue with next
- Rate limit → Implement exponential backoff
- Network errors → Retry once, then skip

### Logging Strategy

```typescript
// Log levels
enum LogLevel {
  ERROR = 'error',   // Critical errors requiring attention
  WARN = 'warn',     // Non-critical issues
  INFO = 'info',     // Important events
  DEBUG = 'debug'    // Detailed debugging info
}

// Log structure
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context?: object;
  error?: Error;
}
```

## Testing Strategy

### Unit Tests

**Focus:** Individual components in isolation

**Coverage:**
- WB API Client response parsing
- Tariff Service data transformation
- Repository upsert logic
- Sheets Sync formatting

**Tools:** Jest with mocks for external dependencies

### Integration Tests

**Focus:** Component interactions

**Coverage:**
- Database operations with test database
- End-to-end tariff fetch and store flow
- Google Sheets sync with test spreadsheet

**Tools:** Jest with Docker test containers

### Manual Testing

**Scenarios:**
1. Fresh deployment with docker compose up
2. Verify hourly WB API calls in logs
3. Check database for daily updates
4. Verify Google Sheets updates
5. Test error scenarios (invalid API key, network issues)

## Configuration

### Environment Variables

```bash
# Existing
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
APP_PORT=5000
NODE_ENV=production

# New variables
WB_API_TOKEN=eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwNTIwdjEi...
WB_API_BASE_URL=https://common-api.wildberries.ru
WB_API_TIMEOUT=30000

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_IDS=spreadsheet_id_1,spreadsheet_id_2,spreadsheet_id_3

# Scheduler
TARIFF_FETCH_CRON=0 * * * *        # Every hour
SHEETS_SYNC_CRON=0 */6 * * *       # Every 6 hours

# Logging
LOG_LEVEL=info
```

### Docker Compose Updates

```yaml
services:
  app:
    environment:
      # Add new environment variables
      WB_API_TOKEN: ${WB_API_TOKEN}
      WB_API_BASE_URL: ${WB_API_BASE_URL:-https://common-api.wildberries.ru}
      WB_API_TIMEOUT: ${WB_API_TIMEOUT:-30000}
      GOOGLE_SERVICE_ACCOUNT_EMAIL: ${GOOGLE_SERVICE_ACCOUNT_EMAIL}
      GOOGLE_PRIVATE_KEY: ${GOOGLE_PRIVATE_KEY}
      GOOGLE_SPREADSHEET_IDS: ${GOOGLE_SPREADSHEET_IDS}
      TARIFF_FETCH_CRON: ${TARIFF_FETCH_CRON:-0 * * * *}
      SHEETS_SYNC_CRON: ${SHEETS_SYNC_CRON:-0 */6 * * *}
      LOG_LEVEL: ${LOG_LEVEL:-info}
```

## Dependencies

### New NPM Packages

```json
{
  "dependencies": {
    "node-cron": "^3.0.3",           // Scheduler
    "googleapis": "^144.0.0"          // Already installed
  }
}
```

**Note:** Используем встроенный fetch вместо axios для минимизации зависимостей

## Security Considerations

1. **API Tokens:** Хранятся только в environment variables, не в коде
2. **Google Service Account:** Private key через env variable
3. **Database:** Credentials через env variables
4. **Secrets Management:** example.env содержит только placeholders
5. **Docker:** Контейнеры работают с минимальными привилегиями

## Performance Considerations

1. **Database:**
   - Batch upsert для минимизации запросов
   - Индексы на часто используемых полях
   - Connection pooling (уже настроен в knexfile)

2. **API Calls:**
   - Timeout 30 секунд
   - Retry с exponential backoff
   - Rate limiting awareness

3. **Google Sheets:**
   - Batch updates вместо построчных
   - Обработка spreadsheets параллельно (Promise.allSettled)
   - Кэширование auth токенов

## Deployment Flow

1. Clone repository
2. Copy example.env to .env and fill values
3. Create Google Service Account and add credentials
4. Run `docker compose up --build`
5. Application automatically:
   - Starts PostgreSQL
   - Runs migrations
   - Starts scheduler
   - Begins hourly tariff fetching
   - Syncs to Google Sheets every 6 hours

## Monitoring and Observability

**Logs:**
- Structured JSON logs via log4js
- Docker json-file driver with rotation
- Log levels: ERROR, WARN, INFO, DEBUG

**Metrics to Log:**
- Number of tariffs fetched per run
- Number of records updated in DB
- Number of sheets synced successfully
- API response times
- Error counts by type

**Health Checks:**
- Database connectivity check
- Last successful WB API call timestamp
- Last successful sheets sync timestamp
