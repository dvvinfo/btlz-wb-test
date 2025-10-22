import env from "#config/env/env.js";

/**
 * WB API configuration
 */
export interface WBApiConfig {
    token: string;
    baseUrl: string;
    timeout: number;
    endpoints: {
        boxTariffs: string;
    };
}

/**
 * Get WB API configuration from environment
 * @returns WB API configuration object
 */
export function getWBApiConfig(): WBApiConfig {
    return {
        token: env.WB_API_TOKEN || "",
        baseUrl: env.WB_API_BASE_URL || "https://common-api.wildberries.ru",
        timeout: env.WB_API_TIMEOUT || 30000,
        endpoints: {
            boxTariffs: "/api/v1/tariffs/box",
        },
    };
}

export default getWBApiConfig();
