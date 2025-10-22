# Requirements Document

## Introduction

Данная спецификация описывает сервис для автоматизированного получения тарифов Wildberries через API, сохранения их в PostgreSQL и синхронизации с Google Sheets. Сервис должен работать в Docker контейнерах, выполнять ежечасное обновление данных и поддерживать работу с произвольным количеством Google таблиц.

## Glossary

- **WB API** - REST API Wildberries для получения информации о тарифах коробов
- **Tariff Service** - основной сервис приложения, выполняющий получение и обработку данных о тарифах
- **Database Layer** - слой работы с PostgreSQL через Knex.js
- **Google Sheets Sync** - модуль синхронизации данных с Google таблицами
- **Scheduler** - планировщик задач для выполнения регулярных операций
- **Box Tariff** - тариф для короба, содержащий информацию о коэффициентах и условиях доставки
- **Daily Snapshot** - снимок данных о тарифах за конкретный день

## Requirements

### Requirement 1

**User Story:** Как администратор системы, я хочу получать актуальные данные о тарифах WB каждый час, чтобы иметь свежую информацию для анализа

#### Acceptance Criteria

1. WHEN the Scheduler triggers hourly execution, THE Tariff Service SHALL send authenticated request to WB API endpoint https://common-api.wildberries.ru/api/v1/tariffs/box
2. WHEN the WB API returns tariff data, THE Tariff Service SHALL validate response structure using Zod schema
3. IF the WB API request fails, THEN THE Tariff Service SHALL log error details and retry after 5 minutes with maximum 3 retry attempts
4. WHILE processing tariff data within same calendar day, THE Database Layer SHALL update existing daily records instead of creating duplicates
5. THE Tariff Service SHALL extract and store warehouse name, box type, delivery type, and coefficient from each tariff record

### Requirement 2

**User Story:** Как аналитик, я хочу хранить исторические данные о тарифах по дням, чтобы отслеживать изменения тарифов во времени

#### Acceptance Criteria

1. THE Database Layer SHALL store tariff data with date dimension for daily aggregation
2. WHEN new tariff data arrives for current date, THE Database Layer SHALL perform upsert operation based on unique combination of date, warehouse, box type, and delivery type
3. THE Database Layer SHALL preserve historical records for previous dates without modification
4. THE Database Layer SHALL index tariff records by date and warehouse for efficient querying
5. WHEN querying tariff data, THE Database Layer SHALL return records sorted by coefficient in ascending order

### Requirement 3

**User Story:** Как пользователь Google Sheets, я хочу видеть актуальные тарифы в моих таблицах, чтобы использовать их для расчетов

#### Acceptance Criteria

1. THE Google Sheets Sync SHALL authenticate with Google Sheets API using service account credentials
2. WHEN the Scheduler triggers sync operation, THE Google Sheets Sync SHALL retrieve latest daily tariff data from Database Layer
3. THE Google Sheets Sync SHALL update worksheet named "stocks_coefs" in each configured Google spreadsheet
4. THE Google Sheets Sync SHALL write tariff data sorted by coefficient in ascending order
5. IF Google Sheets API request fails, THEN THE Google Sheets Sync SHALL log error and continue with next spreadsheet in queue

### Requirement 4

**User Story:** Как администратор, я хочу настраивать список Google таблиц через конфигурацию, чтобы легко добавлять новые таблицы без изменения кода

#### Acceptance Criteria

1. THE Tariff Service SHALL read Google spreadsheet IDs from environment variables or configuration file
2. THE Tariff Service SHALL support arbitrary number N of spreadsheet IDs in configuration
3. WHEN configuration changes, THE Tariff Service SHALL reload spreadsheet list without restart
4. THE Google Sheets Sync SHALL process each spreadsheet independently and continue on individual failures
5. THE Tariff Service SHALL validate spreadsheet ID format before attempting sync operation

### Requirement 5

**User Story:** Как DevOps инженер, я хочу запускать приложение одной командой docker compose up, чтобы упростить развертывание

#### Acceptance Criteria

1. THE Tariff Service SHALL run in Docker container defined in compose.yaml
2. WHEN executing docker compose up command, THE Docker Compose SHALL start PostgreSQL container before application container
3. THE Tariff Service SHALL execute database migrations automatically on startup
4. THE Tariff Service SHALL read all sensitive credentials from environment variables
5. THE repository SHALL include example.env file with placeholder values for all required environment variables

### Requirement 6

**User Story:** Как разработчик, я хочу иметь четкую структуру данных для тарифов, чтобы эффективно работать с БД

#### Acceptance Criteria

1. THE Database Layer SHALL create migration files using Knex.js migration system
2. THE Database Layer SHALL define table schema with columns for date, warehouse, box_type, delivery_type, coefficient, and metadata
3. THE Database Layer SHALL enforce NOT NULL constraints on required fields
4. THE Database Layer SHALL create unique constraint on combination of date, warehouse, box_type, and delivery_type
5. THE Database Layer SHALL use appropriate data types: DATE for dates, DECIMAL for coefficients, VARCHAR for text fields

### Requirement 7

**User Story:** Как системный администратор, я хочу видеть логи работы сервиса, чтобы отслеживать проблемы и статус выполнения задач

#### Acceptance Criteria

1. THE Tariff Service SHALL log each API request to WB with timestamp and response status
2. THE Tariff Service SHALL log number of records processed and updated in database
3. THE Tariff Service SHALL log each Google Sheets sync operation with spreadsheet ID and result
4. IF error occurs, THEN THE Tariff Service SHALL log error message with stack trace and context
5. THE Tariff Service SHALL use structured logging format compatible with Docker json-file driver

### Requirement 8

**User Story:** Как пользователь системы, я хочу чтобы данные в Google Sheets обновлялись регулярно, чтобы всегда иметь актуальную информацию

#### Acceptance Criteria

1. THE Scheduler SHALL trigger Google Sheets sync operation every 6 hours
2. THE Google Sheets Sync SHALL retrieve most recent daily snapshot from Database Layer
3. THE Google Sheets Sync SHALL clear existing data in "stocks_coefs" worksheet before writing new data
4. THE Google Sheets Sync SHALL write header row with column names before data rows
5. THE Google Sheets Sync SHALL format coefficient values with 2 decimal places
