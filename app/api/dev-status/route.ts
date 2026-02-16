import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { PriceSnapshot } from "@/types";

type CategoryName =
  | "Hortifruti"
  | "Açougue e Peixaria"
  | "Laticínios e Frios"
  | "Padaria"
  | "Bebidas"
  | "Congelados"
  | "Limpeza"
  | "Higiene e Beleza"
  | "Bebê e Infantil"
  | "Pet Shop"
  | "Utilidades Domésticas"
  | "Mercearia";

interface CacheFile {
  version: number;
  updatedAt: string | null;
  snapshots: PriceSnapshot[];
}

const CACHE_FILE = path.join(process.cwd(), "data", "price-cache", "snapshots.json");

const CATEGORY_PATTERNS: Array<{ category: CategoryName; pattern: RegExp }> = [
  {
    category: "Hortifruti",
    pattern:
      /\b(limao|limão|banana|maca|maçã|pera|uva|laranja|abacate|melancia|morango|tomate|cebola|batata|alface|couve|cenoura|pepino|fruta|verdura|legume|hortifruti)\b/
  },
  {
    category: "Açougue e Peixaria",
    pattern:
      /\b(carne|bife|picanha|alcatra|fraldinha|patinho|acem|acém|cupim|costela|contra[- ]?file|contra[- ]?filé|file|filé|frango|coxa|sobrecoxa|peixe|salm[aã]o|tilapia|tilápia|linguica|linguiça|porco|suino|suíno)\b/
  },
  {
    category: "Laticínios e Frios",
    pattern: /\b(leite|queijo|iogurte|manteiga|requeij[aã]o|creme de leite|presunto|mussarela|mu[cç]arela)\b/
  },
  {
    category: "Padaria",
    pattern: /\b(pao|pão|baguete|broa|torrada|bolo|biscoito|cookie|cookies|croissant)\b/
  },
  {
    category: "Bebidas",
    pattern: /\b(suco|refrigerante|agua|água|cerveja|vinho|cha|chá|cafe|café|energ[eé]tico|kombucha)\b/
  },
  {
    category: "Congelados",
    pattern: /\b(congelado|pizza|nuggets|lasanha|sorvete|polpa)\b/
  },
  {
    category: "Limpeza",
    pattern: /\b(detergente|desinfetante|sabao|sabão|amaciante|agua sanitaria|água sanitária|multiuso|limpeza)\b/
  },
  {
    category: "Higiene e Beleza",
    pattern: /\b(shampoo|condicionador|sabonete|desodorante|hidratante|creme dental|escova dental|higiene)\b/
  },
  {
    category: "Bebê e Infantil",
    pattern: /\b(bebe|bebê|infantil|fralda|len[cç]o umedecido|papinha)\b/
  },
  {
    category: "Pet Shop",
    pattern: /\b(racao|ração|pet|cachorro|gato)\b/
  },
  {
    category: "Utilidades Domésticas",
    pattern: /\b(utensilio|utensílio|talher|pano|esponja|descart[aá]vel|papel aluminio|papel alumínio)\b/
  }
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function classifyCategory(productTitle: string): CategoryName {
  const text = normalizeText(productTitle);
  for (const entry of CATEGORY_PATTERNS) {
    if (entry.pattern.test(text)) return entry.category;
  }
  return "Mercearia";
}

export async function GET() {
  try {
    let cache: CacheFile = {
      version: 1,
      updatedAt: null,
      snapshots: []
    };

    try {
      const raw = await fs.readFile(CACHE_FILE, "utf-8");
      cache = JSON.parse(raw) as CacheFile;
    } catch {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        itemsCount: 0,
        itemsByCategory: [],
        priceErrorPercent: 0,
        totals: {
          termsCount: 0,
          snapshotsCount: 0,
          offersCount: 0
        }
      });
    }

    const categoryMap = new Map<CategoryName, number>();
    let offersCount = 0;
    let erroredProducts = 0;

    for (const snapshot of cache.snapshots) {
      if (!snapshot.offers.length) {
        erroredProducts += 1;
      }

      for (const offer of snapshot.offers) {
        offersCount += 1;
        const hasPriceError = !Number.isFinite(offer.packagePrice) || offer.packagePrice <= 0;
        if (hasPriceError) {
          erroredProducts += 1;
          continue;
        }

        const category = classifyCategory(offer.productTitle);
        categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1);
      }
    }

    const itemsByCategory = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const totalProductsEvaluated = offersCount + cache.snapshots.filter((snapshot) => snapshot.offers.length === 0).length;
    const priceErrorPercent =
      totalProductsEvaluated > 0 ? Number(((erroredProducts / totalProductsEvaluated) * 100).toFixed(2)) : 0;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      itemsCount: offersCount,
      itemsByCategory,
      priceErrorPercent,
      totals: {
        termsCount: new Set(cache.snapshots.map((snapshot) => snapshot.term)).size,
        snapshotsCount: cache.snapshots.length,
        offersCount
      },
      cacheUpdatedAt: cache.updatedAt
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao montar status de desenvolvimento",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}
