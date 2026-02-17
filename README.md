# Shopper v0

Aplicação web para montar lista de compras de supermercado com comparação entre:
- Prezunic
- Zona Sul
- Extra
- Supermarket Delivery

O sistema calcula:
- menor preço por item;
- média simples por item;
- menor total da lista;
- total médio esperado.

## Stack
- `Next.js 15`, `React 18`, `TypeScript`
- `Tailwind CSS` + base de componentes estilo `shadcn/ui`
- Scraping com `axios` + `cheerio`
- Agendamento com `node-cron`

## Arquitetura atual
- Frontend em `app/page.tsx`.
- Cálculo em `POST /api/calculate` via `lib/price-engine.ts`.
- Scrapers por fonte em `lib/scrapers/*`.
- Cache persistente de consultas em arquivo local:
  - `data/price-cache/snapshots.json`
- Atualização manual em `POST /api/update-prices`.
- Rotina automática mensal no dia 5 às 03:00 (`America/Sao_Paulo`) via `lib/scheduler.ts`.

## Fluxo de dados
1. Usuário informa CEP e itens.
2. Para cada item e mercado:
   - se já existe no cache interno, usa cache;
   - se não existe, faz scrape e salva no cache.
3. Calcula menor preço e média.
4. Atualização mensal/manual reprocessa apenas os termos já catalogados no cache.

## Estrutura de pastas
```text
app/
  api/
    calculate/route.ts
    categories/route.ts
    debug-scrape/route.ts
    dev-status/route.ts
    update-prices/route.ts
    zonasul/
      market-data/route.ts
      ingest/route.ts
      offers/route.ts
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
  scrapers/
    common.ts
    prezunic.ts
    zonasul.ts
    extra.ts
    supermarketdelivery.ts
    zonasul-market.ts
  market/
    schema.ts
  pipeline/
    zonasul-ingest.ts
  storage/
    market-store.ts

types/
  index.ts
  node-cron.d.ts

data/
  price-cache/
  scrape-debug/
  market/
```

## Regras de negócio

### Unidade e quantidade
- Unidade de referência inferida pelas ofertas (`un`, `kg`, `g`, `l`, `ml`).
- Quantidade segue passo permitido inferido do conjunto de ofertas.

### Regra de compra por pacote
- Se **não** existe preço explícito por medida no card (`R$/kg`, `R$/g`, `R$/L`, `R$/ml`), o item é tratado como `un`.
- Exemplo: `Pão de Forma ... 450g` vira `R$/un` (pacote), não `R$/g`.

### Regra de açougue
- Itens de açougue usam heurísticas para evitar distorções.
- Match textual usa palavra completa (evita falso positivo de substring, ex.: `ancho` dentro de `kalanchoe`).
- Se o termo é de açougue, aplica filtro de categoria para manter resultados de carne/peixaria.

### Filtros semânticos
- Termos ambíguos possuem filtros de relevância dedicados (ex.: `leite`).

## Supermarket Delivery
- Integração via GraphQL (`nextgentheadless.instaleap.io/api/v3`).
- Usa `searchProducts` com `clientId` e `storeReference`.
- `storeReference` padrão: `2`.
- Pode ser configurado por ambiente:
  - `SUPERMARKETDELIVERY_STORE_REFERENCE=2`

## Endpoints principais

### `POST /api/calculate`
Calcula preços da lista.

Exemplo:
```json
{
  "cep": "22470-220",
  "items": [
    { "name": "leite", "quantity": 2 },
    { "name": "ancho", "quantity": 1 }
  ]
}
```

### `POST /api/update-prices`
Atualiza os termos já existentes no cache interno.

### `GET /api/update-prices`
Retorna data da última atualização.

### `GET /api/debug-scrape?term=<item>`
Retorna ofertas por mercado e salva auditoria em `data/scrape-debug/`.

### `GET /api/dev-status`
Métricas para card de desenvolvimento:
- número de itens no cache;
- itens por categoria (heurística);
- `%` de produtos com erro de preço.

## Tela (frontend)
- Layout em duas colunas.
- Coluna esquerda: entrada de itens, resultado em tempo real, `Categorias por fonte` e `Dev Status`.
- Coluna direita: `Resumo do checkout` com apenas nome do item e menor valor encontrado.
- Entrada de itens linha a linha (`nome + quantidade`).
- Resultado atualizado em tempo real.
- Link `Ver oferta` no item com menor preço quando disponível.
- Blocos auxiliares: `Categorias por fonte` e `Dev Status`.

## Execução local
```bash
npm install
npm run dev
```

Abrir no navegador:
- `http://localhost:3000`

Verificações:
```bash
npm run typecheck
npm run build
```

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`

## Observações
- Scraping depende da estrutura dos sites e pode exigir manutenção frequente.
- Cache local fica em `data/price-cache/` e não é versionado no Git.

---
Esse projeto foi desenvolvido com OpenAI Codex.
