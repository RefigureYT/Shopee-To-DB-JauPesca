import { assertShopeeOk, shopeeGet } from "../../services/requestApiShopee.service.js";
import { InfoSellerConfig } from "../../config.js";
import type { ShopeeEnvelope } from "../../services/requestApiShopee.service.js";

/**
 * Status possível de um anúncio (item) na Shopee.
 *
 * - NORMAL: anúncio ativo/normal.
 * - UNLIST: anúncio deslistado (não visível para compra).
 * - BANNED: anúncio banido/restrito.
 * - DELETED: anúncio deletado/removido.
 */
export type GetItemListItemStatus = 'NORMAL' | 'UNLIST' | 'BANNED' | 'REVIEWING' | 'SELLER_DELETE' | 'SHOPEE_DELETE';
export type ItemData = {
    item_id: number,
    item_status: GetItemListItemStatus,

    /** Última atualização do item (Unix timestamp em segundos). */
    update_time: number
}

export type ItemListData = Array<ItemData>;

/**
 * Resposta do endpoint `get_item_list`.
 *
 * Retorna uma lista paginada de `item_id` (anúncios) com seu status e `update_time`.
 * Use `next_offset` para buscar a próxima página.
 */
export type GetItemListResponse = ShopeeEnvelope<{
    /** Indica se existe próxima página. (às vezes vem boolean puro ou 0/1) */
    has_next_page: boolean | 0 | 1;

    /** Lista de itens retornados na página atual. */
    item: ItemListData;

    /** Offset para a próxima página. */
    next_offset: number;

    /** Quantidade total de itens no filtro atual. */
    total_count: number;

    /** Campo que às vezes aparece vazio (depende da Shopee/região). */
    next?: any;
}>

/**
 * Lista anúncios (itens) da loja de forma paginada.
 *
 * Normalmente é o “primeiro passo” pra:
 * 1) pegar os `item_id` da loja
 * 2) consultar detalhes com `get_item_base_info(item_id_list)`
 * 3) consultar variações com `get_model_list(item_id)` quando necessário
 *
 * @param offset Posição/página atual. Use `next_offset` retornado pela Shopee.
 * @param pageSize Tamanho da página (quantos itens por chamada).
 * @param itemStatus Filtro por status do anúncio (ex.: "NORMAL").
 * @returns Envelope padrão da Shopee com paginação e lista de `item_id`.
 * @throws {Error} Se ocorrer erro HTTP (Axios) ou erro “de negócio” (error/message preenchidos).
 *
 * @example
 * const page1 = await get_item_list(0, 50, "NORMAL");
 * const ids = page1.response.item.map(i => i.item_id);
 */
export async function get_item_list(offset: number = 0, pageSize: number = 50, itemStatus: GetItemListItemStatus = 'NORMAL'): Promise<GetItemListResponse> {
    const url = InfoSellerConfig.host + "/api/v2/product/get_item_list";
    const res = await shopeeGet<GetItemListResponse>(url,
        { access_token: true, shop_id: true },
        { offset, page_size: pageSize, item_status: itemStatus }
    );

    //? Valida response
    return assertShopeeOk(res);
}


// curl -G 'https://partner.shopeemobile.com/api/v2/product/get_item_list' \
//   --data-urlencode 'partner_id=SEU_PARTNER_ID' \
//   --data-urlencode 'timestamp=1704182400' \
//   --data-urlencode 'access_token=SEU_ACCESS_TOKEN' \
//   --data-urlencode 'shop_id=SEU_SHOP_ID' \
//   --data-urlencode 'sign=SIGN_AQUI' \
//   --data-urlencode 'offset=0' \
//   --data-urlencode 'page_size=50' \
//   --data-urlencode 'item_status=NORMAL'