import { createLogger } from "#utils/logger.js";
import { retryWithCondition } from "#utils/retry.js";
import wbConfig from "./wb-config.js";
import { BoxTariff, parseWBApiResponse } from "./wb-types.js";

const logger = createLogger("wb-api-client");

/**
 * WB API Client for fetching tariff data
 */
export class WBApiClient {
    private config = wbConfig;

    /**
     * Fetch box tariffs from WB API
     * @returns Promise with array of box tariffs
     * @throws Error if API request fails after retries
     */
    async fetchBoxTariffs(): Promise<BoxTariff[]> {
        // WB API requires date parameter in YYYY-MM-DD format
        const today = new Date().toISOString().split("T")[0];
        const url = `${this.config.baseUrl}${this.config.endpoints.boxTariffs}?date=${today}`;

        logger.info("Fetching box tariffs from WB API", { url, date: today });

        const startTime = Date.now();

        try {
            const tariffs = await retryWithCondition(
                async () => {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

                    try {
                        const response = await fetch(url, {
                            method: "GET",
                            headers: {
                                Authorization: `Bearer ${this.config.token}`,
                                "Content-Type": "application/json",
                            },
                            signal: controller.signal,
                        });

                        clearTimeout(timeoutId);

                        if (!response.ok) {
                            const errorText = await response.text();
                            logger.error(`WB API request failed with status ${response.status}`, {
                                status: response.status,
                                statusText: response.statusText,
                                body: errorText,
                            });

                            const error: any = new Error(`WB API request failed: ${response.status} ${response.statusText}`);
                            error.response = { status: response.status, statusText: response.statusText };
                            throw error;
                        }

                        const data = await response.json();
                        const tariffs = parseWBApiResponse(data);

                        const duration = Date.now() - startTime;
                        logger.info("Successfully fetched box tariffs from WB API", {
                            count: tariffs.length,
                            duration: `${duration}ms`,
                        });

                        return tariffs;
                    } catch (error) {
                        clearTimeout(timeoutId);

                        if (error instanceof Error && error.name === "AbortError") {
                            const timeoutError: any = new Error(`WB API request timeout after ${this.config.timeout}ms`);
                            timeoutError.name = "TimeoutError";
                            timeoutError.code = "ETIMEDOUT";
                            throw timeoutError;
                        }

                        throw error;
                    }
                },
                {
                    maxAttempts: 3,
                    initialDelay: 5 * 60 * 1000, // 5 minutes
                    maxDelay: 30 * 60 * 1000, // 30 minutes
                    backoffMultiplier: 2,
                },
                "WB API fetchBoxTariffs",
            );

            return tariffs;
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error("Failed to fetch box tariffs from WB API after all retries", error as Error, {
                duration: `${duration}ms`,
            });
            throw error;
        }
    }
}

/**
 * Default WB API client instance
 */
export const wbApiClient = new WBApiClient();

export default wbApiClient;
