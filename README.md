# Shopee → Postgres Sync (Bun + TypeScript) — Itens + Models (Partner API v2)

Este projeto faz **sincronização completa de anúncios da Shopee** (itens e variações/models) para um **Postgres**, usando a **Shopee Partner API v2**.

Ele foi pensado para rodar rápido, com paginação, concorrência controlada e **upsert em lote** no banco.

---

## ✅ O que ele faz (na prática)

1. **Lê o `access_token` do Postgres** (tabela de tokens)
2. Busca **todos os `item_id`** por status (NORMAL, UNLIST, etc.) via `get_item_list`
3. Carrega os detalhes em lote via `get_item_base_info` (IDs em batches)
4. Para itens com variação (`has_model`), busca `get_model_list`
5. Faz **UPSERT** em duas tabelas:
   - `shopee.items` (itens/anúncios)
   - `shopee.models` (variações/modelos)

**Saída:** você tem o catálogo inteiro normalizado no banco, com o JSON completo em `raw` para auditoria.

---

## 🧠 Stack do projeto

- **Bun** (runtime + package manager)
- **TypeScript**
- **Axios** (HTTP)
- **Postgres** (`pg`)
- **dotenv** (variáveis de ambiente)

O arquivo que você mandou (`index.js`) é o **bundle final gerado pelo Bun** (por isso ele parece gigante, com dependências embutidas).

---

## 🚀 Por que usar Bun aqui?

Este projeto é perfeito para Bun porque:
- executa **TypeScript rápido**
- tem um runtime bem leve para pipelines de sincronização
- compila/bundla em **um único arquivo** (`bun build`)
- start rápido e consumo de CPU/memória muito bom em scripts de integração

Site oficial: https://bun.sh

---

## 📦 Instalação

### 1) Instale o Bun
Linux/macOS:
```bash
curl -fsSL https://bun.sh/install | bash
```

Windows:
- instale via `powershell` (ou use WSL)
- veja o guia oficial do Bun

### 2) Instale as dependências
Na pasta do projeto:
```bash
bun install
```

---

## ⚙️ Configuração (.env)

Crie um arquivo `.env` na raiz seguindo este padrão (é exatamente o que o projeto valida ao iniciar):

```env
SHOP_ID="954428278"
PARTNER_KEY="SUA_PARTNER_KEY"
PARTNER_ID="2010511"

HOST="https://partner.shopeemobile.com"
# ou:
# HOST="https://partner.test-stable.shopeemobile.com"

DATABASE_URL="postgres://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO"
DB_SCHEMA="public"
DB_TABLE="tokens_api"

MARKETPLACES_DATABASE_URL="postgres://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO_MARKETPLACES"
```

### O que cada variável significa?

- `SHOP_ID` → shop_id da sua loja Shopee
- `PARTNER_ID` / `PARTNER_KEY` → credenciais do Partner API
- `HOST` → URL base da Shopee Partner API
- `DATABASE_URL` → Postgres onde fica a tabela de tokens
- `DB_SCHEMA` + `DB_TABLE` → **onde o projeto vai buscar o access_token**
- `MARKETPLACES_DATABASE_URL` → Postgres onde serão gravados `shopee.items` e `shopee.models`

> ✅ Importante: este projeto **não usa `ACCESS_TOKEN` no .env**.  
> Ele **busca o token no Postgres**.

---

## 🔑 Como o access_token é carregado (obrigatório)

O projeto roda um SELECT assim:

```sql
SELECT access_token
FROM <DB_SCHEMA>.<DB_TABLE>
WHERE provider = 'shopee'
LIMIT 1;
```

Então sua tabela de tokens precisa ter no mínimo:

```sql
CREATE TABLE IF NOT EXISTS public.tokens_api (
  id bigserial PRIMARY KEY,
  provider text NOT NULL UNIQUE,
  access_token text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
```

E um registro:

```sql
INSERT INTO public.tokens_api (provider, access_token)
VALUES ('shopee', 'SEU_ACCESS_TOKEN')
ON CONFLICT (provider)
DO UPDATE SET access_token = EXCLUDED.access_token, updated_at = now();
```

---

## 🗃️ Estrutura do banco (tabelas de destino)

