import { z } from "zod";

/**
 * Box tariff data from WB API
 */
export interface BoxTariff {
    warehouseName: string;
    boxTypeName: string;
    boxDeliveryAndStorageExpr: string;
    boxDeliveryBase: string;
    boxDeliveryLiter: string;
    boxStorageBase: string;
    boxStorageLiter: string;
}

/**
 * Zod schema for single box tariff
 */
export const BoxTariffSchema = z.object({
    warehouseName: z.string(),
    boxTypeName: z.string(),
    boxDeliveryAndStorageExpr: z.string(),
    boxDeliveryBase: z.string(),
    boxDeliveryLiter: z.string(),
    boxStorageBase: z.string(),
    boxStorageLiter: z.string(),
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
