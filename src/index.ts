//TODO [ESCREVA SEU CÓDIGO AQUI]
//TODO [UTILIZE IMPORT PARA IMPORTAR AS FUNÇÕES PRONTAS]

//? [GET IMPORTS]
import { get_item_base_info, type GetItemBaseInfoResponseItemList } from "./API/GET/get_item_base_info.js";
import { get_item_list, type GetItemListItemStatus, type ItemListData } from "./API/GET/get_item_list.js";
import { get_model_list } from "./API/GET/get_model_list.js";
import { InfoSellerConfig } from "./config.js";

//? [COMUM IMPORTS]
import { chunk } from "./services/batch.service.js";

//? [CONFIG IMPORTS]
import { _db, _dbMarketplaces, getAccessToken, upsertShopeeItems, upsertShopeeModels } from "./services/database.service.js";
import chalk from "chalk";

//! FUNÇÕES DISPONÍVEIS:
//? [GET]
//* get_item_base_info
//* get_item_list
//* get_model_list
//* get_discount_list

//? [POST]
//* add_discount_item
//* add_discount
//* update_price
//* delete_discount_item
//* delete_discount
//* end_discount

//? CONTABILIZADOR TEMPO DE EXECUÇÃO
//* DESCOMENTE SE QUISER USAR
const start = Date.now();


async function paginacaoIds(status: GetItemListItemStatus = "NORMAL"): Promise<number[]> {
    const itensList: ItemListData = []; //? Lista de itens retornados na API
    const itensIdList: number[] = []; //? Lista de IDs dos itens retornados na API (SOMENTE IDs)
    const res = await get_item_list(0, 100, status); //? Chama API para definir valores itensList e itensIdList

    // ✅ blindagem: a Shopee às vezes devolve response/item vazio em caso de erro
    const firstItems = res?.response?.item ?? [];
    if (!Array.isArray(firstItems)) {
        console.log(chalk.red(`❌ get_item_list retornou item inválido para status=${status}`));
        console.log(res);
        return [];
    }

    itensList.push(...firstItems); //? Adiciona resposta da primeira página à lista (Economiza tempo)
    itensIdList.push(...firstItems.map(i => i.item_id)); //? Adiciona resposta da primeira página à lista de IDs (Economiza tempo)

    const requests = Math.ceil(res.response.total_count / 100) - 1; //? Calcula quantas chamadas serão necessárias para capturar todas as páginas. (Faz -1 porque a primeira página já foi buscada.)
    let remaining = requests;
    const chunkSize: number = 10; //! Tamanho da chunk
    const chunks: number[] = []; //? Chunk feita [5, 5, 4] (Para 14)

    while (remaining > 0) {
        const cur = Math.min(remaining, chunkSize);
        chunks.push(cur);
        remaining -= cur;
    }

    let pageCursor = 1;

    for (const chunk of chunks) {
        console.log(`Iniciando chunk de ${chunk} itens...`)
        const promises = Array.from({ length: chunk }, async (_, index) => {
            const pageIndex = pageCursor + index;
            const offset = pageIndex * 100
            const res = await get_item_list(offset, 100, status);
            itensList.push(...res.response.item);
            itensIdList.push(...res.response.item.map(i => i.item_id));
            console.log(`Sucesso! ${index} Feito.`);
        });

        await Promise.all(promises);
        pageCursor += chunk;
    }
    return itensIdList;
}


//? Função auto executável com encerrador de sessão do pool (Database)
async function main() {
    try {
        const status: GetItemListItemStatus[] = ["NORMAL", "UNLIST", "BANNED", "REVIEWING", "SELLER_DELETE", "SHOPEE_DELETE"];
        const promiseIdList = status.map((s) => paginacaoIds(s));
        const itensIdList: number[] = Array.from(
            new Set((await Promise.all(promiseIdList)).flat())
        ); //? Lista de IDs dos itens retornados na API (SOMENTE IDs)

        console.log(chalk.green.bold(`=========== ItensIdList ===========`));
        console.log(itensIdList.length);
        console.log(itensIdList.slice(0, 3));

        const chunkSize = 10;

        const idsChunk = chunk(itensIdList, 50);
        const batchConcurrency = chunkSize * 4; //? Aqui define o valor das chunks de busca por ID, como a paginação retorna até 100 e a busca por ID até 50, então estou fazendo vezes 2

        const anunciosDetalhados: GetItemBaseInfoResponseItemList[] = [];

        for (let i = 0; i < idsChunk.length; i += batchConcurrency) {
            const slice = idsChunk.slice(i, i + batchConcurrency);

            const result = await Promise.all(
                slice.map(ids => get_item_base_info(ids))
            );

            for (const res of result) {
                anunciosDetalhados.push(...res.response.item_list);
            }

            console.log(chalk.greenBright(`✅ Concluído bloco de batches: ${i} → ${i + slice.length - 1}`));
        }

        console.log(chalk.green.bold(`=========== AnunciosDetalhados ===========`));
        console.log(anunciosDetalhados.length);
        // console.log(anunciosDetalhados[0]);

        console.log(chalk.green.bold(`=========== Possuem Variação (MODELS) ===========`));
        console.log(anunciosDetalhados.filter(a => Boolean(a.has_model) && a.has_model !== 0).length);

        const IdHasModels = anunciosDetalhados
            .filter(a => Boolean(a.has_model) && a.has_model !== 0)
            .map(a => a.item_id);

        const batchConcurrencyHasModels = chunkSize * 8;
        const chunkHasModels = chunk(IdHasModels, batchConcurrencyHasModels);

        const anunciosComVariacoesDetalhados: any[] = [];

        for (const chunk of chunkHasModels) {
            const promises = chunk.map(async (id) => {
                const res = await get_model_list(id);

                // ✅ injeta item_id em cada model, porque o payload não traz isso
                const modelsWithItemId = res.response.model.map((m) => ({
                    ...m,
                    item_id: id
                }));

                return modelsWithItemId;
            });

            const result = await Promise.all(promises);
            // result aqui é Array<Array<model>>
            anunciosComVariacoesDetalhados.push(...result.flat());
        }

        console.log(chalk.green.bold(`=========== AnunciosComVariacoesDetalhados ===========`));
        console.log(anunciosComVariacoesDetalhados.length);

        // ✅ Salvar anúncios (items)
        await upsertShopeeItems(anunciosDetalhados, {
            schema: "shopee",
            // shopId: InfoSellerConfig.shopId, // opcional se já estiver no InfoSellerConfig
            batchSize: 1000
        });
        console.log(chalk.greenBright(`✅ Items salvos/atualizados: ${anunciosDetalhados.length}`));

        // ✅ Salvar modelos (models)
        await upsertShopeeModels(anunciosComVariacoesDetalhados, {
            schema: "shopee",
            batchSize: 1000
        });
        console.log(chalk.greenBright(`✅ Models salvos/atualizados: ${anunciosComVariacoesDetalhados.length}`));

    } finally {
        await Promise.allSettled([_db.end(), _dbMarketplaces.end()]);
    }
}

//? MAIN
try {
    await getAccessToken();
    console.log(chalk.greenBright.bold("🔑 Access token carregado do Postgres."));
    await main();

    const ms = Date.now() - start;
    if (ms / 1000 > 5) { console.log(`⏱️ Total: ${(ms / 1000).toFixed(2)}s`); }
    else { console.log(`⏱️ Total: ${(ms / 1000).toFixed(5)}s`); }
} catch (err: unknown) {
    console.error(chalk.bgRed.bold("❌ Falha ao carregar access_token:"), err);
    console.error("Config atual:", InfoSellerConfig);
    process.exit(1);
}