O projeto grava em `schema = shopee` (default no código).

### ✅ Tabela: `shopee.items`

Campos gravados:
- `shop_id`, `item_id`
- status, nome, sku, gtin
- flags: `has_model`, `has_promotion`
- `promotion_id`
- `create_time`, `update_time`
- `raw` (jsonb)
- `last_synced_at`

Sugestão de DDL:

```sql
CREATE SCHEMA IF NOT EXISTS shopee;

CREATE TABLE IF NOT EXISTS shopee.items (
  shop_id bigint NOT NULL,
  item_id bigint NOT NULL,

  item_status text,
  item_name text,
  item_sku text,
  gtin_code text,

  has_model boolean,
  has_promotion boolean,
  promotion_id bigint,

  create_time timestamptz,
  update_time timestamptz,

  raw jsonb NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (shop_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_shopee_items_item_status
  ON shopee.items (item_status);

CREATE INDEX IF NOT EXISTS idx_shopee_items_has_model
  ON shopee.items (has_model);
```

---

### ✅ Tabela: `shopee.models`

Campos gravados:
- `shop_id`, `model_id`, `item_id`
- status, sku, gtin
- promo
- preços: current/original/local/local_promotion
- estoque: available/reserved
- `raw` + `last_synced_at`

Sugestão de DDL:

```sql
CREATE TABLE IF NOT EXISTS shopee.models (
  shop_id bigint NOT NULL,
  model_id bigint NOT NULL,
  item_id bigint NOT NULL,

  model_status text,
  model_sku text,
  gtin_code text,

  has_promotion boolean,
  promotion_id bigint,

  current_price numeric,
  original_price numeric,
  local_price numeric,
  local_promotion_price numeric,

  total_available_stock int,
  total_reserved_stock int,

  raw jsonb NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (shop_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_shopee_models_item_id
  ON shopee.models (item_id);
```

> 💡 O projeto faz UPSERT por `(shop_id, item_id)` em `items` e `(shop_id, model_id)` em `models`.

---

## ▶️ Como rodar

### Rodar em modo script (mais comum)
Se você tem os arquivos TS do projeto:
```bash
bun run src/index.ts
```

### Rodar o bundle final (como o seu `index.js`)
Se você já buildou e tem `index.js`:
```bash
bun run index.js
```

---

## 🔁 Fluxo detalhado de sincronização (o que acontece internamente)

### 1) Paginação de IDs por status (`get_item_list`)
O projeto varre vários status:

- `NORMAL`
- `UNLIST`
- `BANNED`
- `REVIEWING`
- `SELLER_DELETE`
- `SHOPEE_DELETE`

Ele chama:
- primeira página: `offset=0` e `page_size=100`
- depois calcula quantas páginas faltam com base em `total_count`
- busca as páginas restantes com concorrência em **chunks de 10** requests por vez

✅ Resultado: uma lista grande de `item_id`, com `Set()` para remover duplicados.

---

### 2) Detalhes dos itens (`get_item_base_info`)
O código divide os IDs em lotes de **50 IDs** e faz várias chamadas ao endpoint:

`/api/v2/product/get_item_base_info`

Ele aumenta a concorrência por “bloco”, usando:

- `chunkSize = 10`
- `batchConcurrency = chunkSize * 4` (40 batches concorrentes por bloco)

✅ Resultado: `anunciosDetalhados` (lista completa com `item_list`)

---

### 3) Variações/Models (`get_model_list`)
Para cada item com `has_model`, o projeto chama:

`/api/v2/product/get_model_list`

E injeta manualmente o `item_id` dentro de cada model retornado (isso é essencial para salvar no banco).

A concorrência aqui é ainda maior:

- `batchConcurrencyHasModels = chunkSize * 8` (80 requests concorrentes por bloco)

✅ Resultado: `anunciosComVariacoesDetalhados`

---

### 4) UPSERT em lote no Postgres
Depois ele grava tudo com UNNEST (bulk insert) + `ON CONFLICT DO UPDATE`.

- `upsertShopeeItems(items, batchSize=1000)`
- `upsertShopeeModels(models, batchSize=1000)`

