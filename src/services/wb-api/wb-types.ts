import { z } from "zod";

/**
 * Box tariff data from WB API
 */
export interface BoxTariff {
    warehouseName: string;
    boxTypeName?: string;
    boxDeliveryAndStorageExpr?: string;
    boxDeliveryBase?: string;
    boxDeliveryLiter?: string;
    boxStorageBase?: string;
    boxStorageLiter?: string;
    // Additional fields that may be present
    [key: string]: any;
}

/**
 * Zod schema for single box tariff
 * Some fields may be undefined in API response
 */
export const BoxTariffSchema = z.object({
    warehouseName: z.string(),
    boxTypeName: z.string().optional(),
    boxDeliveryAndStorageExpr: z.string().optional(),
    boxDeliveryBase: z.string().optional(),
    boxDeliveryLiter: z.string().optional(),
    boxStorageBase: z.string().optional(),
    boxStorageLiter: z.string().optional(),
});

/**
 * WB API response structure
 */
export interface WBApiResponse {
    response: {
        data: {
            warehouseList: BoxTariff[];
        };
    };
}

/**
 * Zod schema for WB API response
 */
export const WBApiResponseSchema = z.object({
    response: z.object({
        data: z.object({
            warehouseList: z.array(BoxTariffSchema),
        }),
    }),
});

/**
 * Parse and validate WB API response
 * @param {unknown} data - Raw API response
 * @returns Validated box tariffs array
 * @throws ZodError if validation fails
 */
export function parseWBApiResponse(data: unknown): BoxTariff[] {
    const validated = WBApiResponseSchema.parse(data);
    return validated.response.data.warehouseList;
}
