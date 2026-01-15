import { InfoSellerConfig } from "../../config.js";
import { assertShopeeOk, shopeeGet } from "../../services/requestApiShopee.service.js";
import type { ShopeeEnvelope } from "../../services/requestApiShopee.service.js";

/**
 * A Shopee às vezes retorna flags booleanas como `true/false` e às vezes como `0/1`.
 * Esse tipo padroniza isso pra evitar dor de cabeça no TS.
 */
type ShopeeBool = boolean | 0 | 1;

export type GetModelList = {
    tier_variation?: Array<{
        name?: string;
        option_list?: Array<{
            option?: string;
            image?: { image_url?: string; image_id?: string } | null;
        }>;
    }>;

    model: Array<{
        model_id: number;
        model_name?: string;

        promotion_id?: number;
        has_promotion?: ShopeeBool;

        /** Índices que apontam para as opções em `tier_variation`. */
        tier_index?: number[];

        price_info?: Array<{
            current_price?: number;
            original_price?: number;
            inflated_price_of_current_price?: number;
            inflated_price_of_original_price?: number;
            currency?: string;
        }>;

        model_sku?: string;

        pre_order?: {
            is_pre_order?: ShopeeBool;
            days_to_ship?: number;
        };

        stock_info_v2?: {
            summary_info?: {
                total_reserved_stock?: number;
                total_available_stock?: number;
            };
            seller_stock?: Array<{
                location_id?: string;
                stock?: number;
                if_saleable?: ShopeeBool;
            }>;
            shopee_stock?: Array<{
                location_id?: string;
                stock?: number;
            }>;
            advance_stock?: {
                sellable_advance_stock?: number;
                in_transit_advance_stock?: number;
            };
        };

        gtin_code?: string;
        model_status?: string;

        weight?: number;
        dimension?: {
            package_length?: number;
            package_width?: number;
            package_height?: number;
        };

        is_fulfillment_by_shopee?: ShopeeBool;
    }>;

    standardise_tier_variation?: Array<{
        variation_id?: number;
        variation_name?: string;
        variation_option_list?: Array<{
            variation_option_id?: number;
            variation_option_name?: string;
            image_id?: string;
            image_url?: string;
        }>;
    }>;
}

/**
 * Resposta do endpoint `get_model_list`.
 *
 * Retorna as variações (“models”) de UM anúncio (`item_id`):
 * - `tier_variation`: opções/atributos (ex.: cor, tamanho) e imagens das opções
 * - `model`: lista de variações com `model_id`, SKU, preço, estoque, etc.
 *
 * Observação: alguns campos podem não vir dependendo do anúncio e do tipo de produto,
 * por isso há muitos opcionais.
 */
export type GetModelListResponse = ShopeeEnvelope<GetModelList>;

/**
 * Lista as variações (`model_id`) de UM anúncio (`item_id`).
 *
 * Esse endpoint é por item (não aceita lista).
 * Use quando:
 * - `get_item_base_info` indicar `has_model = true`
 * - você precisar atualizar preço por variação (`update_price`)
 * - você precisar aplicar promoção por variação (`add_discount_item`)
 *
 * @param itemId ID do anúncio (`item_id`) para consultar variações.
 * @returns Envelope padrão da Shopee contendo as variações (`model`) e atributos (`tier_variation`).
 * @throws {Error} Se ocorrer erro HTTP (Axios) ou erro “de negócio” (error/message preenchidos).
 *
 * @example
 * const models = await get_model_list(53553342037);
 * console.log(models.response.tier_variation?.[0]);
 * console.log(models.response.model?.[0]?.model_id);
 */
export async function get_model_list(itemId: number): Promise<GetModelListResponse> {
    const url = InfoSellerConfig.host + "/api/v2/product/get_model_list";
    const res = await shopeeGet<GetModelListResponse>(url,
        { access_token: true, shop_id: true },
        { item_id: itemId }
    );

    //? Valida response
    return assertShopeeOk(res);
}
// curl -G 'https://partner.shopeemobile.com/api/v2/product/get_model_list' \
//   --data-urlencode 'partner_id=SEU_PARTNER_ID' \
//   --data-urlencode 'timestamp=1704182400' \
//   --data-urlencode 'access_token=SEU_ACCESS_TOKEN' \
//   --data-urlencode 'shop_id=SEU_SHOP_ID' \
//   --data-urlencode 'sign=SIGN_AQUI' \
//   --data-urlencode 'item_id=123456789'