Isso é muito mais rápido do que inserir linha por linha.

---

## 🧾 Endpoints implementados

Todos usam a mesma base: **`shopeeGet`** (request assinado).

### GET

#### `get_item_list(offset=0, pageSize=50, itemStatus="NORMAL")`
Endpoint:
- `/api/v2/product/get_item_list`

Uso:
- coletar os `item_id` de forma paginada

---

#### `get_item_base_info(item_id_list)`
Endpoint:
- `/api/v2/product/get_item_base_info`

Uso:
- trazer detalhes de múltiplos itens de uma vez (nome, sku, flags, etc.)

---

#### `get_model_list(item_id)`
Endpoint:
- `/api/v2/product/get_model_list`

Uso:
- trazer variações (models) de um item específico

---

## 🔐 Como a assinatura `sign` funciona

O projeto monta o `sign` com HMAC-SHA256 usando este base string:

```
partnerId + path + timestamp + (accessToken?) + (shopId?)
```

E gera:
- `sign`
- `timestamp`
- injeta no query string junto com `partner_id`

Isso é feito automaticamente no `shopeeGet`.

---

## 🧯 Tratamento de erros e robustez (bem importante)

### ✅ Refresh automático em 401/403
Se der 401 ou 403:
- ele tenta recarregar o access_token do Postgres
- evita “corrida” usando um lock (`refreshTokenInFlight`)
- limita em `MAX_AUTH_REFRESH_TRIES = 3`

---

### ✅ Retry inteligente em 429 (rate limit)
Se vier 429:
- ele lê o header `Retry-After` quando existe
- senão usa espera linear (1s, 2s, 3s…)
- tem limite total de espera: **600s**

Isso evita travar o processo eternamente.

---

### ✅ Pool do Postgres com shutdown seguro
Existem 2 pools:
- `_db` → banco do token (DATABASE_URL)
- `_dbMarketplaces` → banco destino (MARKETPLACES_DATABASE_URL)

Se receber `SIGINT` / `SIGTERM`, o projeto fecha os pools certinho.

---

## 🔧 Como modificar o projeto (de verdade)

### 1) Mudar schema/tabelas de destino
Procure onde chama:
```ts
upsertShopeeItems(anunciosDetalhados, { schema: "shopee" })
upsertShopeeModels(anunciosComVariacoesDetalhados, { schema: "shopee" })
```

Troque para:
```ts
{ schema: "minha_schema" }
```

---

### 2) Controlar performance (evitar 429)
Os pontos mais importantes:

- **Paginação**: `chunkSize = 10`  
- **Base info**: `batchConcurrency = chunkSize * 4`
- **Models**: `batchConcurrencyHasModels = chunkSize * 8`

Se você estiver tomando muito 429, reduza:
- `chunkSize` (ex.: 10 → 5)
- `page_size` (100 → 50)
- quantidade de batches concorrentes

---

### 3) Adicionar novos endpoints
O padrão é simples:

1. Criar uma função
2. Montar a URL: `InfoSellerConfig.host + "/api/v2/..."`
3. Chamar `shopeeGet(...)` com os params necessários:
   - `{ access_token: true, shop_id: true }`
4. Retornar `assertShopeeOk(res)`

Exemplo:
```ts
async function meu_endpoint() {
  const url = InfoSellerConfig.host + "/api/v2/...";
  const res = await shopeeGet(url, { access_token: true, shop_id: true }, { ...args });
  return assertShopeeOk(res);
}
```

---

## 🏗️ Build (gerar o `index.js` bundle final)

Se você quiser gerar um bundle:

```bash
bun build src/index.ts --outfile index.js
```

E rodar:
```bash
bun run index.js
```

---

## ✅ Checklist de produção

- [ ] `.env` completo
- [ ] token no Postgres com `provider='shopee'`
- [ ] schema `shopee` criado
- [ ] tabelas `items` e `models` criadas
- [ ] índices criados (recomendado)
- [ ] chunk/concurrency ajustado se houver 429

---

## 👤 Autor

**Kelvin Kauan Melo Mattos**  
(Jaú Pesca / Automação / Integrações)

---

## 📄 Licença

Escolha uma licença:
- MIT