import { google } from "googleapis";
import { createLogger } from "#utils/logger.js";
import sheetsConfig from "./sheets-config.js";

const logger = createLogger("sheets-client");

/**
 * Google Sheets API client
 */
export class SheetsClient {
    private auth: any;
    private sheets: any;
    private config = sheetsConfig;

    constructor() {
        this.authenticate();
    }

    /**
     * Authenticate with Google Sheets API using service account
     */
    private authenticate(): void {
        try {
            logger.info("Authenticating with Google Sheets API");

            this.auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: this.config.serviceAccountEmail,
                    private_key: this.config.privateKey.replace(/\\n/g, "\n"),
                },
                scopes: ["https://www.googleapis.com/auth/spreadsheets"],
            });

            this.sheets = google.sheets({ version: "v4", auth: this.auth });

            logger.info("Successfully authenticated with Google Sheets API");
        } catch (error) {
            logger.error("Failed to authenticate with Google Sheets API", error as Error);
            throw error;
        }
    }

    /**
     * Update sheet with data
     * @param {string} spreadsheetId - Spreadsheet ID
     * @param {string} range - Range in A1 notation (e.g., "stocks_coefs!A1")
     * @param {any[][]} values - 2D array of values
     * @returns Promise that resolves when update completes
     */
    async updateSheet(spreadsheetId: string, range: string, values: any[][]): Promise<void> {
        logger.debug("Updating sheet", { spreadsheetId, range, rowCount: values.length });

        try {
            const response = await this.sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: "RAW",
                requestBody: {
                    values,
                },
            });

            logger.info("Successfully updated sheet", {
                spreadsheetId,
                range,
                updatedCells: response.data.updatedCells,
                updatedRows: response.data.updatedRows,
            });
        } catch (error: any) {
            if (error.code === 429) {
                logger.warn("Rate limit hit, will retry", { spreadsheetId });
                throw error;
            }

            logger.error("Failed to update sheet", error as Error, {
                spreadsheetId,
                range,
                statusCode: error.code,
            });
            throw error;
        }
    }

    /**
     * Clear sheet data
     * @param {string} spreadsheetId - Spreadsheet ID
     * @param {string} range - Range in A1 notation (e.g., "stocks_coefs!A:Z")
     * @returns Promise that resolves when clear completes
     */
    async clearSheet(spreadsheetId: string, range: string): Promise<void> {
        logger.debug("Clearing sheet", { spreadsheetId, range });

        try {
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId,
                range,
            });

            logger.info("Successfully cleared sheet", { spreadsheetId, range });
        } catch (error: any) {
            if (error.code === 429) {
                logger.warn("Rate limit hit, will retry", { spreadsheetId });
                throw error;
            }

            logger.error("Failed to clear sheet", error as Error, {
                spreadsheetId,
                range,
                statusCode: error.code,
            });
            throw error;
        }
    }

    /**
     * Batch update sheet - clear and then update
     * @param {string} spreadsheetId - Spreadsheet ID
     * @param {string} worksheetName - Worksheet name
     * @param {any[][]} values - 2D array of values
     * @returns Promise that resolves when operation completes
     */
    async batchUpdate(spreadsheetId: string, worksheetName: string, values: any[][]): Promise<void> {
        logger.debug("Performing batch update", {
            spreadsheetId,
            worksheetName,
            rowCount: values.length,
        });

        try {
            // Clear existing data
            await this.clearSheet(spreadsheetId, `${worksheetName}!A:Z`);

            // Update with new data
            await this.updateSheet(spreadsheetId, `${worksheetName}!A1`, values);

            logger.info("Successfully completed batch update", {
                spreadsheetId,
                worksheetName,
                rowCount: values.length,
            });
        } catch (error) {
            logger.error("Failed to perform batch update", error as Error, {
                spreadsheetId,
                worksheetName,
            });
            throw error;
        }
    }
}

/**
 * Default sheets client instance
 */
export const sheetsClient = new SheetsClient();

export default sheetsClient;
