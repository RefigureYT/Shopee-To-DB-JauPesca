import { Pool } from "pg";
import type { QueryResult, QueryResultRow } from "pg";
import { databaseInfosForAccessToken, databaseInfosForMarketplace, InfoSellerConfig } from "../config.js";

const dbUrl = databaseInfosForAccessToken.databaseUrl;
const schema = databaseInfosForAccessToken.databaseSchema;
const table = databaseInfosForAccessToken.databaseTable;

export const _db = new Pool({
    connectionString: dbUrl,
    max: 5, // Limite de conexões no pool
    idleTimeoutMillis: 10_000, // Fecha conexões ociosas
    connectionTimeoutMillis: 3_000 // Timeout para conseguir se conectar
}); //? Cria a conexão com o banco

const dbUrlMarketplaces = databaseInfosForMarketplace.databaseUrl;

export const _dbMarketplaces = new Pool({
    connectionString: dbUrlMarketplaces,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 3_000
});

// Fechar pool ao encerrar o processo (evita ficar "pendurado")
let shuttingDown = false;
async function shutdownPool(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
        console.log(`🧹 Encerrando pool do Postgres (${signal})...`);
        await _db.end();
        await _dbMarketplaces.end();
    } finally {
        process.exit(0);
    }
}

process.on("SIGINT", () => void shutdownPool("SIGINT"));
process.on("SIGTERM", () => void shutdownPool("SIGTERM"));

type TokenRow = QueryResultRow & { access_token: string };

function isTransientDbError(err: unknown): boolean {
    const msg = String((err as any)?.message ?? "");
    // mensagens comuns quando a conexão cai
    return (
        msg.includes("Connection terminated") ||
        msg.includes("terminating connection") ||
        msg.includes("ECONNRESET") ||
        msg.includes("EPIPE") ||
        msg.includes("ENET") ||
        msg.includes("timeout") ||
        msg.includes("Connection terminated unexpectedly")
    );
}

type DbTarget = "token" | "marketplaces";

function getPool(target: DbTarget) {
    return target === "marketplaces" ? _dbMarketplaces : _db;
}

async function queryWithRetry<T extends QueryResultRow>(
    text: string,
    params: unknown[],
    retries = 1,
    opts?: { db?: DbTarget }
): Promise<QueryResult<T>> {
    const pool = getPool(opts?.db ?? "token");

    try {
        return await pool.query<T>(text, params);
    } catch (err) {
        if (retries > 0 && isTransientDbError(err)) {
            await new Promise((r) => setTimeout(r, 200));
            return await pool.query<T>(text, params);
        }
        throw err;
    }
}

export async function getAccessToken(): Promise<string> {
    const fullTable = `${schema}.${table}`
    const query = `
    SELECT access_token 
    FROM ${fullTable}
    WHERE provider = $1
    LIMIT 1
    `;

    const res = await queryWithRetry<TokenRow>(query, ["shopee"], 1);
    const token = res.rows[0]?.access_token;

    if (!token) {
        throw new Error(
            `Nenhum access_token encontrado em ${fullTable} para provider='shopee'`
        )
    }
    InfoSellerConfig.accessToken = token;
    return token;
}

// =====================
// Shopee: UPSERT (bulk)
// =====================

function toTs(sec?: number | null): Date | null {
    if (!sec || sec <= 0) return null;
    return new Date(sec * 1000);
}

function toBool(v: unknown): boolean | null {
    if (v === true) return true;
    if (v === false) return false;

    // ✅ Shopee às vezes manda 0/1
    if (typeof v === "number") {
        if (v === 1) return true;
        if (v === 0) return false;
    }

    if (typeof v === "string") {
        const s = v.toLowerCase().trim();
        if (s === "true") return true;
        if (s === "false") return false;
        if (s === "1") return true;
        if (s === "0") return false;
    }
    return null;
}

type ShopeeItemBaseInfo = {
    item_id: number;
    item_status?: string;
    item_name?: string;
    item_sku?: string;
    gtin_code?: string;
    has_model?: boolean | number;
    has_promotion?: boolean | number;
    promotion_id?: number | null;
    create_time?: number;
    update_time?: number;
    description?: string;
    description_type?: string;
};

type ShopeeModel = {
    model_id: number;
    item_id: number;
    model_status?: string;
    model_sku?: string;
    gtin_code?: string;
    has_promotion?: boolean | number;
    promotion_id?: number | null;
    price_info?: Array<{
        current_price?: number;
        original_price?: number;
        local_price?: number;
        local_promotion_price?: number;
    }>;
    stock_info_v2?: {
        summary_info?: {
            total_available_stock?: number;
            total_reserved_stock?: number;
        };
    };
};

