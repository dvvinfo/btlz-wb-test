# WB Tariffs Integration Service

Сервис для автоматизированного получения тарифов Wildberries через API, сохранения их в PostgreSQL и синхронизации с Google Sheets.

## Описание

Сервис выполняет две основные задачи:
1. **Регулярное получение информации о тарифах WB** - ежечасное получение данных через API и сохранение в БД
2. **Регулярное обновление Google Sheets** - синхронизация актуальных тарифов в Google таблицы каждые 6 часов

## Возможности

- ✅ Ежечасное получение тарифов коробов из WB API
- ✅ Хранение исторических данных по дням в PostgreSQL
- ✅ Автоматическое обновление данных текущего дня (без дубликатов)
- ✅ Синхронизация с произвольным количеством Google Sheets
- ✅ Сортировка данных по коэффициенту (по возрастанию)
- ✅ Retry механизм с exponential backoff для API запросов
- ✅ Структурированное логирование всех операций
- ✅ Graceful shutdown
- ✅ Запуск в Docker контейнерах

## Технологии

- **Node.js** + **TypeScript**
- **PostgreSQL** - хранение данных
- **Knex.js** - работа с БД и миграции
- **Google Sheets API** - синхронизация данных
- **node-cron** - планировщик задач
- **log4js** - логирование
- **Docker** + **Docker Compose** - контейнеризация

## Требования

- Docker и Docker Compose
- Node.js 20+ (для локальной разработки)
- WB API токен
- Google Service Account с доступом к Google Sheets API

## Быстрый старт

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd btlz-wb-test
```

### 2. Настройка переменных окружения

Скопируйте example.env в .env и заполните значения:

```bash
cp example.env .env
```

Отредактируйте `.env` файл:

```env
# PostgreSQL
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password

APP_PORT=5000

# WB API
WB_API_TOKEN=your_wb_api_token_here
WB_API_BASE_URL=https://common-api.wildberries.ru
WB_API_TIMEOUT=30000

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_IDS=spreadsheet_id_1,spreadsheet_id_2

# Scheduler (опционально)
TARIFF_FETCH_CRON=0 * * * *        # Каждый час
SHEETS_SYNC_CRON=0 */6 * * *       # Каждые 6 часов

# Logging (опционально)
LOG_LEVEL=info
```

### 3. Получение WB API токена

1. Войдите в личный кабинет продавца Wildberries
2. Перейдите в раздел API
3. Создайте новый токен с правами на чтение тарифов
4. Скопируйте токен в переменную `WB_API_TOKEN`

### 4. Настройка Google Service Account

#### 4.1 Создание Service Account

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите Google Sheets API:
   - Перейдите в "APIs & Services" > "Library"
   - Найдите "Google Sheets API"
   - Нажмите "Enable"
4. Создайте Service Account:
   - Перейдите в "IAM & Admin" > "Service Accounts"
   - Нажмите "Create Service Account"
   - Укажите имя и описание
   - Нажмите "Create and Continue"
   - Пропустите шаги с ролями
   - Нажмите "Done"

#### 4.2 Получение credentials

1. Откройте созданный Service Account
2. Перейдите на вкладку "Keys"
3. Нажмите "Add Key" > "Create new key"
4. Выберите формат JSON
5. Скачайте файл с ключом

#### 4.3 Настройка переменных окружения

Из скачанного JSON файла скопируйте:
- `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → `GOOGLE_PRIVATE_KEY` (важно сохранить все `\n`)

#### 4.4 Предоставление доступа к таблицам

1. Откройте каждую Google таблицу, которую хотите синхронизировать
2. Нажмите "Share" (Поделиться)
3. Добавьте email вашего Service Account (из `GOOGLE_SERVICE_ACCOUNT_EMAIL`)
4. Дайте права "Editor" (Редактор)
5. Скопируйте ID таблицы из URL (часть между `/d/` и `/edit`)
6. Добавьте ID в `GOOGLE_SPREADSHEET_IDS` (через запятую для нескольких таблиц)

#### 4.5 Создание листа для тарифов

В каждой таблице создайте лист с именем `stocks_coefs` - именно в него будут записываться данные.

### 5. Запуск приложения

```bash
docker compose up --build
```

Приложение автоматически:
- Запустит PostgreSQL
- Выполнит миграции БД
- Выполнит начальную загрузку тарифов
- Запустит планировщик задач

### 6. Проверка работы

Проверьте логи:
```bash
docker compose logs -f app
```

Вы должны увидеть:
- Успешное подключение к БД
- Выполнение миграций
- Начальную загрузку тарифов из WB API
- Запуск планировщика

## Структура проекта

```
.
├── src/
│   ├── app.ts                          # Entry point
│   ├── config/
│   │   ├── env/
│   │   │   └── env.ts                  # Конфигурация переменных окружения
│   │   └── knex/
│   │       └── knexfile.ts             # Конфигурация Knex.js
│   ├── services/
│   │   ├── wb-api/
│   │   │   ├── wb-client.ts            # WB API client
│   │   │   ├── wb-types.ts             # Типы и схемы
│   │   │   └── wb-config.ts            # Конфигурация WB API
│   │   ├── tariff/
│   │   │   ├── tariff-service.ts       # Бизнес-логика тарифов
│   │   │   └── tariff-repository.ts    # Работа с БД
│   │   ├── google-sheets/
│   │   │   ├── sheets-client.ts        # Google Sheets API client
│   │   │   ├── sheets-sync.ts          # Логика синхронизации
│   │   │   └── sheets-config.ts        # Конфигурация Google Sheets
│   │   └── scheduler/
│   │       └── scheduler.ts            # Планировщик задач
│   ├── postgres/
│   │   ├── knex.ts                     # Knex instance
│   │   ├── migrations/                 # Миграции БД
│   │   └── seeds/                      # Seeds
│   └── utils/
│       ├── logger.ts                   # Утилита логирования
│       ├── retry.ts                    # Утилита retry
│       └── knex.ts                     # CLI для Knex
├── compose.yaml                        # Docker Compose конфигурация
├── Dockerfile                          # Dockerfile для приложения
├── package.json
├── tsconfig.json
├── example.env                         # Пример переменных окружения
└── README.md
```

