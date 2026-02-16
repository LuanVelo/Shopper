import { normalizeItemName } from "@/lib/normalization";
import { scrapeExtra } from "@/lib/scrapers/extra";
import { scrapePrezunic } from "@/lib/scrapers/prezunic";
import { scrapeZonaSul } from "@/lib/scrapers/zonasul";
import {
  CalculationResponse,
  ItemPriceSummary,
  Offer,
  PriceSnapshot,
  ShoppingItemInput,
  Unit
} from "@/types";

type CacheStore = Map<string, PriceSnapshot>;

declare global {
  // eslint-disable-next-line no-var
  var __priceCache__: CacheStore | undefined;
  // eslint-disable-next-line no-var
  var __lastUpdate__: string | undefined;
}

const priceCache: CacheStore = global.__priceCache__ ?? new Map<string, PriceSnapshot>();
global.__priceCache__ = priceCache;

function makeCacheKey(source: string, term: string): string {
  return `${source}|${term}`;
}

async function fetchOffers(term: string): Promise<Offer[]> {
  const [prezunic, zonasul, extra] = await Promise.all([
    getOrScrape("prezunic", term, scrapePrezunic),
    getOrScrape("zonasul", term, scrapeZonaSul),
    getOrScrape("extra", term, scrapeExtra)
  ]);

  return [...prezunic, ...zonasul, ...extra];
}

async function getOrScrape(
  source: "prezunic" | "zonasul" | "extra",
  term: string,
  scraper: (term: string) => Promise<Offer[]>
): Promise<Offer[]> {
  const normalizedTerm = normalizeItemName(term);
  const key = makeCacheKey(source, normalizedTerm);
  const cache = priceCache.get(key);

  if (cache && isFresh(cache.fetchedAt)) {
    return cache.offers;
  }

  const offers = await scraper(normalizedTerm);
  priceCache.set(key, {
    source,
    term: normalizedTerm,
    offers,
    fetchedAt: new Date().toISOString()
  });

  return offers;
}

function isFresh(fetchedAt: string): boolean {
  const elapsedMs = Date.now() - new Date(fetchedAt).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  return elapsedMs <= oneDayMs;
}

function decimalPlaces(value: number): number {
  const text = value.toString();
  if (!text.includes(".")) return 0;
  return text.split(".")[1].length;
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function inferQuantityRule(
  unit: Unit,
  offers: Offer[]
): {
  min: number;
  step: number;
} {
  if (unit === "un") {
    return { min: 1, step: 1 };
  }

  const quantities = Array.from(
    new Set(
      offers
        .map((offer) => offer.packageQuantity)
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Number(value.toFixed(3)))
    )
  ).sort((a, b) => a - b);

  if (quantities.length === 0) return { min: 1, step: 1 };
  if (quantities.length === 1) return { min: quantities[0], step: quantities[0] };

  const maxDecimals = quantities.reduce((acc, value) => Math.max(acc, decimalPlaces(value)), 0);
  const factor = 10 ** maxDecimals;
  const ints = quantities.map((value) => Math.round(value * factor));
  let divisor = ints[0];
  for (let i = 1; i < ints.length; i += 1) {
    divisor = gcdInt(divisor, ints[i]);
  }

  const step = Number((divisor / factor).toFixed(maxDecimals));
  return {
    min: quantities[0],
    step: step > 0 ? step : quantities[0]
  };
}

function applyQuantityRule(quantity: number, rule: { min: number; step: number }): number {
  const safeQty = Number.isFinite(quantity) && quantity > 0 ? quantity : rule.min;
  if (safeQty <= rule.min) return rule.min;

  const steps = Math.round((safeQty - rule.min) / rule.step);
  const snapped = rule.min + steps * rule.step;
  const precision = Math.max(decimalPlaces(rule.min), decimalPlaces(rule.step));
  return Number(snapped.toFixed(precision));
}

