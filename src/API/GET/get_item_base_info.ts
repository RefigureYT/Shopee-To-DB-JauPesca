import { InfoSellerConfig } from "../../config.js"
import { assertShopeeOk, shopeeGet } from "../../services/requestApiShopee.service.js";
import type { GetItemListItemStatus } from "./get_item_list.js";
import type { ShopeeEnvelope } from "../../services/requestApiShopee.service.js";

export type GetItemBaseInfoResponseItemList = {
    /** ID do anúncio/produto na Shopee. */
    item_id: number;

    /** Nome do anúncio. */
    item_name?: string;

    /** SKU do seller (se existir). */
    item_sku?: string;

    /** Status do anúncio (ex.: NORMAL, UNLIST, etc.). */
    item_status?: GetItemListItemStatus;

    /** ID da categoria do anúncio. */
    category_id?: number;

    /** Descrição do anúncio (texto longo). */
    description?: string;

    /** Indica o “tipo”/formato da descrição retornada pela API. */
    description_type?: string;

    /** Marca do produto (quando cadastrada). */
    brand?: {
        /** ID interno da marca na Shopee. */
        brand_id?: number;
        /** Nome original da marca. */
        original_brand_name?: string;
    };

    /** Informações de imagens principais do anúncio. */
    image?: {
        /** Lista de IDs de imagem. */
        image_id_list?: string[];
        /** Lista de URLs de imagem. */
        image_url_list?: string[];
        /** Proporção/ratio quando disponível (ex.: "1:1"). */
        image_ratio?: string;
    };

    /** Preços do anúncio (pode vir lista por moeda). */
    price_info?: Array<{
        /** Moeda (ex.: BRL). */
        currency?: string;
        /** Preço “cheio”/original. */
        original_price?: number;
        /** Preço atual exibido. */
        current_price?: number;
    }>;

    /**
     * Peso (algumas respostas vêm como string — ex.: "5").
     * Mantenho amplo para não quebrar em runtime.
     */
    weight?: number | string;

    /**
     * Dimensões “soltas” (alguns endpoints/versões retornam assim).
     * Observação: no seu JSON também veio dentro de `dimension`.
     */
    package_length?: number;
    package_width?: number;
    package_height?: number;

    /** Dimensões de embalagem (muito comum vir aqui). */
    dimension?: {
        /** Comprimento da embalagem. */
        package_length?: number;
        /** Largura da embalagem. */
        package_width?: number;
        /** Altura da embalagem. */
        package_height?: number;
    };

    /** Prazo padrão de despacho (dias). */
    days_to_ship?: number;

    /** Informações de logística/frete habilitadas no item. */
    logistic_info?: Array<{
        /** ID do método logístico. */
        logistic_id?: number;
        /** Nome do método logístico. */
        logistic_name?: string;
        /** Se está habilitado para o item. */
        enabled?: boolean;
        /** ID de tamanho de envio (quando aplicável). */
        size_id?: number;
        /** Se é frete grátis. */
        is_free?: boolean;
    }>;

    /** Pré-venda e prazo (quando aplicável). */
    pre_order?: {
        /** Se é pré-venda. */
        is_pre_order?: boolean;
        /** Dias para envio em pré-venda. */
        days_to_ship?: number;
    };

    /** Condição do produto (ex.: NEW). */
    condition?: string;

    /** Texto do size chart (pode vir vazio). */
    size_chart?: string;

    /** ID do size chart (quando aplicável). */
    size_chart_id?: number;

    /**
     * Indica se possui variações (às vezes boolean puro ou 0/1).
     */
    has_model?: boolean | 0 | 1;

    /** ID de promoção associada (quando existir). */
    promotion_id?: number;

    /**
     * Indica se está em alguma promoção (às vezes boolean puro ou 0/1).
     */
    has_promotion?: boolean | 0 | 1;

    /** GTIN/EAN do produto (quando fornecido). */
    gtin_code?: string;

    /** Sinalizador interno relacionado a itens perigosos (quando existir). */
    item_dangerous?: number;

    /** Imagens específicas de promoção (quando existir). */
    promotion_image?: {
        /** Lista de IDs de imagem. */
        image_id_list?: string[];
        /** Lista de URLs de imagem. */
        image_url_list?: string[];
    };

    /** Campo de “deboost” (às vezes vem como string tipo "FALSE"). */
    deboost?: string;

    /** Informações de compatibilidade (normalmente objeto aberto). */
    compatibility_info?: Record<string, unknown>;

    /** ID de marca autorizada (quando aplicável). */
    authorised_brand_id?: number;

    /** Se é fulfillment by Shopee. */
    is_fulfillment_by_shopee?: boolean;

    /** Informações de limite mínimo de compra. */
    purchase_limit_info?: {
        /** Limite mínimo por compra (ex.: 1). */
        min_purchase_limit?: number;
    };

    /**
     * Estoque v2 (pode trazer múltiplas seções: seller/shopee/advance).
     * Aqui eu tiparei o que você já usa e o que apareceu no seu JSON,
     * deixando o resto flexível sem perder segurança do essencial.
     */
    stock_info_v2: {
        /** Resumo de estoque. */
        summary_info: {
            /** Total reservado. */
            total_reserved_stock: number;
            /** Total disponível para venda. */
            total_available_stock: number;
        };

        /** Estoque do seller (estrutura pode variar). */
        seller_stock?: Array<Record<string, unknown>>;

        /** Estoque da Shopee (estrutura pode variar). */
        shopee_stock?: Array<Record<string, unknown>>;

        /** Estoque avançado (quando existir). */
        advance_stock?: {
            /** Estoque “sellable” avançado. */
            sellable_advance_stock?: number;
            /** Estoque avançado em trânsito. */
            in_transit_advance_stock?: number;
            /** Campos extras possíveis. */
            [key: string]: unknown;
        };

        /** Campos extras possíveis. */
        [key: string]: unknown;
    };

    /** Timestamps Unix (segundos). */
    update_time?: number;
    /** Timestamps Unix (segundos). */
    create_time?: number;

    /** Tags gerais do item. */
    tag?: {
        /** Se é kit/bundle. */
        kit?: boolean;
    };
};

