# Shopper v0

Aplicação Next.js para montar lista de compras e consultar ofertas de supermercados via scraping.

## Demo online
- Produção (Vercel): https://shopper-psi-eight.vercel.app?_vercel_share=XPtsipSheYzhe1HEVvtvotPZ3TysgG0y

## Estado atual do produto
O projeto hoje tem **dois modos de interface**:

1. **UI nova (padrão)** em `/`
- Fluxo em fases (inicial -> busca ativa -> lista montada).
- Busca em tempo real por termo via `GET /api/search`.
- Sugestões com loading, ranking de relevância e estado de item (default/hover).
- Adição de item na lista.
- Controle de quantidade com `+/-` respeitando unidade (`un`, `kg`, `g`, `l`, `ml`).
- Caixa de resumo de custo separada da caixa de itens.
- Toast de desfazer quando remove item ou zera quantidade.
- Edição de CEP via interação de hover + modal de confirmação.
- Microinterações com GSAP (entrada de layout, placeholder da busca, botão edit do CEP).

2. **DEV mode (legado)** em `/?mode=dev`
- Interface antiga para operação e inspeção.
- Formulário com múltiplos itens (`nome + quantidade`).
- Cálculo completo via `POST /api/calculate`.
- Cards de status (`Dev Status`, categorias por fonte, resumo de checkout).
- Atualização manual de cache via `POST /api/update-prices`.

## Tela (frontend)
### UI nova (rota `/`)
- **Layout de coluna única centralizada** (não usa mais grid de 2 colunas).
- Cabeçalho com `Shopper` e bloco de CEP no topo.
- Campo de busca com estados:
  - inativo (placeholder visível);
  - ativo (borda destacada + animação de placeholder);
  - carregando (spinner no lugar da lupa).
- Dropdown da busca com:
  - lista de sugestões (até 5 itens);
  - estado hover do item;
  - ação `Add item`;
  - estado vazio: `Nenhum resultado encontrado`.
- Após adicionar item:
  - animação GSAP reposicionando o topo;
  - caixa 1: tabela de itens (`Nome`, `Menor preço`, `Quantidade`, `Actions`);
  - caixa 2: resumo de custo (`Menor`, `Médio`, `Maior`).
- Quantidade por item com `+/-`, obedecendo unidade do item:
  - `un`: passo 1
  - `kg/l`: passo 0.5
  - `g/ml`: passo 100
- Remoção de item com toast de desfazer no canto inferior direito.
- Edição de CEP com microinteração no hover + modal (`confirmar/cancelar`).

### DEV mode (rota `/?mode=dev`)
- Mantido para diagnóstico e operação técnica.
- Esta tela **continua** no formato antigo com cards e mais detalhes de cálculo.

## O que cada modo calcula
- **UI nova (`/`)**: monta lista com base no `minPrice` retornado pelas sugestões de busca (`/api/search`) e calcula totais no frontend.
- **DEV mode (`/?mode=dev`)**: usa o motor completo de preço (`lib/price-engine.ts`) com menor preço, média, regra de quantidade e fonte vencedora por item.

## Stack
- Next.js 15 (App Router)
- React 18 + TypeScript
- Tailwind CSS
- GSAP
- axios + cheerio (scrapers)
- node-cron (agendamento)

## Fontes de mercado
- Prezunic
- Zona Sul
- Extra
- Supermarket Delivery

## APIs (estado atual)

### Consumidas diretamente pela UI nova
- `GET /api/search?term=<texto>`
  - Busca ofertas nos 4 scrapers em paralelo.
  - Remove fallback (`isFallback`).
  - Deduplica por nome normalizado.
  - Retorna até 5 sugestões ranqueadas por relevância.

### Consumidas pelo DEV mode
- `POST /api/calculate`
  - Executa o cálculo completo por item/lista.
  - Aciona `ensureMonthlyScheduler()`.
- `GET /api/dev-status`
  - Métricas de qualidade e volume do cache.
- `POST /api/update-prices`
  - Recoleta termos já existentes no cache.
- `GET /api/update-prices`
  - Retorna data da última atualização.

### APIs auxiliares de inspeção/dados
- `GET /api/categories`
- `GET /api/debug-scrape?term=<item>`
- `GET /api/zonasul/market-data`
- `POST /api/zonasul/ingest`
- `GET /api/zonasul/offers`

## Lógica de preço e cache (motor completo)
Arquivo principal: `lib/price-engine.ts`

- Cache em memória global (`Map`) + persistência em arquivo local:
  - `data/price-cache/snapshots.json`
- Chave de cache: `source|term-normalized`
- Evita scrape duplicado simultâneo com `inflight` por chave.
- Inferência de unidade de referência por dominância nas ofertas.
- Inferência de regra de quantidade (`min`/`step`) por GCD das embalagens encontradas.
- Cálculo final por item:
  - menor preço unitário
  - preço médio unitário
  - menor total
  - total médio

## Agendamento automático
Arquivo: `lib/scheduler.ts`

- Cron mensal: `0 3 5 * *`
- Timezone: `America/Sao_Paulo`
- A rotina atualiza termos já presentes no cache.

## Variáveis de ambiente
- `SUPERMARKETDELIVERY_STORE_REFERENCE`
  - padrão: `2`
  - usado no scraper de Supermarket Delivery.

## Estrutura do projeto
```text
app/
  api/
    calculate/route.ts
    categories/route.ts
    debug-scrape/route.ts
    dev-status/route.ts
    search/route.ts
    update-prices/route.ts
    zonasul/
      ingest/route.ts
      market-data/route.ts
      offers/route.ts
  dev-mode.tsx
  globals.css
  layout.tsx
  page.tsx

components/ui/
  button.tsx
  card.tsx
  input.tsx

lib/
  categories.ts
  normalization.ts
  price-engine.ts
  scheduler.ts
  utils.ts
  market/schema.ts
  pipeline/zonasul-ingest.ts
  storage/market-store.ts
  scrapers/
    common.ts
    extra.ts
    prezunic.ts
    supermarketdelivery.ts
    zonasul.ts
    zonasul-market.ts

types/
  index.ts
  node-cron.d.ts
```

## Rodar localmente
```bash
npm install
npm run dev
```

Abrir:
- `http://localhost:3000` (UI nova)
- `http://localhost:3000/?mode=dev` (DEV mode)

Build de produção:
```bash
npm run build
npm run start
```

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`

## Limitações conhecidas
- Scrapers dependem da estrutura externa dos sites e podem quebrar com mudanças.
- Resultados de busca podem variar por disponibilidade momentânea das fontes.
- Cache persistido localmente não é versionado no Git (`data/price-cache`, `data/scrape-debug`, `data/market`).

---
Desenvolvido com OpenAI Codex.
