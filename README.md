# Shopper v0

Aplicação web para montar lista de compras de supermercado com comparação entre:
- Prezunic
- Zona Sul
- Extra

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

## Fluxo de dados (atual)
1. Usuário informa CEP e itens.
2. Para cada item e cada mercado:
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

## Regras de negócio (atuais)

### Unidade e quantidade
- Unidade de referência inferida pelas ofertas (`un`, `kg`, `g`, `l`, `ml`).
- Quantidade segue passo permitido inferido do conjunto de ofertas.

### Regra de compra por pacote
- Se **não** existe preço explícito por medida no card (`R$/kg`, `R$/g`, `R$/L`, `R$/ml`), o item é tratado como `un`.
- Exemplo: `Pão de Forma ... 450g` vira `R$/un` (pacote), não `R$/g`.

### Regra de açougue
- Itens de açougue são tratados com heurísticas específicas para evitar distorções.
- Match textual usa palavra completa (evita falso positivo por substring, ex.: `ancho` dentro de `kalanchoe`).
- Se o termo é de açougue, aplica filtro de categoria para manter resultados de carne/peixaria.

### Filtros semânticos
- Termos ambíguos possuem filtros de relevância dedicados (ex.: `leite`).

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
- Entrada de itens linha a linha (`nome + quantidade`).
- Resultado atualizado em tempo real.
- Link `Ver oferta` no item com menor preço quando disponível.
- Card `Dev Status` após `Categorias por fonte`.

## Execução local
```bash
npm install
npm run dev
```

Verificações:
```bash
npm run typecheck
npm run build
```

## Observações
- Scraping depende da estrutura dos sites e pode exigir manutenção frequente.
- Cache local fica em `data/price-cache/` e não é versionado no Git.

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`

---
Esse projeto foi desenvolvido com OpenAI Codex.

Abrir no navegador:
- `http://localhost:3000`

### 5) Validar antes de subir código
```bash
npm run typecheck
npm run build
```

### 6) Fluxo de trabalho recomendado
- Criar branch de feature:
```bash
git checkout -b feature/minha-alteracao
```
- Commits pequenos e objetivos.
- Abrir PR para `main` com descrição do que mudou e como validar.

### 7) Checklist de PR
- A tela principal (`/`) continua calculando em tempo real.
- Endpoints `app/api/*` funcionando.
- Regras de unidade/quantidade não regrediram.
- Sem arquivos de build no commit (`.next`, logs, artefatos temporários).

## Aviso
Este projeto foi desenvolvido com OpenAI Codex.
