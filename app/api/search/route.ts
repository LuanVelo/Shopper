import { NextRequest, NextResponse } from "next/server";
import { normalizeItemName } from "@/lib/normalization";
import { scrapeExtra } from "@/lib/scrapers/extra";
import { scrapePrezunic } from "@/lib/scrapers/prezunic";
import { scrapeSupermarketDelivery } from "@/lib/scrapers/supermarketdelivery";
import { scrapeZonaSul } from "@/lib/scrapers/zonasul";
import { Offer, SourceName, Unit } from "@/types";

export const dynamic = "force-dynamic";

type SearchSuggestion = {
  id: string;
  name: string;
  unit: Unit;
  minPrice: number;
  source: SourceName;
  productUrl: string | null;
};

type SuggestionAccumulator = {
  id: string;
  name: string;
  unit: Unit;
  minPrice: number;
  source: SourceName;
  productUrl: string | null;
};

type SourceResult = {
  source: SourceName;
  offers: Offer[];
  ok: boolean;
  error?: string;
};

function relevanceScore(query: string, value: string): number {
  if (value === query) return 0;
  if (value.startsWith(query)) return 1;
  if (value.split(" ").some((word) => word.startsWith(query))) return 2;
  if (value.includes(query)) return 3;
  return Number.POSITIVE_INFINITY;
}

async function scrapeBySource(source: SourceName, term: string): Promise<SourceResult> {
  try {
    if (source === "prezunic") {
      return { source, offers: await scrapePrezunic(term), ok: true };
    }
    if (source === "zonasul") {
      return { source, offers: await scrapeZonaSul(term), ok: true };
    }
    if (source === "extra") {
      return { source, offers: await scrapeExtra(term), ok: true };
    }
    return { source, offers: await scrapeSupermarketDelivery(term), ok: true };
  } catch (error) {
    return {
      source,
      offers: [],
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido"
    };
  }
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
        minPrice: offer.packagePrice,
        source: offer.source,
        productUrl: offer.productUrl ?? null
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
    const sources: SourceName[] = ["prezunic", "zonasul", "extra", "supermarketdelivery"];
    const sourceResults = await Promise.all(
      sources.map((source) => scrapeBySource(source, normalizedTerm))
    );

    const offers = sourceResults
      .flatMap((result) => result.offers)
      .filter((offer) => !offer.isFallback);
    const offersBySource = sourceResults.reduce<Record<SourceName, number>>(
      (acc, result) => {
        acc[result.source] = result.offers.filter((offer) => !offer.isFallback).length;
        return acc;
      },
      { prezunic: 0, zonasul: 0, extra: 0, supermarketdelivery: 0 }
    );
    const suggestions = toSuggestions(normalizedTerm, offers);

    return NextResponse.json({
      term: termRaw,
      normalizedTerm,
      suggestions,
      offersCount: offers.length,
      checkedMarkets: sources.length,
      checkedSources: sourceResults.map((result) => ({
        source: result.source,
        ok: result.ok,
        offers: offersBySource[result.source],
        error: result.ok ? null : result.error
      })),
      offersBySource
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
