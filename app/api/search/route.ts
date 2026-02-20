import { NextRequest, NextResponse } from "next/server";
import { normalizeItemName } from "@/lib/normalization";
import { scrapeExtra } from "@/lib/scrapers/extra";
import { scrapePrezunic } from "@/lib/scrapers/prezunic";
import { scrapeSupermarketDelivery } from "@/lib/scrapers/supermarketdelivery";
import { scrapeZonaSul } from "@/lib/scrapers/zonasul";
import { Offer, Unit } from "@/types";

export const dynamic = "force-dynamic";

type SearchSuggestion = {
  id: string;
  name: string;
  unit: Unit;
  minPrice: number;
};

type SuggestionAccumulator = {
  id: string;
  name: string;
  unit: Unit;
  minPrice: number;
};

function relevanceScore(query: string, value: string): number {
  if (value === query) return 0;
  if (value.startsWith(query)) return 1;
  if (value.split(" ").some((word) => word.startsWith(query))) return 2;
  if (value.includes(query)) return 3;
  return Number.POSITIVE_INFINITY;
}

function toSuggestions(term: string, offers: Offer[]): SearchSuggestion[] {
  const normalizedQuery = term.toLowerCase();
  const bestByKey = new Map<string, SuggestionAccumulator>();

  for (const offer of offers) {
    const name = (offer.productTitle || offer.itemName || "").trim();
    if (!name) continue;

    const normalizedName = name.toLowerCase();
    const score = relevanceScore(normalizedQuery, normalizedName);
    if (!Number.isFinite(score)) continue;

    const key = normalizeItemName(name);
    const current = bestByKey.get(key);

    if (!current || offer.packagePrice < current.minPrice) {
      bestByKey.set(key, {
        id: key,
        name,
        unit: offer.packageUnit,
        minPrice: offer.packagePrice
      });
    }
  }

  return Array.from(bestByKey.values())
    .sort((a, b) => {
      const aScore = relevanceScore(normalizedQuery, a.name.toLowerCase());
      const bScore = relevanceScore(normalizedQuery, b.name.toLowerCase());
      if (aScore !== bScore) return aScore - bScore;
      if (a.minPrice !== b.minPrice) return a.minPrice - b.minPrice;
      if (a.name.length !== b.name.length) return a.name.length - b.name.length;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 5);
}

export async function GET(request: NextRequest) {
  const termRaw = request.nextUrl.searchParams.get("term")?.trim() ?? "";
  if (!termRaw) {
    return NextResponse.json({ error: "Informe o parâmetro term" }, { status: 400 });
  }

  const normalizedTerm = normalizeItemName(termRaw);

  try {
    const [prezunic, zonasul, extra, supermarketdelivery] = await Promise.all([
      scrapePrezunic(normalizedTerm),
      scrapeZonaSul(normalizedTerm),
      scrapeExtra(normalizedTerm),
      scrapeSupermarketDelivery(normalizedTerm)
    ]);

    const offers = [...prezunic, ...zonasul, ...extra, ...supermarketdelivery].filter((offer) => !offer.isFallback);
    const suggestions = toSuggestions(normalizedTerm, offers);

    return NextResponse.json({
      term: termRaw,
      normalizedTerm,
      suggestions,
      offersCount: offers.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao buscar itens nos scrapers",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}
