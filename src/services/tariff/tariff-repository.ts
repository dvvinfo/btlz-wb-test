import knex from "#postgres/knex.js";
import { createLogger } from "#utils/logger.js";

const logger = createLogger("tariff-repository");

/**
 * Processed tariff data for database storage
 */
export interface ProcessedTariff {
    date: Date;
    warehouseName: string;
    boxType: string;
    deliveryType: string;
    coefficient: number;
    rawData: object;
}

/**
 * Database row structure for tariffs table
 */
interface TariffRow {
    id: number;
    date: Date;
    warehouse_name: string;
    box_type: string;
    delivery_type: string;
    coefficient: number;
    raw_data: object;
    created_at: Date;
    updated_at: Date;
}

/**
 * Repository for tariff data operations
 */
export class TariffRepository {
    /**
     * Upsert daily tariffs into database
     * Updates existing records for the same day or inserts new ones
     * @param {ProcessedTariff[]} tariffs - Array of processed tariffs
     * @returns Promise with number of affected rows
     */
    async upsertDailyTariffs(tariffs: ProcessedTariff[]): Promise<number> {
        if (tariffs.length === 0) {
            logger.warn("No tariffs to upsert");
            return 0;
        }

        logger.info(`Upserting ${tariffs.length} tariffs into database`);

        try {
            const rows = tariffs.map((tariff) => ({
                date: tariff.date,
                warehouse_name: tariff.warehouseName,
                box_type: tariff.boxType,
                delivery_type: tariff.deliveryType,
                coefficient: tariff.coefficient,
                raw_data: JSON.stringify(tariff.rawData),
                updated_at: knex.fn.now(),
            }));

            await knex.transaction(async (trx) => {
                for (const row of rows) {
                    await trx("tariffs")
                        .insert(row)
                        .onConflict(["date", "warehouse_name", "box_type", "delivery_type"])
                        .merge({
                            coefficient: row.coefficient,
                            raw_data: row.raw_data,
                            updated_at: row.updated_at,
                        });
                }
            });

            logger.info(`Successfully upserted ${tariffs.length} tariffs`);
            return tariffs.length;
        } catch (error) {
            logger.error("Failed to upsert tariffs", error as Error, {
                count: tariffs.length,
            });
            throw error;
        }
    }

    /**
     * Get latest daily tariffs (most recent date)
     * @returns Promise with array of processed tariffs sorted by coefficient
     */
    async getLatestDailyTariffs(): Promise<ProcessedTariff[]> {
        logger.debug("Fetching latest daily tariffs from database");

        try {
            // Get the most recent date
            const latestDateResult = await knex("tariffs").max("date as maxDate").first();

            if (!latestDateResult || !latestDateResult.maxDate) {
                logger.info("No tariffs found in database");
                return [];
            }

            const latestDate = latestDateResult.maxDate;

            // Get all tariffs for that date, sorted by coefficient
            const rows: TariffRow[] = await knex("tariffs")
                .where("date", latestDate)
                .orderBy("coefficient", "asc")
                .select("*");

            const tariffs = rows.map((row) => this.mapRowToTariff(row));

            logger.info(`Retrieved ${tariffs.length} tariffs for date ${latestDate}`);
            return tariffs;
        } catch (error) {
            logger.error("Failed to fetch latest daily tariffs", error as Error);
            throw error;
        }
    }

    /**
     * Get tariffs for a specific date
     * @param {Date} date - Date to query
     * @returns Promise with array of processed tariffs sorted by coefficient
     */
    async getTariffsByDate(date: Date): Promise<ProcessedTariff[]> {
        logger.debug("Fetching tariffs by date", { date: date.toISOString() });

        try {
            const rows: TariffRow[] = await knex("tariffs")
                .where("date", date)
                .orderBy("coefficient", "asc")
                .select("*");

            const tariffs = rows.map((row) => this.mapRowToTariff(row));

            logger.info(`Retrieved ${tariffs.length} tariffs for date ${date.toISOString()}`);
            return tariffs;
        } catch (error) {
            logger.error("Failed to fetch tariffs by date", error as Error, {
                date: date.toISOString(),
            });
            throw error;
        }
    }

    /**
     * Map database row to ProcessedTariff
     * @param {TariffRow} row - Database row
     * @returns ProcessedTariff object
     */
    private mapRowToTariff(row: TariffRow): ProcessedTariff {
        return {
            date: new Date(row.date),
            warehouseName: row.warehouse_name,
            boxType: row.box_type,
            deliveryType: row.delivery_type,
            coefficient: Number(row.coefficient),
            rawData: typeof row.raw_data === "string" ? JSON.parse(row.raw_data) : row.raw_data,
        };
    }
}

/**
 * Default tariff repository instance
 */
export const tariffRepository = new TariffRepository();

export default tariffRepository;