/**
 * Resposta do endpoint `get_item_base_info`.
 *
 * Retorna informações “base” de múltiplos anúncios de uma vez, a partir de uma lista de `item_id`.
 * Observação: vários campos podem vir ausentes dependendo do item, categoria ou permissões,
 * por isso a maioria está como opcional (`?`).
 */
export type GetItemBaseInfoResponse = ShopeeEnvelope<{ item_list: GetItemBaseInfoResponseItemList[]; }>
/**
 * Busca as informações base de vários anúncios (itens) de uma vez.
 *
 * Útil pra “enriquecer” os `item_id` obtidos no `get_item_list`,
 * trazendo nome, SKU, dimensões, imagens, etc.
 *
 * @param itemIdList Lista de IDs de anúncios (`item_id`) para consultar.
 * @returns Envelope padrão da Shopee contendo `item_list`.
 * @throws {Error} Se ocorrer erro HTTP (Axios) ou erro “de negócio” (error/message preenchidos).
 *
 * @example
 * const list = await get_item_list(0, 50, "NORMAL");
 * const ids = list.response.item.map(i => i.item_id);
 * const base = await get_item_base_info(ids);
 * console.log(base.response.item_list[0]?.item_sku);
 */
export async function get_item_base_info(itemIdList: number[]): Promise<GetItemBaseInfoResponse> {
    const url = InfoSellerConfig.host + "/api/v2/product/get_item_base_info";
    const res = await shopeeGet<GetItemBaseInfoResponse>(url,
        { access_token: true, shop_id: true },
        { item_id_list: itemIdList }
    );

    //? Valida response
    return assertShopeeOk(res);
}


// curl -G 'https://partner.shopeemobile.com/api/v2/product/get_item_base_info' \
//   --data-urlencode 'partner_id=SEU_PARTNER_ID' \
//   --data-urlencode 'timestamp=1704182400' \
//   --data-urlencode 'access_token=SEU_ACCESS_TOKEN' \
//   --data-urlencode 'shop_id=SEU_SHOP_ID' \
//   --data-urlencode 'sign=SIGN_AQUI' \
//   --data-urlencode 'item_id_list=[123456789,987654321]'