## Схема базы данных

### Таблица `tariffs`

| Колонка          | Тип           | Описание                          |
|------------------|---------------|-----------------------------------|
| id               | SERIAL        | Primary key                       |
| date             | DATE          | Дата тарифа                       |
| warehouse_name   | VARCHAR(255)  | Название склада                   |
| box_type         | VARCHAR(100)  | Тип короба                        |
| delivery_type    | VARCHAR(100)  | Тип доставки                      |
| coefficient      | DECIMAL(10,2) | Коэффициент                       |
| raw_data         | JSONB         | Полные данные из API              |
| created_at       | TIMESTAMP     | Дата создания записи              |
| updated_at       | TIMESTAMP     | Дата обновления записи            |

**Constraints:**
- Unique constraint на `(date, warehouse_name, box_type, delivery_type)`

**Indexes:**
- `idx_tariffs_date` на `date`
- `idx_tariffs_warehouse` на `warehouse_name`
- `idx_tariffs_coefficient` на `coefficient`

## Формат данных в Google Sheets

Лист `stocks_coefs` содержит следующие колонки:

| Warehouse | Box Type | Delivery Type | Coefficient | Date       |
|-----------|----------|---------------|-------------|------------|
| Коледино  | Короб    | Standard      | 1.25        | 2025-10-22 |

Данные отсортированы по коэффициенту (по возрастанию).

## Команды для разработки

### Локальная разработка

```bash
# Установка зависимостей
npm install

# Запуск БД
docker compose up -d postgres

# Выполнение миграций
npm run knex:dev migrate latest

# Запуск в режиме разработки
npm run dev
```

### Работа с миграциями

```bash
# Создать новую миграцию
npm run knex:dev migrate make migration_name

# Выполнить миграции
npm run knex:dev migrate latest

# Откатить последнюю миграцию
npm run knex:dev migrate rollback

# Список миграций
npm run knex:dev migrate list
```

### Сборка и запуск production

```bash
# Сборка TypeScript
npm run build

# Запуск production версии
npm run start
```

### Docker команды

```bash
# Запуск всех сервисов
docker compose up -d

# Просмотр логов
docker compose logs -f app

# Остановка сервисов
docker compose down

# Полная очистка (включая volumes)
docker compose down --volumes --rmi local

# Пересборка и запуск
docker compose up --build
```

## Конфигурация планировщика

Расписание задач настраивается через cron выражения:

### TARIFF_FETCH_CRON (по умолчанию: `0 * * * *`)
Получение тарифов из WB API

Примеры:
- `0 * * * *` - каждый час в начале часа
- `*/30 * * * *` - каждые 30 минут
- `0 */2 * * *` - каждые 2 часа

### SHEETS_SYNC_CRON (по умолчанию: `0 */6 * * *`)
Синхронизация с Google Sheets

Примеры:
- `0 */6 * * *` - каждые 6 часов
- `0 0 * * *` - каждый день в полночь
- `0 */3 * * *` - каждые 3 часа

## Логирование

Уровни логирования (переменная `LOG_LEVEL`):
- `error` - только критические ошибки
- `warn` - предупреждения и ошибки
- `info` - информационные сообщения (по умолчанию)
- `debug` - детальная отладочная информация

Логи выводятся в stdout в структурированном формате, совместимом с Docker.

## Обработка ошибок

### WB API
- Автоматический retry с exponential backoff (3 попытки)
- Начальная задержка: 5 минут
- Максимальная задержка: 30 минут
- Ошибки аутентификации (401/403) не повторяются

### Google Sheets
- Каждая таблица обрабатывается независимо
- Ошибка в одной таблице не влияет на другие
- Rate limiting обрабатывается автоматически

### База данных
- Транзакции для batch операций
- Constraint violations логируются как warnings
- Connection errors приводят к перезапуску контейнера

## Troubleshooting

### Проблема: Ошибка аутентификации WB API

**Решение:**
- Проверьте правильность токена в `WB_API_TOKEN`
- Убедитесь, что токен не истек
- Проверьте права токена

### Проблема: Ошибка доступа к Google Sheets

**Решение:**
- Убедитесь, что Service Account имеет доступ к таблице
- Проверьте правильность `GOOGLE_PRIVATE_KEY` (должны быть `\n`)
- Убедитесь, что Google Sheets API включен в проекте

### Проблема: Миграции не выполняются

**Решение:**
```bash
# Проверьте подключение к БД
docker compose logs postgres

# Выполните миграции вручную
docker compose exec app npm run knex migrate latest
```

### Проблема: Данные не появляются в Google Sheets

**Решение:**
- Проверьте, что лист называется `stocks_coefs`
- Проверьте логи синхронизации: `docker compose logs -f app | grep sheets-sync`
- Убедитесь, что в БД есть данные: подключитесь к PostgreSQL и проверьте таблицу `tariffs`

## Безопасность

- ✅ Все секреты хранятся в переменных окружения
- ✅ `.env` файл добавлен в `.gitignore`
- ✅ `example.env` содержит только placeholders
- ✅ Private keys не хранятся в коде
- ✅ Контейнеры работают с минимальными привилегиями

## Лицензия

ISC

## Автор

lucard17
