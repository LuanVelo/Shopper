# Shopper v0

MVP web para lista de compras com comparação entre 3 fontes:
- Prezunic (`https://www.prezunic.com.br`)
- Zona Sul (`https://www.zonasul.com.br`)
- Extra (`https://www.extramercado.com.br`)

## O que já está implementado
- Entrada de CEP (pré-preenchido `22470-220`).
- Lista de itens com quantidade. A unidade é definida automaticamente pelo padrão das ofertas (ex.: carnes em `kg`).
- Cálculo em tempo real de:
  - menor preço por unidade de referência do mercado,
  - média simples por unidade de referência,
  - menor total da lista,
  - total médio esperado.
- Regra de quantidade por item baseada nas embalagens encontradas:
  - itens por unidade em passos inteiros (`1`, `2`, `3`...),
  - itens por peso/volume em passos fixos (ex.: `500g`, `1000g`, `1500g`).
- Scraper por fonte com fallback seguro quando o HTML muda/bloqueia.
- Normalização de sinônimos e conversão de unidade.
- Rotina automática mensal no dia 5 às 03:00 (America/Sao_Paulo).
- Botão de atualização manual de preços com estimativa/tempo.
- UI base em estilo `shadcn` para evoluir em design system.

## Estrutura
- `app/page.tsx`: tela única (input + resultados em tempo real).
- `app/api/calculate/route.ts`: cálculo da lista.
- `app/api/update-prices/route.ts`: atualização manual e status.
- `app/api/categories/route.ts`: categorias por fonte.
- `lib/scrapers/*`: coleta por supermercado.
- `lib/normalization.ts`: sinônimos e unidades.
- `lib/price-engine.ts`: agregação, cache e cálculo.
- `lib/scheduler.ts`: cron mensal.

## Rodar localmente
```bash
npm install
npm run dev
```

Aplicação: `http://localhost:3000`

## Próximos passos recomendados
1. Trocar fallback por parser dedicado por fonte (seletores resilientes + logs).
2. Persistir cache e histórico em banco (SQLite/Postgres).
3. Criar job worker separado para scraping em produção.
4. Incluir precisão regional por CEP via sessão/cookies de cada e-commerce.

## Auditoria de preços (validação)
Use o endpoint abaixo para inspecionar o que cada mercado retornou para um termo e salvar o resultado em arquivo:

- `GET /api/debug-scrape?term=peito%20de%20frango`

Isso gera um JSON em `data/scrape-debug/` com os preços normalizados por fonte, para facilitar validação e ajuste de scraper.

## Zona Sul por categoria (formato recomendado)
Para coletar dados com maior estabilidade, use a API JSON da VTEX por categoria.

- Listar categorias:
  - `GET /api/zonasul/market-data`
  - opcional: `?level=3` (profundidade da árvore)
- Buscar produtos de uma categoria:
  - `GET /api/zonasul/market-data?categoryId=<id>&page=1&pageSize=24`

Campos retornados por produto:
- `itemName`
- `priceFrom` (preço de, quando houver desconto)
- `priceBy` (preço por)
- `pricePerUnit`
- `unit` (kg, l, un, etc.)
- `categoryPath`
- `productUrl`
