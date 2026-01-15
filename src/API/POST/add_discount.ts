import { InfoSellerConfig } from "../../config.js";
import { assertShopeeOk, shopeePost } from "../../services/requestApiShopee.service.js";
import type { ShopeeEnvelope } from "../../services/requestApiShopee.service.js";

/**
 * Parâmetros para criação de uma campanha de desconto (promoção).
 * `start_time` e `end_time` devem estar em Unix timestamp (segundos).
 */
type AddDiscountObjParameters = {
    /** Nome da campanha (aparece no painel/gestão de promoções). */
    discount_name: string;
    /** Início da campanha (Unix timestamp em segundos). */
    start_time: number; /** Timestamp */
    /** Fim da campanha (Unix timestamp em segundos). */
    end_time: number; /** Timestamp */
}

/**
 * Resposta ao criar uma campanha de desconto.
 * Em alguns cenários o `response` pode trazer `discount_id`.
 */
export type AddDiscountResponse = ShopeeEnvelope<{ discount_id: number }>;

/**
 * Cria uma campanha de desconto (promoção) na Shopee.
 *
 * Fluxo típico:
 * 1) Cria a campanha com `add_discount(...)` -> obtém `discount_id`
 * 2) Adiciona itens/váriações e preço promocional com `add_discount_item(discount_id, ...)`
 *
 * @param obj Dados da campanha (nome + janela de tempo).
 * @returns Envelope com `discount_id` (quando presente).
 * @throws {Error} Se houver erro HTTP (Axios) ou erro de negócio da Shopee.
 */
export async function add_discount(obj: AddDiscountObjParameters): Promise<AddDiscountResponse> {
    const url = InfoSellerConfig.host + "/api/v2/discount/add_discount"
    const res = await shopeePost<AddDiscountResponse>(url,
        { access_token: true, shop_id: true },
        { discount_name: obj.discount_name, start_time: obj.start_time, end_time: obj.end_time }
    );

    //? Valida response
    return assertShopeeOk(res);
}

// curl -X POST 'https://partner.shopeemobile.com/api/v2/discount/add_discount' \
//   -H 'Content-Type: application/json' \
//   -d '{
//     "partner_id": SEU_PARTNER_ID,
//     "timestamp": 1704182400,
//     "access_token": "SEU_ACCESS_TOKEN",
//     "shop_id": SEU_SHOP_ID,
//     "sign": "SIGN_AQUI",
//     "discount_name": "Promo Janeiro",
//     "start_time": 1704186000,
//     "end_time": 1704272400
//   }'
