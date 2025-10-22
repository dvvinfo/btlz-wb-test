import cron from "node-cron";
import { createLogger } from "#utils/logger.js";
import env from "#config/env/env.js";
import tariffService from "#services/tariff/tariff-service.js";
import sheetsSync from "#services/google-sheets/sheets-sync.js";

const logger = createLogger("scheduler");

/**
 * Scheduler for periodic tasks
 */
export class Scheduler {
    private tariffFetchTask: cron.ScheduledTask | null = null;
    private sheetsSyncTask: cron.ScheduledTask | null = null;
    private isRunning = false;

    /**
     * Start the scheduler
     */
    start(): void {
        if (this.isRunning) {
            logger.warn("Scheduler is already running");
            return;
        }

        logger.info("Starting scheduler");

        this.scheduleHourlyTariffFetch();
        this.scheduleSheetsSync();

        this.isRunning = true;
        logger.info("Scheduler started successfully");
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        if (!this.isRunning) {
            logger.warn("Scheduler is not running");
            return;
        }

        logger.info("Stopping scheduler");

        if (this.tariffFetchTask) {
            this.tariffFetchTask.stop();
            this.tariffFetchTask = null;
        }

        if (this.sheetsSyncTask) {
            this.sheetsSyncTask.stop();
            this.sheetsSyncTask = null;
        }

        this.isRunning = false;
        logger.info("Scheduler stopped successfully");
    }

    /**
     * Schedule hourly tariff fetch from WB API
     */
    scheduleHourlyTariffFetch(): void {
        const cronExpression = env.TARIFF_FETCH_CRON || "0 * * * *";

        logger.info("Scheduling hourly tariff fetch", { cron: cronExpression });

        if (!cron.validate(cronExpression)) {
            logger.error("Invalid cron expression for tariff fetch", { cron: cronExpression });
            throw new Error(`Invalid TARIFF_FETCH_CRON expression: ${cronExpression}`);
        }

        this.tariffFetchTask = cron.schedule(
            cronExpression,
            async () => {
                logger.info("Executing scheduled tariff fetch");
                const startTime = Date.now();

                try {
                    await tariffService.fetchAndStoreTariffs();
                    const duration = Date.now() - startTime;
                    logger.info("Scheduled tariff fetch completed successfully", {
                        duration: `${duration}ms`,
                    });
                } catch (error) {
                    const duration = Date.now() - startTime;
                    logger.error("Scheduled tariff fetch failed", error as Error, {
                        duration: `${duration}ms`,
                    });
                }
            },
            {
                timezone: "UTC",
            },
        );

        logger.info("Hourly tariff fetch scheduled successfully");
    }

    /**
     * Schedule Google Sheets sync
     */
    scheduleSheetsSync(): void {
        // Check if Google Sheets is configured
        if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY || !env.GOOGLE_SPREADSHEET_IDS) {
            logger.info("Google Sheets sync not scheduled: not configured");
            return;
        }

        const cronExpression = env.SHEETS_SYNC_CRON || "0 */6 * * *";

        logger.info("Scheduling Google Sheets sync", { cron: cronExpression });

        if (!cron.validate(cronExpression)) {
            logger.error("Invalid cron expression for sheets sync", { cron: cronExpression });
            throw new Error(`Invalid SHEETS_SYNC_CRON expression: ${cronExpression}`);
        }

        this.sheetsSyncTask = cron.schedule(
            cronExpression,
            async () => {
                logger.info("Executing scheduled Google Sheets sync");
                const startTime = Date.now();

                try {
                    const results = await sheetsSync.syncAllSheets();
                    const duration = Date.now() - startTime;

                    const successCount = results.filter((r) => r.success).length;
                    const failureCount = results.filter((r) => !r.success).length;

                    logger.info("Scheduled Google Sheets sync completed", {
                        total: results.length,
                        success: successCount,
                        failed: failureCount,
                        duration: `${duration}ms`,
                    });
                } catch (error) {
                    const duration = Date.now() - startTime;
                    logger.error("Scheduled Google Sheets sync failed", error as Error, {
                        duration: `${duration}ms`,
                    });
                }
            },
            {
                timezone: "UTC",
            },
        );

        logger.info("Google Sheets sync scheduled successfully");
    }

    /**
     * Check if scheduler is running
     * @returns True if scheduler is running
     */
    isSchedulerRunning(): boolean {
        return this.isRunning;
    }
}

/**
 * Default scheduler instance
 */
export const scheduler = new Scheduler();

export default scheduler;
