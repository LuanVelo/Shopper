# Shopper v0

Aplicação web para montar lista de compras de supermercado e comparar preços entre múltiplas fontes, exibindo:
- menor preço por item;
- preço médio por item;
- menor total da lista;
- total médio esperado da lista.

Fontes atuais:
- Prezunic (`https://www.prezunic.com.br`)
- Zona Sul (`https://www.zonasul.com.br`)
- Extra (`https://www.extramercado.com.br`)

## Objetivo do projeto
Ajudar o usuário a estimar rapidamente o custo de uma compra antes de finalizar no checkout dos mercados.

O sistema tenta refletir a lógica real dos e-commerces (ex.: itens de açougue em `kg`, quantidades por passo permitido, preço por unidade de referência).

## Stack de tecnologia
- Frontend: `Next.js 15` + `React 18` + `TypeScript`
- UI: `Tailwind CSS` + componentes base estilo `shadcn/ui`
- Backend: API routes no próprio `Next.js` (`app/api/*`)
- Scraping: `axios` + `cheerio`
- Agendamento: `node-cron` (rotina mensal)
- Tooling: `ESLint`, `TypeScript`, `PostCSS`, `Autoprefixer`

## Arquitetura (visão geral)
- Aplicação fullstack dentro de um único projeto Next.js.
- A tela principal envia os itens para `/api/calculate`.
- O motor de preços (`lib/price-engine.ts`) consulta scrapers por mercado.
- Resultados são normalizados e agregados por item (menor + média simples).
- Cache em memória evita scraping repetido imediato.
- Endpoint manual (`/api/update-prices`) força atualização do cache.
- Scheduler mensal roda no dia 5 para atualização automática.

## Estrutura de pastas

```text
app/
  api/
    calculate/route.ts            # cálculo principal da lista
    categories/route.ts           # categorias por mercado
    debug-scrape/route.ts         # auditoria de scrape por termo (salva JSON)
    update-prices/route.ts        # atualização manual dos preços em cache
    zonasul/market-data/route.ts  # coleta Zona Sul via VTEX JSON (por categoria)
  globals.css                     # estilos globais
  layout.tsx                      # layout base Next.js
  page.tsx                        # tela principal (input + resultados em tempo real)

components/
  ui/
    button.tsx                    # botão base
    card.tsx                      # card base
    input.tsx                     # input base

lib/
  categories.ts                   # categorias por fonte + CEP padrão
  normalization.ts                # sinônimos e parsing de unidade/embalagem
  price-engine.ts                 # motor de cálculo, regras de quantidade e cache
  scheduler.ts                    # cron mensal (dia 5, 03:00)
  utils.ts                        # utilitários gerais (ex.: formatação BRL)
  scrapers/
    common.ts                     # helpers comuns, fallback e parsing de preço
    prezunic.ts                   # scraper Prezunic
    zonasul.ts                    # scraper Zona Sul
    extra.ts                      # scraper Extra
    zonasul-market.ts             # integração VTEX JSON para Zona Sul

types/
  index.ts                        # tipos de domínio (item, oferta, resposta, etc.)
  node-cron.d.ts                  # declaração de tipo para node-cron
```

## Regras de negócio implementadas

### 1) Unidade de referência por item
A unidade usada no cálculo é inferida pelas ofertas coletadas.
Exemplos:
- carnes e cortes: normalmente `kg`;
- bebidas: normalmente `l`;
- itens unitários: `un`.

### 2) Quantidade com passos permitidos
A quantidade do usuário é ajustada para passos válidos encontrados nas embalagens/ofertas:
- `un`: passos inteiros (`1`, `2`, `3`...)
- peso/volume: passo fixo inferido (ex.: `0.5`, `1.0`, `1.5`)

### 3) Preço unitário e total
Para cada item:
- menor preço unitário;
- média simples de preço unitário;
- total mínimo (`menor_unit * quantidade`);
- total médio (`media_unit * quantidade`).

Para a lista:
- soma dos totais mínimos;
- soma dos totais médios.

### 4) Heurísticas de açougue
O scraper possui heurísticas para evitar distorções comuns em carnes:
- prioriza leitura de preço explícito por unidade (ex.: `R$ 18,49/kg`);
- força contexto de peso para cortes quando necessário;
- possui fallback para casos de markup incompleto.

## Endpoints disponíveis

### `POST /api/calculate`
Calcula preços da lista.

Payload:
```json
{
  "cep": "22470-220",
  "items": [
    { "name": "peito de frango", "quantity": 2 },
    { "name": "leite", "quantity": 3 }
  ]
}
```

### `GET /api/categories`
Retorna categorias mapeadas por fonte.

### `GET /api/update-prices`
Retorna status da última atualização manual.

### `POST /api/update-prices`
Força re-scraping dos itens em cache.

### `GET /api/debug-scrape?term=<item>`
Audita scraping por termo, retorna as ofertas por mercado e salva arquivo JSON em:
- `data/scrape-debug/`

Exemplo:
- `/api/debug-scrape?term=peito%20de%20frango`

### `GET /api/zonasul/market-data`
Integração recomendada para Zona Sul via API JSON da VTEX.

Uso:
- listar categorias: `/api/zonasul/market-data`
- buscar produtos por categoria:
  - `/api/zonasul/market-data?categoryId=<id>&page=1&pageSize=24`

## Fluxo de execução
1. Usuário informa CEP e itens na tela.
2. Frontend envia para `/api/calculate`.
3. `price-engine` busca (ou reaproveita cache) de cada mercado.
4. Scrapers retornam ofertas normalizadas.
5. Motor aplica regras de unidade/quantidade e calcula menor + média.
6. Frontend atualiza resultados em tempo real.

## Rodar localmente

Pré-requisitos:
- Node.js 18+ (recomendado 20+)
- npm

Comandos:
```bash
npm install
npm run dev
```

App:
- `http://localhost:3000`

Verificações:
```bash
npm run typecheck
npm run build
```

## Operação e limitações atuais
- Cache é em memória do processo (reiniciar app limpa cache).
- Scraping HTML pode quebrar se os sites alterarem markup.
- Precisão por CEP ainda depende de evolução de sessão/cookies específicos por mercado.
- O endpoint de auditoria facilita inspeção e ajuste rápido dos scrapers.

## Segurança e boas práticas
- Respeitar termos de uso dos sites alvo.
- Evitar frequência agressiva de scraping.
- Em produção, preferir worker/queue e persistência de histórico.

## Roadmap sugerido
1. Persistir histórico de preços em banco (SQLite/Postgres).
2. Separar serviço de scraping do web app (worker dedicado).
3. Criar camada de observabilidade (logs estruturados + alertas).
4. Melhorar matching semântico de produto (sinônimos por categoria e marca).
5. Expor tela de auditoria no frontend (sem depender de JSON manual).

## Scripts npm
- `npm run dev`: inicia ambiente de desenvolvimento
- `npm run build`: build de produção
- `npm run start`: sobe servidor de produção
- `npm run lint`: lint do projeto
- `npm run typecheck`: checagem de tipos TypeScript

## Guia rápido para novos devs (5 minutos)

### 1) Pré-requisitos
- Node.js 18+ (recomendado 20+)
- npm
- Git

### 2) Clonar e abrir o projeto
```bash
git clone https://github.com/LuanVelo/Shopper.git
cd Shopper
```

### 3) Instalar dependências
```bash
npm install
```

### 4) Rodar localmente
```bash
npm run dev
```

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
