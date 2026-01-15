import { InfoSellerConfig } from "../../config.js";
import { assertShopeeOk, shopeePost } from "../../services/requestApiShopee.service.js";
import type { ShopeeEnvelope } from "../../services/requestApiShopee.service.js";
/**
 * Resposta ao adicionar itens a uma campanha de desconto.
 * Pode haver sucesso e falha misturados na mesma chamada:
 * - `success_item_list`: itens aplicados
 * - `failed_item_list`: itens rejeitados com motivo
 */
type AddDiscountItemResponse = ShopeeEnvelope<{
    discount_id: number;

    success_item_list: Array<{
        item_id: number;
        model_id: number;
        promotion_price: number;
    }>;

    failed_item_list: Array<{
        item_id: number;
        model_id: number;
        error?: string;
        message?: string;
    }>; /** Pode vir itens falhos e itens bem sucedidos numa mesma response: {}*/
}>;

export type AddDiscountItem_ItemListWithoutVariation = {
    /** ID do anúncio. */
    item_id: number;
    item_promotion_price: number; /** O preço com desconto do item. Se o item não tiver variação, este parâmetro é necessário. */

    item_promotion_stock?: number; /** O estoque reservado do item. */
    /** Quantidade máxima que pode ser vendida por cliente */
    purchase_limit: number;
}

export type AddDiscountModelList = {
    model_id: number,
    model_promotion_price: number /** Esse daqui é number no formato 399.99 */
    model_promotion_stock?: number /** Esse daqui é number no formato 399.99 */
}

export type AddDiscountItem_ItemListWithVariation = {
    item_id: number;
    purchase_limit: number;
    item_promotion_price?: number; /** Este daqui ele não é obrigatório quando possui variação, mas se colocado ele vai alterar o preço do anúncio PAI */
    model_list: AddDiscountModelList[]
}
/**
 * Item para inserir/atualizar dentro de uma campanha de desconto.
 * Você pode enviar vários itens (e várias variações) em uma única chamada.
 */
export type AddDiscountItem_ItemList = AddDiscountItem_ItemListWithoutVariation | AddDiscountItem_ItemListWithVariation;

/**
 * Faz uma promoção no estilo “preço riscado -> preço promocional”,
 * adicionando itens (e variações) dentro de uma campanha de desconto existente.
 *
 * Importante:
 * - a campanha precisa existir (`discount_id`)
 * - para produtos com variação, envie um item por `model_id` com seu `promotion_price`
 *
 * @param discountId ID da campanha de desconto.
 * @param itemList Lista de itens/variações e seus preços promocionais.
 * @returns Envelope com listas de sucesso e falha.
 * @throws {Error} Se houver erro HTTP (Axios) ou erro de negócio da Shopee.
 */
export async function add_discount_item(discountId: number, itemOrItems: AddDiscountItem_ItemList[]): Promise<AddDiscountItemResponse> {
    const url = InfoSellerConfig.host + "/api/v2/discount/add_discount_item";

    const res = await shopeePost<AddDiscountItemResponse>(url,
        { access_token: true, shop_id: true },
        { discount_id: discountId, item_list: itemOrItems }
    );

    //? Valida response
    return assertShopeeOk(res);

}

// curl -X POST 'https://partner.shopeemobile.com/api/v2/discount/add_discount_item' \
//   -H 'Content-Type: application/json' \
//   -d '{
//     "partner_id": SEU_PARTNER_ID,
//     "timestamp": 1704182400,
//     "access_token": "SEU_ACCESS_TOKEN",
//     "shop_id": SEU_SHOP_ID,
//     "sign": "SIGN_AQUI",
//     "discount_id": 11223344,
//     "item_list": [
//       { "item_id": 123456789, "model_id": 0, "promotion_price": 199.99 }
//     ]
//   }'
