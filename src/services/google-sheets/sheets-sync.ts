import { createLogger } from "#utils/logger.js";
import tariffService from "#services/tariff/tariff-service.js";
import sheetsClient from "./sheets-client.js";
import sheetsConfig from "./sheets-config.js";
import { ProcessedTariff } from "#services/tariff/tariff-repository.js";

const logger = createLogger("sheets-sync");

/**
 * Result of syncing a single spreadsheet
 */
export interface SyncResult {
    spreadsheetId: string;
    success: boolean;
    rowsUpdated: number;
    error?: string;
}

/**
 * Google Sheets sync service
 */
export class SheetsSync {
    private config = sheetsConfig;

    /**
     * Sync data to a single spreadsheet
     * @param {string} spreadsheetId - Spreadsheet ID to sync
     * @returns Promise with sync result
     */
    async syncSheet(spreadsheetId: string): Promise<SyncResult> {
        logger.info("Starting sync for spreadsheet", { spreadsheetId });
        const startTime = Date.now();

        try {
            // Get latest tariff data
            const tariffs = await tariffService.getLatestDailyTariffs();

            if (tariffs.length === 0) {
                logger.warn("No tariff data available to sync", { spreadsheetId });
                return {
                    spreadsheetId,
                    success: true,
                    rowsUpdated: 0,
                };
            }

            // Format data for Google Sheets
            const sheetData = this.formatTariffsForSheet(tariffs);

            // Perform batch update (clear + update)
            await sheetsClient.batchUpdate(spreadsheetId, this.config.worksheetName, sheetData);

            const duration = Date.now() - startTime;
            logger.info("Successfully synced spreadsheet", {
                spreadsheetId,
                rowsUpdated: sheetData.length - 1, // Exclude header
                duration: `${duration}ms`,
            });

            return {
                spreadsheetId,
                success: true,
                rowsUpdated: sheetData.length - 1,
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            logger.error("Failed to sync spreadsheet", error as Error, {
                spreadsheetId,
                duration: `${duration}ms`,
            });

            return {
                spreadsheetId,
                success: false,
                rowsUpdated: 0,
                error: errorMessage,
            };
        }
    }

    /**
     * Sync data to all configured spreadsheets
     * @returns Promise with array of sync results
     */
    async syncAllSheets(): Promise<SyncResult[]> {
        logger.info(`Starting sync for ${this.config.spreadsheetIds.length} spreadsheet(s)`);
        const startTime = Date.now();

        // Process all spreadsheets independently
        const syncPromises = this.config.spreadsheetIds.map((spreadsheetId) => this.syncSheet(spreadsheetId));

        // Wait for all to complete (don't fail on individual errors)
        const results = await Promise.allSettled(syncPromises);

        // Extract results
        const syncResults: SyncResult[] = results.map((result, index) => {
            if (result.status === "fulfilled") {
                return result.value;
            } else {
                const spreadsheetId = this.config.spreadsheetIds[index];
                const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);

                logger.error("Sync promise rejected for spreadsheet", {
                    spreadsheetId,
                    error: errorMessage,
                });

                return {
                    spreadsheetId,
                    success: false,
                    rowsUpdated: 0,
                    error: errorMessage,
                };
            }
        });

        // Summary
        const successCount = syncResults.filter((r) => r.success).length;
        const failureCount = syncResults.filter((r) => !r.success).length;
        const totalRows = syncResults.reduce((sum, r) => sum + r.rowsUpdated, 0);
        const duration = Date.now() - startTime;

        logger.info("Completed sync for all spreadsheets", {
            total: syncResults.length,
            success: successCount,
            failed: failureCount,
            totalRowsUpdated: totalRows,
            duration: `${duration}ms`,
        });

        return syncResults;
    }

    /**
     * Format tariff data for Google Sheets
     * @param {ProcessedTariff[]} tariffs - Array of processed tariffs
     * @returns 2D array for Google Sheets (includes header row)
     */
    private formatTariffsForSheet(tariffs: ProcessedTariff[]): any[][] {
        // Header row
        const header = ["Warehouse", "Box Type", "Delivery Type", "Coefficient", "Date"];

        // Data rows - tariffs are already sorted by coefficient in ascending order
        const dataRows = tariffs.map((tariff) => [
            tariff.warehouseName,
            tariff.boxType,
            tariff.deliveryType,
            this.formatCoefficient(tariff.coefficient),
            this.formatDate(tariff.date),
        ]);

        return [header, ...dataRows];
    }

    /**
     * Format coefficient with 2 decimal places
     * @param {number} coefficient - Coefficient value
     * @returns Formatted string
     */
    private formatCoefficient(coefficient: number): string {
        return coefficient.toFixed(2);
    }

    /**
     * Format date as YYYY-MM-DD
     * @param {Date} date - Date object
     * @returns Formatted date string
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
}

/**
 * Default sheets sync instance
 */
export const sheetsSync = new SheetsSync();

export default sheetsSync;
