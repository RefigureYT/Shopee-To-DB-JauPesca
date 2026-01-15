import { InfoSellerConfig } from "../../config.js";
import { assertShopeeOk, shopeePost } from "../../services/requestApiShopee.service.js";
import type { ShopeeEnvelope } from "../../services/requestApiShopee.service.js";

type ResponseSuccess = ShopeeEnvelope<{
    discount_id: number;
    modify_time: number;
}>

type EndDiscountResponse = ResponseSuccess | ShopeeEnvelope<{}>;

export async function end_discount(discount_id: number): Promise<EndDiscountResponse> {
    const url = InfoSellerConfig.host + "/api/v2/discount/end_discount";

    const res = await shopeePost<ResponseSuccess>(url,
        { access_token: true, shop_id: true },
        { discount_id }
    );

    //? Valida response
    return assertShopeeOk(res);
}