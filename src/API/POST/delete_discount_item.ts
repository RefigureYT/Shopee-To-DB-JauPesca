import { InfoSellerConfig } from "../../config.js";
import { assertShopeeOk, shopeePost } from "../../services/requestApiShopee.service.js";
import type { ShopeeEnvelope } from "../../services/requestApiShopee.service.js";

type DeleteDiscountItemBody = {
    discount_id: number,
    item_id: number,
    model_id: number
}

type DeleteDiscountItemResponseSuccess = ShopeeEnvelope<{
    discount_id: number,
    error_list: string[] /** Geralmente vem vazio quando sucesso em geral, mas alguns podem falhar */
}>

type DeleteDiscountItemResponse = DeleteDiscountItemResponseSuccess | ShopeeEnvelope<{}>;

export async function delete_discount_item(body: DeleteDiscountItemBody): Promise<DeleteDiscountItemResponse> {
    const url = InfoSellerConfig.host + "/api/v2/discount/delete_discount_item";

    const res = await shopeePost<DeleteDiscountItemResponseSuccess>(url,
        { access_token: true, shop_id: true }, body
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
