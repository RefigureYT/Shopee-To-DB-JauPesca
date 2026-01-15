# Shopee Partner API (TypeScript) — Helpers & Endpoints

[![wakatime](https://wakatime.com/badge/user/db4a2800-e564-4201-9406-b98e170a6764/project/dc786cbe-59d7-4f23-acbd-dc983005a061.svg)](https://wakatime.com/badge/user/db4a2800-e564-4201-9406-b98e170a6764/project/dc786cbe-59d7-4f23-acbd-dc983005a061)

Biblioteca em **TypeScript** para facilitar chamadas na **Shopee Partner API (v2)**, com:
- Assinatura (`sign`) automática
- GET/POST padronizados
- Tipagens fortes (`ShopeeEnvelope<T>`)
- Tratamento consistente de erro (HTTP e “erro de negócio” da Shopee)
- Funções prontas para operações comuns (listar anúncios, buscar base info, pegar variações, alterar preço e promoções)

---

## ✨ Objetivo do projeto

Este repositório existe para reduzir fricção no consumo da Shopee Partner API:

- Você escreve **funções pequenas** (ex.: `get_item_list`, `add_discount_item`)
- E elas internamente fazem toda a parte “chata”:
  - `timestamp`
  - montagem do `path`
  - assinatura HMAC (`sign`)
  - parâmetros obrigatórios e opcionais (access_token, shop_id)
  - serialização correta de arrays no query (`item_id_list=[...]`)
  - validação de erro (inclusive quando a Shopee retorna **HTTP 200 com `error` preenchido**)

---

## ✅ Padrão de retorno e erros

A Shopee normalmente responde com um envelope assim:

```json
{
  "error": "",
  "message": "",
  "warning": "",
  "request_id": "....",
  "response": { ... },
  "debug_message": ""
}
```

### Erros possíveis
1) **Erro HTTP / rede (Axios)**  
   Ex.: timeout, DNS, 401/403/429/500 etc.  
   → No projeto, isso vira `HttpRequestResponseError` (com `ok: false`)

2) **Erro de negócio (Shopee)**  
   Muitas vezes vem com **HTTP 200**, porém `error` e `message` preenchidos.  
   → Por isso existe `assertShopeeOk(...)` / `unwrapShopee(...)`

### Helpers recomendados
- **`assertShopeeOk(res)`**: lança erro se houver problema e retorna o envelope ok
- **`unwrapShopee(res)`**: lança erro se houver problema e retorna só `envelope.response`

---

## 📁 Estrutura do projeto

> Os nomes/paths abaixo refletem o padrão usado no repositório.

### `src/services/`
#### `requestApiShopee.service.ts`
Camada base do projeto.
- `shopeeGet<TSuccess>(...)` — GET assinado
- `shopeePost<TSuccess>(...)` — POST assinado (JSON body)
- `ShopeeEnvelope<TResponse>` — tipagem padrão do retorno
- `HttpRequestResponse<TSuccess>` / `HttpRequestResponseError` — erro de transporte
- `assertShopeeOk` e `unwrapShopee` — validações e padronização de erro

#### `sign.service.ts`
Responsável por gerar a assinatura exigida pela Shopee:
- `signPartner(...)` — cria o `sign` (HMAC-SHA256) com base em `partnerId`, `path`, `timestamp` (+ token/shop quando aplicável)

---

## 📁 Endpoints implementados

### `src/API/GET/`
#### `get_item_list.ts`
Lista anúncios (itens) de forma paginada:
- útil para obter `item_id` em massa
- suporta filtros como `item_status`
- paginação via `offset` e `next_offset`

#### `get_item_base_info.ts`
Enriquece dados de múltiplos anúncios:
- aceita `item_id_list`
- retorna nome, sku, dimensões, imagens, etc.
- indica `has_model` (se possui variações)

#### `get_model_list.ts`
Obtém variações de um anúncio específico:
- recebe um único `item_id`
- retorna:
  - `tier_variation` (atributos como cor/tamanho e imagens)
  - `model[]` com `model_id`, estoque e preços

---

### `src/API/POST/`
#### `update_price.ts`
Atualiza o **preço base (original_price)** de um anúncio:
- suporta várias variações do mesmo anúncio via `price_list`
- uso típico: mudar “preço normal” (não promoção)

#### `add_discount.ts`
Cria uma campanha de desconto (promoção):
- recebe `discount_name`, `start_time`, `end_time`
- geralmente retorna `discount_id`

#### `add_discount_item.ts`
Aplica preço promocional em anúncios/variações dentro de uma campanha:
- recebe `discount_id` e `item_list`
- retorna listas:
  - `success_item_list`
  - `failed_item_list` (sucesso parcial é possível)

---

## 🔁 Fluxo recomendado (pipeline)

Um fluxo comum para sincronizar/analisar anúncios:

1) `get_item_list()` → obter `item_id`
2) `get_item_base_info(item_id_list)` → obter detalhes e checar `has_model`
3) Se `has_model === true`, então `get_model_list(item_id)` → obter `model_id`
4) Para alterar preço:
   - `update_price(item_id, price_list)` (preço normal)
5) Para promoções:
   - `add_discount(...)` → cria campanha e pega `discount_id`
   - `add_discount_item(discount_id, item_list)` → aplica preço promocional por variação

---

## ⚙️ Configuração (env / config)

Este projeto depende de uma configuração com:
- `host` (ex.: `https://partner.shopeemobile.com`)
- `partnerId`
- `partnerKey`
- `accessToken`
- `shopId`

> O arquivo `src/config.ts` (ou equivalente) deve expor algo como `InfoSellerConfig`.

**Dica:** nunca commitar tokens e keys no repositório.

---

## 🧪 Dicas de desenvolvimento

- **Arrays no query string**: a Shopee frequentemente espera array como JSON (`[1,2,3]`), por isso serializamos com `JSON.stringify(...)`.
- **Booleans retornados como `0 | 1`**: alguns endpoints retornam flags assim. Tipamos como `boolean | 0 | 1` quando necessário.
- **Sucesso parcial**: endpoints que recebem listas podem retornar `success_item_list` e `failed_item_list` ao mesmo tempo.

---

## 🛡️ Boas práticas adotadas

- Tipagens genéricas (`ShopeeEnvelope<T>`)
- Separação clara de:
  - Request base (services)
  - Endpoints (API/GET e API/POST)
- Erros padronizados:
  - transporte vs. negócio
- Código preparado para crescer (novos endpoints plugam fácil)

---

## 🚀 Próximos passos (ideias)

- Retry automático para 429 (rate limit) com backoff
- Paginação helpers (iterador async para `get_item_list`)
- Normalizador de boolean (`0|1` -> `true|false`) opcional
- Logger estruturado com `request_id` para auditoria

---

## 📄 Licença
Defina a licença desejada (MIT, Apache-2.0, etc).

---

## 👤 Autor
Kelvin Kauan Melo Mattos