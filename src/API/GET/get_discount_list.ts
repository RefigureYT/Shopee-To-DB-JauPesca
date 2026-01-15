import { InfoSellerConfig } from "../../config.js";
import { assertShopeeOk, shopeeGet } from "../../services/requestApiShopee.service.js";
import type { ShopeeEnvelope } from "../../services/requestApiShopee.service.js";

export type RequestParameter = {
    discount_status: DiscountListStatus; /** Filtro de status para recuperar a lista de descontos. Valores disponíveis: próximos/em andamento/expirados/todos. */
    page_no: number; /** Especifica o número da página de dados a ser retornada na chamada atual. Começando em 1. Se os dados ocuparem mais de uma página, o parâmetro `page_no` pode ser um ponto de partida para a próxima chamada. */
    page_size: number; /** Se houver muitos itens disponíveis para recuperação, talvez seja necessário chamar GetDiscountsList várias vezes para obter todos os dados. Cada conjunto de resultados é retornado como uma página de entradas. Use os filtros de paginação para controlar o número máximo de entradas (<= 100) a serem recuperadas por página (ou seja, por chamada) e o número de deslocamento para iniciar a próxima chamada. Esse valor inteiro é usado para especificar o número máximo de entradas a serem retornadas em uma única "página" de dados. */
    update_time_from?: number; /** Os campos `update_time_from` e `update_time_to` especificam um intervalo de datas para a recuperação de pedidos (com base no horário de atualização do desconto). O intervalo máximo de datas que pode ser especificado com os campos `update_time_from` e `update_time_to` é de 30 dias. */
    update_time_to?: number; /** Os campos `update_time_from` e `update_time_to` especificam um intervalo de datas para a recuperação de pedidos (com base no horário de atualização do desconto). O intervalo máximo de datas que pode ser especificado com os campos `update_time_from` e `update_time_to` é de 30 dias. */
}

export type DiscountListStatus =
    | "upcoming" /** AINDA NÃO INICIOU  */
    | "ongoing" /** EM ANDAMENTO */
    | "expired" /** JÁ TERMINOU */
    | "all"; /** TODOS (GERALMENTE USADO COMO FILTRO) */

type ResponseSuccessDiscountList = {
    status: DiscountListStatus;
    discount_name: string;
    start_time: number;
    discount_id: number;
    source: number;
    end_time: number;
};

type ResponseSuccess = ShopeeEnvelope<{
    discount_list: ResponseSuccessDiscountList[];
    more: boolean
}>

export async function get_discount_list(parameters: Partial<RequestParameter> = {}): Promise<ResponseSuccess> {
    let { page_no = 1, page_size = 100, discount_status = "all" } = parameters;

    if (page_size > 100) page_size = 100;
    if (page_no < 1) page_no = 1;

    const parametersReady: RequestParameter = {
        discount_status,
        page_no,
        page_size
    }
    if (parameters.update_time_from) parametersReady.update_time_from = parameters.update_time_from;
    if (parameters.update_time_to) parametersReady.update_time_to = parameters.update_time_to;

    const url = InfoSellerConfig.host + "/api/v2/discount/get_discount_list";

    const res = await shopeeGet<ResponseSuccess>(url,
        { access_token: true, shop_id: true }, parametersReady
    );

    //? Valida response
    return assertShopeeOk(res);
}