function pickReferenceUnit(offers: Offer[]): Unit {
  if (offers.length === 0) return "un";

  const countByUnit = offers.reduce<Record<Unit, number>>(
    (acc, offer) => {
      acc[offer.packageUnit] += 1;
      return acc;
    },
    { un: 0, g: 0, kg: 0, ml: 0, l: 0 }
  );

  const unitsByPriority: Unit[] = ["kg", "g", "l", "ml", "un"];
  let winner: Unit = "un";
  let best = -1;

  for (const unit of unitsByPriority) {
    if (countByUnit[unit] > best) {
      best = countByUnit[unit];
      winner = unit;
    }
  }

  return winner;
}

function summarizeItem(input: ShoppingItemInput, offers: Offer[]): ItemPriceSummary {
  const referenceUnit = pickReferenceUnit(offers);
  const offersInReferenceUnit = offers
    .filter((offer) => offer.packageUnit === referenceUnit && offer.packageQuantity > 0)
    .map((offer) => ({
      ...offer,
      normalizedPricePerUserUnit: offer.packagePrice / offer.packageQuantity
    }));
  const quantityRule = inferQuantityRule(referenceUnit, offersInReferenceUnit);
  const normalizedQuantity = applyQuantityRule(input.quantity, quantityRule);

  const unitPrices = offersInReferenceUnit.map((offer) => offer.normalizedPricePerUserUnit);

  const lowestUnitPrice = unitPrices.length ? Math.min(...unitPrices) : 0;
  const averageUnitPrice = unitPrices.length
    ? unitPrices.reduce((acc, value) => acc + value, 0) / unitPrices.length
    : 0;

  const bestOffer =
    offersInReferenceUnit.find((offer) => offer.normalizedPricePerUserUnit === lowestUnitPrice) ?? null;

  return {
    itemName: normalizeItemName(input.name),
    quantity: normalizedQuantity,
    unit: referenceUnit,
    quantityRule,
    lowestUnitPrice,
    averageUnitPrice,
    lowestTotalPrice: lowestUnitPrice * normalizedQuantity,
    averageTotalPrice: averageUnitPrice * normalizedQuantity,
    bestSource: bestOffer?.source ?? null,
    offers: offersInReferenceUnit
  };
}

export async function calculateListPrices(
  cep: string,
  rawItems: ShoppingItemInput[]
): Promise<CalculationResponse> {
  const items = rawItems
    .filter((item) => item.name.trim() && Number.isFinite(item.quantity) && item.quantity > 0)
    .map((item) => ({
      name: normalizeItemName(item.name),
      quantity: item.quantity
    }));

  const summaries: ItemPriceSummary[] = [];

  for (const item of items) {
    const offers = await fetchOffers(item.name);
    summaries.push(summarizeItem(item, offers));
  }

  const summary = {
    itemsCount: summaries.length,
    lowestTotalListPrice: summaries.reduce((acc, item) => acc + item.lowestTotalPrice, 0),
    averageTotalListPrice: summaries.reduce((acc, item) => acc + item.averageTotalPrice, 0)
  };

  return {
    cep,
    generatedAt: new Date().toISOString(),
    items: summaries,
    summary
  };
}

export async function refreshAllCachedPrices(): Promise<{ updated: number; estimatedSeconds: number }> {
  const snapshots = Array.from(priceCache.values());
  const targets = snapshots.length;

  for (const snapshot of snapshots) {
    if (snapshot.source === "prezunic") {
      snapshot.offers = await scrapePrezunic(snapshot.term);
    }
    if (snapshot.source === "zonasul") {
      snapshot.offers = await scrapeZonaSul(snapshot.term);
    }
    if (snapshot.source === "extra") {
      snapshot.offers = await scrapeExtra(snapshot.term);
    }
    snapshot.fetchedAt = new Date().toISOString();
    const key = makeCacheKey(snapshot.source, snapshot.term);
    priceCache.set(key, snapshot);
  }

  global.__lastUpdate__ = new Date().toISOString();

  return {
    updated: targets,
    estimatedSeconds: Math.max(6, targets * 2)
  };
}

export function getLastUpdate(): string | null {
  return global.__lastUpdate__ ?? null;
}
