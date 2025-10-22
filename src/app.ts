import { migrate, seed } from "#postgres/knex.js";
import { logger } from "#utils/logger.js";
import scheduler from "#services/scheduler/scheduler.js";
import tariffService from "#services/tariff/tariff-service.js";

/**
 * Application entry point
 */
async function main() {
    try {
        logger.info("Starting WB Tariffs Integration Service");

        // Run database migrations
        logger.info("Running database migrations");
        await migrate.latest();
        logger.info("Database migrations completed");

        // Run seeds (if any)
        logger.info("Running database seeds");
        await seed.run();
        logger.info("Database seeds completed");

        // Perform initial tariff fetch
        logger.info("Performing initial tariff fetch");
        try {
            await tariffService.fetchAndStoreTariffs();
            logger.info("Initial tariff fetch completed successfully");
        } catch (error) {
            logger.error("Initial tariff fetch failed, will retry on schedule", error as Error);
        }

        // Start scheduler
        logger.info("Starting scheduler");
        scheduler.start();

        logger.info("WB Tariffs Integration Service started successfully");
        logger.info("Service is now running and will execute scheduled tasks");
    } catch (error) {
        logger.error("Failed to start application", error as Error);
        process.exit(1);
    }
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
    const shutdown = (signal: string) => {
        logger.info(`Received ${signal}, shutting down gracefully`);

        scheduler.stop();

        logger.info("Shutdown complete");
        process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

// Setup graceful shutdown
setupGracefulShutdown();

// Start application
main();