import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.union([z.undefined(), z.enum(["development", "production"])]),
    POSTGRES_HOST: z.union([z.undefined(), z.string()]),
    POSTGRES_PORT: z
        .string()
        .regex(/^[0-9]+$/)
        .transform((value) => parseInt(value)),
    POSTGRES_DB: z.string(),
    POSTGRES_USER: z.string(),
    POSTGRES_PASSWORD: z.string(),
    APP_PORT: z.union([
        z.undefined(),
        z
            .string()
            .regex(/^[0-9]+$/)
            .transform((value) => parseInt(value)),
    ]),
    // WB API configuration
    WB_API_TOKEN: z.union([z.undefined(), z.string().min(1, "WB API token is required")]),
    WB_API_BASE_URL: z.union([z.undefined(), z.string().url()]).default("https://common-api.wildberries.ru"),
    WB_API_TIMEOUT: z
        .union([
            z.undefined(),
            z
                .string()
                .regex(/^[0-9]+$/)
                .transform((value) => parseInt(value)),
        ])
        .default("30000"),
    // Google Sheets configuration
    GOOGLE_SERVICE_ACCOUNT_EMAIL: z.union([z.undefined(), z.string().email("Invalid service account email")]),
    GOOGLE_PRIVATE_KEY: z.union([z.undefined(), z.string().min(1, "Google private key is required")]),
    GOOGLE_SPREADSHEET_IDS: z.union([
        z.undefined(),
        z
            .string()
            .min(1, "At least one spreadsheet ID is required")
            .transform((value) => value.split(",").map((id) => id.trim())),
    ]),
    // Scheduler configuration
    TARIFF_FETCH_CRON: z.string().default("0 * * * *"),
    SHEETS_SYNC_CRON: z.string().default("0 */6 * * *"),
    // Logging configuration
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

const env = envSchema.parse({
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PORT: process.env.POSTGRES_PORT,
    POSTGRES_DB: process.env.POSTGRES_DB,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    NODE_ENV: process.env.NODE_ENV,
    APP_PORT: process.env.APP_PORT,
    // WB API
    WB_API_TOKEN: process.env.WB_API_TOKEN,
    WB_API_BASE_URL: process.env.WB_API_BASE_URL,
    WB_API_TIMEOUT: process.env.WB_API_TIMEOUT,
    // Google Sheets
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
    GOOGLE_SPREADSHEET_IDS: process.env.GOOGLE_SPREADSHEET_IDS,
    // Scheduler
    TARIFF_FETCH_CRON: process.env.TARIFF_FETCH_CRON,
    SHEETS_SYNC_CRON: process.env.SHEETS_SYNC_CRON,
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL,
});

export default env;
