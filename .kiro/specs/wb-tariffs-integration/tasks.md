# Implementation Plan

- [ ] 1. Extend environment configuration and update Docker setup



  - [x] 1.1 Add new environment variables to env.ts schema for WB API and Google Sheets


    - Add WB_API_TOKEN, WB_API_BASE_URL, WB_API_TIMEOUT
    - Add GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SPREADSHEET_IDS
    - Add TARIFF_FETCH_CRON, SHEETS_SYNC_CRON, LOG_LEVEL
    - _Requirements: 5.5, 4.1_
  - [x] 1.2 Update example.env with placeholder values for all new variables


    - Add comments explaining each variable purpose
    - Include example cron expressions
    - _Requirements: 5.5_
  - [x] 1.3 Update compose.yaml to pass new environment variables to app container


    - Add all new env variables with defaults where appropriate
    - _Requirements: 5.1, 5.2_

- [x] 2. Create database migration for tariffs table





  - [x] 2.1 Generate migration file using Knex CLI


    - Create migration with name "create_tariffs_table"
    - _Requirements: 6.1_





  - [ ] 2.2 Define tariffs table schema in migration
    - Add columns: id, date, warehouse_name, box_type, delivery_type, coefficient, raw_data, created_at, updated_at
    - Add unique constraint on (date, warehouse_name, box_type, delivery_type)


    - Add indexes on date, warehouse_name, and coefficient
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 2.4_






- [x] 3. Implement utility modules


  - [ ] 3.1 Create logger utility using log4js
    - Configure structured JSON logging


    - Support log levels from environment variable
    - Add context and error serialization
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [-] 3.2 Create retry utility with exponential backoff


    - Implement configurable retry logic
    - Support max attempts, initial delay, backoff multiplier
    - Add logging for retry attempts
    - _Requirements: 1.3_

- [ ] 4. Implement WB API client
  - [ ] 4.1 Create WB API types and Zod schemas in wb-types.ts
    - Define BoxTariff interface matching API response
    - Create Zod schema for response validation
    - _Requirements: 1.2, 1.5_
  - [ ] 4.2 Create WB API configuration in wb-config.ts
    - Load API token, base URL, timeout from environment
    - Export configuration object
    - _Requirements: 1.1_
  - [ ] 4.3 Implement WB API client in wb-client.ts
    - Create fetchBoxTariffs method using native fetch
    - Add Bearer token authentication
    - Implement timeout handling
    - Validate response with Zod schema
    - Integrate retry utility for error handling
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 5. Implement tariff repository


  - [x] 5.1 Create tariff repository in tariff-repository.ts

    - Implement upsertDailyTariffs method with Knex onConflict
    - Implement getLatestDailyTariffs method with sorting by coefficient
    - Implement getTariffsByDate method
    - Use transactions for batch operations
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 6.2_
  - [ ]* 5.2 Add error handling and logging to repository methods
    - Log number of records processed
    - Handle constraint violations gracefully
    - _Requirements: 7.2_

- [x] 6. Implement tariff service



  - [x] 6.1 Create tariff service in tariff-service.ts


    - Implement fetchAndStoreTariffs method
    - Call WB API client to fetch data
    - Transform API response to ProcessedTariff format
    - Extract coefficient from string fields
    - Call repository to upsert data
    - Add comprehensive logging
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.1, 2.2, 7.1, 7.2_
  - [x] 6.2 Implement getLatestDailyTariffs method


    - Retrieve latest daily snapshot from repository
    - Return sorted by coefficient
    - _Requirements: 2.5, 8.2_

- [x] 7. Implement Google Sheets integration



  - [x] 7.1 Create Google Sheets configuration in sheets-config.ts


    - Load service account credentials from environment
    - Parse spreadsheet IDs from comma-separated string
    - Validate configuration
    - _Requirements: 4.1, 4.2, 4.5_
  - [x] 7.2 Implement Google Sheets client in sheets-client.ts


    - Create authenticate method using googleapis
    - Implement updateSheet method for batch updates
    - Implement clearSheet method
    - Handle rate limiting and errors
    - _Requirements: 3.1, 3.5_
  - [x] 7.3 Implement Google Sheets sync in sheets-sync.ts



    - Implement syncSheet method for single spreadsheet
    - Format tariff data as 2D array with headers
    - Sort data by coefficient ascending
    - Clear and update "stocks_coefs" worksheet
    - Format coefficient with 2 decimal places
    - _Requirements: 3.2, 3.3, 3.4, 8.3, 8.4, 8.5_
  - [x] 7.4 Implement syncAllSheets method


    - Process all configured spreadsheets
    - Use Promise.allSettled for independent error handling
    - Log results for each spreadsheet
    - Continue on individual failures
    - _Requirements: 3.5, 4.3, 4.4, 7.3_

- [x] 8. Implement scheduler



  - [x] 8.1 Install node-cron dependency


    - Add to package.json dependencies
    - _Requirements: 1.1_
  - [x] 8.2 Create scheduler in scheduler.ts


    - Implement start method to initialize cron jobs
    - Schedule hourly tariff fetch using TARIFF_FETCH_CRON
    - Schedule Google Sheets sync using SHEETS_SYNC_CRON
    - Implement stop method for graceful shutdown
    - Add error handling for scheduled tasks
    - _Requirements: 1.1, 8.1_
  - [x] 8.3 Add logging for scheduled task execution


    - Log start and completion of each task
    - Log errors with context
    - _Requirements: 7.1, 7.3_

- [ ] 9. Update application entry point
  - [ ] 9.1 Modify src/app.ts to initialize and start scheduler
    - Keep existing migration and seed execution
    - Initialize all services (WB client, tariff service, sheets sync)
    - Start scheduler
    - Add graceful shutdown handlers (SIGTERM, SIGINT)
    - Add initial tariff fetch on startup
    - _Requirements: 5.3, 5.4_
  - [ ] 9.2 Add startup logging
    - Log application start with configuration summary
    - Log scheduler initialization
    - _Requirements: 7.1_

- [ ] 10. Update documentation
  - [ ] 10.1 Update README.md with comprehensive setup instructions
    - Document all environment variables
    - Explain Google Service Account setup
    - Provide step-by-step deployment guide
    - Add troubleshooting section
    - Document cron schedule format
    - _Requirements: 5.5_
  - [ ] 10.2 Add inline code documentation
    - Add JSDoc comments to all public methods
    - Document complex logic and algorithms
    - _Requirements: 7.1_

- [ ] 11. Final integration and testing
  - [ ] 11.1 Test complete flow with docker compose up
    - Verify migrations run successfully
    - Verify scheduler starts
    - Check logs for hourly WB API calls
    - Verify data appears in database
    - Verify Google Sheets updates
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ] 11.2 Test error scenarios
    - Invalid WB API token
    - Network failures
    - Invalid Google credentials
    - Database connection issues
    - _Requirements: 1.3, 3.5_
  - [ ] 11.3 Verify data correctness
    - Check tariff data format in database
    - Verify daily updates (not duplicates)
    - Verify Google Sheets sorting by coefficient
    - Verify historical data preservation
    - _Requirements: 2.2, 2.3, 2.5, 8.5_
