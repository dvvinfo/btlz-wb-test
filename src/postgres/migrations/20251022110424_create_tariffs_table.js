/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
    return knex.schema.createTable("tariffs", (table) => {
        table.increments("id").primary();
        table.date("date").notNullable();
        table.string("warehouse_name", 255).notNullable();
        table.string("box_type", 100).notNullable();
        table.string("delivery_type", 100).notNullable();
        table.decimal("coefficient", 10, 2).notNullable();
        table.jsonb("raw_data").notNullable();
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());

        // Unique constraint to prevent duplicates for same day
        table.unique(["date", "warehouse_name", "box_type", "delivery_type"], {
            indexName: "unique_daily_tariff",
        });

        // Indexes for efficient querying
        table.index("date", "idx_tariffs_date");
        table.index("warehouse_name", "idx_tariffs_warehouse");
        table.index("coefficient", "idx_tariffs_coefficient");
    });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
    return knex.schema.dropTableIfExists("tariffs");
}
