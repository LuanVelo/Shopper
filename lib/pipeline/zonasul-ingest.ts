import { NormalizedMarketOffer } from "@/lib/market/schema";
import { fetchZonaSulProductsByCategory } from "@/lib/scrapers/zonasul-market";
import { saveMarketSnapshot } from "@/lib/storage/market-store";

export interface IngestZonaSulInput {
  categoryId: number;
  page?: number;
  pageSize?: number;
}

export async function ingestZonaSulCategory(input: IngestZonaSulInput) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 24;
  const collectedAt = new Date().toISOString();

  const result = await fetchZonaSulProductsByCategory(input.categoryId, page, pageSize);

  const offers: NormalizedMarketOffer[] = result.items.map((item) => ({
    market: "zonasul",
    categoryId: result.categoryId,
    categoryPath: item.categoryPath,
    productIdMarket: item.productId,
    productName: item.itemName,
    brand: item.brand,
    packageQuantity: item.packageQuantity,
    packageUnit: item.unit,
    priceFrom: item.priceFrom,
    priceBy: item.priceBy,
    pricePerUnit: item.pricePerUnit,
    currency: "BRL",
    productUrl: item.productUrl,
    inStock: item.inStock,
    capturedAt: collectedAt,
    rawPayload: item.rawPayload
  }));

  const snapshot = await saveMarketSnapshot({
    market: "zonasul",
    categoryId: result.categoryId,
    strategy: result.strategy,
    endpoint: result.endpoint,
    page: result.page,
    pageSize: result.pageSize,
    capturedAt: collectedAt,
    offers
  });

  return snapshot;
}

