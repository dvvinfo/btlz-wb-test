import env from "#config/env/env.js";
import { createLogger } from "#utils/logger.js";

const logger = createLogger("sheets-config");

/**
 * Google Sheets configuration
 */
export interface SheetsConfig {
    serviceAccountEmail: string;
    privateKey: string;
    spreadsheetIds: string[];
    worksheetName: string;
}

/**
 * Check if Google Sheets is configured
 * @returns True if Google Sheets is configured
 */
export function isSheetsConfigured(): boolean {
    return !!(env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY && env.GOOGLE_SPREADSHEET_IDS);
}

/**
 * Get Google Sheets configuration from environment
 * @returns Google Sheets configuration object or null if not configured
 */
export function getSheetsConfig(): SheetsConfig | null {
    const serviceAccountEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = env.GOOGLE_PRIVATE_KEY;
    const spreadsheetIds = env.GOOGLE_SPREADSHEET_IDS;

    // Check if configured
    if (!serviceAccountEmail || !privateKey || !spreadsheetIds) {
        logger.info("Google Sheets is not configured, sync will be disabled");
        return null;
    }

    // Validate spreadsheet ID format (basic check)
    for (const id of spreadsheetIds) {
        if (!id || id.trim().length === 0) {
            logger.warn("Empty spreadsheet ID found in configuration, skipping");
            continue;
        }
        if (id.length < 20) {
            logger.warn(`Spreadsheet ID "${id}" looks invalid (too short)`);
        }
    }

    const validSpreadsheetIds = spreadsheetIds.filter((id) => id && id.trim().length > 0);

    if (validSpreadsheetIds.length === 0) {
        throw new Error("No valid spreadsheet IDs found in configuration");
    }

    logger.info(`Loaded Google Sheets configuration with ${validSpreadsheetIds.length} spreadsheet(s)`);

    return {
        serviceAccountEmail,
        privateKey,
        spreadsheetIds: validSpreadsheetIds,
        worksheetName: "stocks_coefs",
    };
}

const config = getSheetsConfig();
export default config;
