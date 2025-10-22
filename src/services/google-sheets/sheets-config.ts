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
 * Get Google Sheets configuration from environment
 * @returns Google Sheets configuration object
 * @throws Error if configuration is invalid
 */
export function getSheetsConfig(): SheetsConfig {
    const serviceAccountEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = env.GOOGLE_PRIVATE_KEY;
    const spreadsheetIds = env.GOOGLE_SPREADSHEET_IDS;

    // Validate configuration
    if (!serviceAccountEmail) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured");
    }

    if (!privateKey) {
        throw new Error("GOOGLE_PRIVATE_KEY is not configured");
    }

    if (!spreadsheetIds || spreadsheetIds.length === 0) {
        throw new Error("GOOGLE_SPREADSHEET_IDS is not configured or empty");
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

export default getSheetsConfig();
