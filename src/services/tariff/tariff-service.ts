import { createLogger } from "#utils/logger.js";
import wbApiClient from "#services/wb-api/wb-client.js";
import { BoxTariff } from "#services/wb-api/wb-types.js";
import tariffRepository, { ProcessedTariff } from "./tariff-repository.js";

const logger = createLogger("tariff-service");

/**
 * Service for managing tariff data
 */
export class TariffService {
    /**
     * Fetch tariffs from WB API and store in database
     * @returns Promise that resolves when operation completes
     */
    async fetchAndStoreTariffs(): Promise<void> {
        logger.info("Starting tariff fetch and store operation");
        const startTime = Date.now();

        try {
            // Fetch tariffs from WB API
            const boxTariffs = await wbApiClient.fetchBoxTariffs();

            if (boxTariffs.length === 0) {
                logger.warn("No tariffs received from WB API");
                return;
            }

            logger.info(`Received ${boxTariffs.length} tariffs from WB API`);
            
            // Log first tariff for debugging
            if (boxTariffs.length > 0) {
                logger.debug("Sample tariff structure", { sample: boxTariffs[0] });
            }

            // Transform to processed tariffs
            const processedTariffs = this.transformBoxTariffs(boxTariffs);

            logger.info(`Transformed ${processedTariffs.length} tariffs for storage`);

            // Store in database
            const affectedRows = await tariffRepository.upsertDailyTariffs(processedTariffs);

            const duration = Date.now() - startTime;
            logger.info("Tariff fetch and store operation completed successfully", {
                fetched: boxTariffs.length,
                processed: processedTariffs.length,
                stored: affectedRows,
                duration: `${duration}ms`,
            });
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error("Tariff fetch and store operation failed", error as Error, {
                duration: `${duration}ms`,
            });
            throw error;
        }
    }

    /**
     * Get latest daily tariffs from database
     * @returns Promise with array of processed tariffs
     */
    async getLatestDailyTariffs(): Promise<ProcessedTariff[]> {
        logger.debug("Getting latest daily tariffs");

        try {
            const tariffs = await tariffRepository.getLatestDailyTariffs();
            logger.info(`Retrieved ${tariffs.length} latest daily tariffs`);
            return tariffs;
        } catch (error) {
            logger.error("Failed to get latest daily tariffs", error as Error);
            throw error;
        }
    }

    /**
     * Transform WB API box tariffs to processed tariffs
     * @param {BoxTariff[]} boxTariffs - Raw box tariffs from API
     * @returns Array of processed tariffs
     */
    private transformBoxTariffs(boxTariffs: BoxTariff[]): ProcessedTariff[] {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        const processedTariffs: ProcessedTariff[] = [];

        for (const boxTariff of boxTariffs) {
            try {
                // Calculate coefficient from delivery/storage fields
                const coefficient = this.calculateCoefficient(boxTariff);
                
                if (coefficient === 0) {
                    logger.debug("Skipping tariff with zero coefficient", {
                        warehouse: boxTariff.warehouseName,
                    });
                    continue;
                }

                // Determine delivery type from available fields
                const deliveryType = this.determineDeliveryType(boxTariff);
                
                // Use "Box" as default box type if not specified
                const boxType = boxTariff.boxTypeName || "Box";

                processedTariffs.push({
                    date: today,
                    warehouseName: boxTariff.warehouseName,
                    boxType: boxType,
                    deliveryType: deliveryType,
                    coefficient: coefficient,
                    rawData: boxTariff,
                });
            } catch (error) {
                logger.warn("Failed to transform box tariff, skipping", {
                    warehouse: boxTariff.warehouseName,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return processedTariffs;
    }

    /**
     * Calculate coefficient from tariff fields
     * Uses boxDeliveryBase or boxDeliveryLiter as the primary coefficient
     * @param {BoxTariff} boxTariff - Box tariff data
     * @returns Coefficient as number
     */
    private calculateCoefficient(boxTariff: BoxTariff): number {
        // Try boxDeliveryAndStorageExpr first (if present)
        if (boxTariff.boxDeliveryAndStorageExpr) {
            return this.extractCoefficient(boxTariff.boxDeliveryAndStorageExpr);
        }

        // Try boxDeliveryBase
        if (boxTariff.boxDeliveryBase) {
            const coef = this.parseNumber(boxTariff.boxDeliveryBase);
            if (coef > 0) return coef;
        }

        // Try boxDeliveryLiter
        if (boxTariff.boxDeliveryLiter) {
            const coef = this.parseNumber(boxTariff.boxDeliveryLiter);
            if (coef > 0) return coef;
        }

        // Try boxStorageBase
        if (boxTariff.boxStorageBase) {
            const coef = this.parseNumber(boxTariff.boxStorageBase);
            if (coef > 0) return coef;
        }

        // Try boxStorageLiter
        if (boxTariff.boxStorageLiter) {
            const coef = this.parseNumber(boxTariff.boxStorageLiter);
            if (coef > 0) return coef;
        }

        return 0;
    }

    /**
     * Extract coefficient from expression string
     * @param {string} expr - Expression string (e.g., "x1.5", "1.5", "коэф. 1.5")
     * @returns Coefficient as number
     */
    private extractCoefficient(expr: string): number {
        // Remove common prefixes and extract number
        const cleaned = expr.replace(/[xхXХ]|коэф\.|коэффициент/gi, "").trim();

        // Try to parse as float
        const coefficient = parseFloat(cleaned);

        if (isNaN(coefficient)) {
            logger.warn(`Could not extract coefficient from expression: "${expr}", using 1.0`);
            return 1.0;
        }

        return coefficient;
    }

    /**
     * Parse number from string (handles comma as decimal separator)
     * @param {string} value - String value
     * @returns Parsed number
     */
    private parseNumber(value: string): number {
        // Replace comma with dot for decimal separator
        const normalized = value.replace(",", ".");
        const num = parseFloat(normalized);
        return isNaN(num) ? 0 : num;
    }

    /**
     * Determine delivery type from box tariff fields
     * @param {BoxTariff} boxTariff - Box tariff data
     * @returns Delivery type string
     */
    private determineDeliveryType(boxTariff: BoxTariff): string {
        // Use boxDeliveryBase as primary indicator
        if (boxTariff.boxDeliveryBase && boxTariff.boxDeliveryBase !== "0") {
            return "Standard";
        }

        // Check if it's liter-based delivery
        if (boxTariff.boxDeliveryLiter && boxTariff.boxDeliveryLiter !== "0") {
            return "Liter-based";
        }

        // Check storage fields
        if (boxTariff.boxStorageBase && boxTariff.boxStorageBase !== "0") {
            return "Storage";
        }

        // Use expression as fallback
        if (boxTariff.boxDeliveryAndStorageExpr) {
            return "Delivery";
        }

        // Default
        return "Unknown";
    }
}

/**
 * Default tariff service instance
 */
export const tariffService = new TariffService();

export default tariffService;