async function upsertInBatches<T>(
    rows: T[],
    batchSize: number,
    fn: (batch: T[]) => Promise<void>
): Promise<void> {
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await fn(batch);
    }
}

/**
 * UPSERT em shopee.items
 * - Espera receber o objeto "item" direto do response.item_list (get_item_base_info)
 * - Salva raw JSONB completo + campos-chave indexáveis
 */
export async function upsertShopeeItems(
    items: ShopeeItemBaseInfo[],
    opts?: { shopId?: number; schema?: string; batchSize?: number }
): Promise<void> {
    if (!items?.length) return;

    const schemaName = opts?.schema ?? "shopee";
    const shopId = opts?.shopId ?? (InfoSellerConfig as any).shopId;
    if (!shopId) throw new Error("shopId não definido (InfoSellerConfig.shopId ou opts.shopId).");

    const batchSize = opts?.batchSize ?? 1000;

    const sql = `
INSERT INTO ${schemaName}.items (
  shop_id,
  item_id,
  item_status,
  item_name,
  item_sku,
  gtin_code,
  has_model,
  has_promotion,
  promotion_id,
  create_time,
  update_time,
  raw,
  last_synced_at
)
SELECT
  $1::bigint AS shop_id,
  t.item_id,
  t.item_status,
  t.item_name,
  t.item_sku,
  t.gtin_code,
  t.has_model,
  t.has_promotion,
  t.promotion_id,
  t.create_time,
  t.update_time,
  t.raw,
  now()
FROM UNNEST(
  $2::bigint[],
  $3::text[],
  $4::text[],
  $5::text[],
  $6::text[],
  $7::boolean[],
  $8::boolean[],
  $9::bigint[],
  $10::timestamptz[],
  $11::timestamptz[],
  $12::jsonb[]
) AS t(
  item_id,
  item_status,
  item_name,
  item_sku,
  gtin_code,
  has_model,
  has_promotion,
  promotion_id,
  create_time,
  update_time,
  raw
)
ON CONFLICT (shop_id, item_id)
DO UPDATE SET
  item_status   = EXCLUDED.item_status,
  item_name     = EXCLUDED.item_name,
  item_sku      = EXCLUDED.item_sku,
  gtin_code     = EXCLUDED.gtin_code,
  has_model     = EXCLUDED.has_model,
  has_promotion = EXCLUDED.has_promotion,
  promotion_id  = EXCLUDED.promotion_id,
  create_time   = COALESCE(EXCLUDED.create_time, ${schemaName}.items.create_time),
  update_time   = GREATEST(COALESCE(EXCLUDED.update_time, ${schemaName}.items.update_time), ${schemaName}.items.update_time),
  raw           = EXCLUDED.raw,
  last_synced_at= now();
`;

    await upsertInBatches(items, batchSize, async (batch) => {
        const item_id = batch.map((i) => i.item_id);
        const item_status = batch.map((i) => i.item_status ?? null);
        const item_name = batch.map((i) => i.item_name ?? null);
        const item_sku = batch.map((i) => i.item_sku ?? null);
        const gtin_code = batch.map((i) => i.gtin_code ?? null);
        const has_model = batch.map((i) => toBool(i.has_model));
        const has_promotion = batch.map((i) => toBool(i.has_promotion));
        const promotion_id = batch.map((i) => (i.promotion_id ?? null) as any);
        const create_time = batch.map((i) => toTs(i.create_time ?? null));
        const update_time = batch.map((i) => toTs(i.update_time ?? null));
        const raw = batch.map((i) => JSON.stringify(i));

        await queryWithRetry("BEGIN", [], 1, { db: "marketplaces" });
        try {
            await queryWithRetry(sql, [
                shopId,
                item_id,
                item_status,
                item_name,
                item_sku,
                gtin_code,
                has_model,
                has_promotion,
                promotion_id,
                create_time,
                update_time,
                raw,
            ], 1, { db: "marketplaces" });
            await queryWithRetry("COMMIT", [], 1, { db: "marketplaces" });
        } catch (e) {
            await queryWithRetry("ROLLBACK", [], 1, { db: "marketplaces" });
            throw e;
        }
    });
}

/**
 * UPSERT em shopee.models
 * - Espera receber o objeto "model" direto do response.model (get_model_list)
 * - Salva raw JSONB completo + campos-chave indexáveis (SKU/GTIN/price/stock/promo)
 */
