# Быстрый старт без Google Sheets

## Минимальная настройка для запуска

### 1. Проверьте .env файл

Убедитесь, что в `.env` заполнены только обязательные параметры:

```env
# PostgreSQL (обязательно)
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

APP_PORT=5000

# WB API (обязательно)
WB_API_TOKEN=ваш_токен_здесь
WB_API_BASE_URL=https://common-api.wildberries.ru
WB_API_TIMEOUT=30000

# Google Sheets (ОПЦИОНАЛЬНО - закомментировано)
# GOOGLE_SERVICE_ACCOUNT_EMAIL=...
# GOOGLE_PRIVATE_KEY=...
# GOOGLE_SPREADSHEET_IDS=...

# Scheduler
TARIFF_FETCH_CRON=0 * * * *
SHEETS_SYNC_CRON=0 */6 * * *

# Logging
LOG_LEVEL=info
```

### 2. Запустите сервис

```bash
docker compose up --build
```

### 3. Что будет работать

✅ **Работает:**
- Ежечасное получение тарифов из WB API
- Сохранение данных в PostgreSQL
- Хранение исторических данных по дням
- Автоматическое обновление данных текущего дня

❌ **Не работает (но это нормально):**
- Синхронизация с Google Sheets (отключена)

### 4. Проверка работы

Смотрите логи:
```bash
docker compose logs -f app
```

Вы должны увидеть:
```
[INFO] Starting WB Tariffs Integration Service
[INFO] Running database migrations
[INFO] Database migrations completed
[INFO] Performing initial tariff fetch
[INFO] Fetching box tariffs from WB API
[INFO] Successfully fetched box tariffs from WB API
[INFO] Starting scheduler
[INFO] Scheduling hourly tariff fetch
[INFO] Google Sheets sync not scheduled: not configured  <-- это нормально!
[INFO] WB Tariffs Integration Service started successfully
```

### 5. Проверка данных в БД

Подключитесь к PostgreSQL:
```bash
docker compose exec postgres psql -U postgres -d postgres
```

Проверьте данные:
```sql
-- Посмотреть все тарифы
SELECT * FROM tariffs ORDER BY date DESC, coefficient ASC LIMIT 10;

-- Посмотреть количество записей по дням
SELECT date, COUNT(*) as count FROM tariffs GROUP BY date ORDER BY date DESC;

-- Посмотреть тарифы с минимальным коэффициентом
SELECT warehouse_name, box_type, coefficient, date 
FROM tariffs 
WHERE date = CURRENT_DATE 
ORDER BY coefficient ASC 
LIMIT 5;
```

## Если позже захотите добавить Google Sheets

1. Следуйте инструкции в README.md раздел "Настройка Google Service Account"
2. Раскомментируйте и заполните переменные в `.env`:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_SPREADSHEET_IDS`
3. Перезапустите: `docker compose restart app`

Синхронизация начнет работать автоматически!

## Troubleshooting

### Ошибка: "WB API token is required"
- Проверьте, что `WB_API_TOKEN` заполнен в `.env`
- Токен должен быть действительным

### Ошибка подключения к БД
```bash
# Проверьте статус PostgreSQL
docker compose ps postgres

# Перезапустите БД
docker compose restart postgres
```

### Нет данных в БД
- Проверьте логи на ошибки WB API
- Убедитесь, что токен действителен
- Проверьте, что миграции выполнились успешно