export async function upsertShopeeModels(
    models: ShopeeModel[],
    opts?: { shopId?: number; schema?: string; batchSize?: number }
): Promise<void> {
    if (!models?.length) return;

    const schemaName = opts?.schema ?? "shopee";
    const shopId = opts?.shopId ?? (InfoSellerConfig as any).shopId;
    if (!shopId) throw new Error("shopId não definido (InfoSellerConfig.shopId ou opts.shopId).");

    const batchSize = opts?.batchSize ?? 1000;

    const sql = `
INSERT INTO ${schemaName}.models (
  shop_id,
  model_id,
  item_id,
  model_status,
  model_sku,
  gtin_code,
  has_promotion,
  promotion_id,
  current_price,
  original_price,
  local_price,
  local_promotion_price,
  total_available_stock,
  total_reserved_stock,
  raw,
  last_synced_at
)
SELECT
  $1::bigint AS shop_id,
  t.model_id,
  t.item_id,
  t.model_status,
  t.model_sku,
  t.gtin_code,
  t.has_promotion,
  t.promotion_id,
  t.current_price,
  t.original_price,
  t.local_price,
  t.local_promotion_price,
  t.total_available_stock,
  t.total_reserved_stock,
  t.raw,
  now()
FROM UNNEST(
  $2::bigint[],
  $3::bigint[],
  $4::text[],
  $5::text[],
  $6::text[],
  $7::boolean[],
  $8::bigint[],
  $9::numeric[],
  $10::numeric[],
  $11::numeric[],
  $12::numeric[],
  $13::int[],
  $14::int[],
  $15::jsonb[]
) AS t(
  model_id,
  item_id,
  model_status,
  model_sku,
  gtin_code,
  has_promotion,
  promotion_id,
  current_price,
  original_price,
  local_price,
  local_promotion_price,
  total_available_stock,
  total_reserved_stock,
  raw
)
ON CONFLICT (shop_id, model_id)
DO UPDATE SET
  item_id              = EXCLUDED.item_id,
  model_status         = EXCLUDED.model_status,
  model_sku            = EXCLUDED.model_sku,
  gtin_code            = EXCLUDED.gtin_code,
  has_promotion        = EXCLUDED.has_promotion,
  promotion_id         = EXCLUDED.promotion_id,
  current_price        = EXCLUDED.current_price,
  original_price       = EXCLUDED.original_price,
  local_price          = EXCLUDED.local_price,
  local_promotion_price= EXCLUDED.local_promotion_price,
  total_available_stock= EXCLUDED.total_available_stock,
  total_reserved_stock = EXCLUDED.total_reserved_stock,
  raw                  = EXCLUDED.raw,
  last_synced_at       = now();
`;

    await upsertInBatches(models, batchSize, async (batch) => {
        const model_id = batch.map((m) => m.model_id);
        const item_id = batch.map((m) => m.item_id);
        const model_status = batch.map((m) => m.model_status ?? null);
        const model_sku = batch.map((m) => m.model_sku ?? null);
        const gtin_code = batch.map((m) => m.gtin_code ?? null);

        const has_promotion = batch.map((m) => toBool(m.has_promotion));
        const promotion_id = batch.map((m) => (m.promotion_id ?? null) as any);

        const current_price = batch.map((m) => m.price_info?.[0]?.current_price ?? null);
        const original_price = batch.map((m) => m.price_info?.[0]?.original_price ?? null);
        const local_price = batch.map((m) => m.price_info?.[0]?.local_price ?? null);
        const local_promotion_price = batch.map((m) => m.price_info?.[0]?.local_promotion_price ?? null);

        const total_available_stock = batch.map((m) => m.stock_info_v2?.summary_info?.total_available_stock ?? null);
        const total_reserved_stock = batch.map((m) => m.stock_info_v2?.summary_info?.total_reserved_stock ?? null);

        const raw = batch.map((m) => JSON.stringify(m));

        await queryWithRetry("BEGIN", [], 1, { db: "marketplaces" });
        try {
            await queryWithRetry(sql, [
                shopId,
                model_id,
                item_id,
                model_status,
                model_sku,
                gtin_code,
                has_promotion,
                promotion_id,
                current_price,
                original_price,
                local_price,
                local_promotion_price,
                total_available_stock,
                total_reserved_stock,
                raw,
            ], 1, { db: "marketplaces" });
            await queryWithRetry("COMMIT", [], 1, { db: "marketplaces" });
        } catch (e) {
            await queryWithRetry("ROLLBACK", [], 1, { db: "marketplaces" });
            throw e;
        }
    });
}