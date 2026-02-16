export type SourceName = "prezunic" | "zonasul" | "extra";

export type Unit = "un" | "g" | "kg" | "ml" | "l";

export interface ShoppingItemInput {
  name: string;
  quantity: number;
}

export interface Offer {
  source: SourceName;
  itemName: string;
  productTitle: string;
  packageQuantity: number;
  packageUnit: Unit;
  packagePrice: number;
  normalizedPricePerUserUnit: number;
  productUrl?: string;
  isFallback?: boolean;
  collectedAt: string;
}

export interface ItemPriceSummary {
  itemName: string;
  quantity: number;
  unit: Unit;
  quantityRule: {
    min: number;
    step: number;
  };
  lowestUnitPrice: number;
  averageUnitPrice: number;
  lowestTotalPrice: number;
  averageTotalPrice: number;
  bestSource: SourceName | null;
  bestOfferUrl: string | null;
  bestOfferTitle: string | null;
  hasRealOffers: boolean;
  offers: Offer[];
}

export interface ListSummary {
  itemsCount: number;
  lowestTotalListPrice: number;
  averageTotalListPrice: number;
}

export interface CalculationResponse {
  cep: string;
  generatedAt: string;
  items: ItemPriceSummary[];
  summary: ListSummary;
}

export interface PriceSnapshot {
  source: SourceName;
  term: string;
  offers: Offer[];
  fetchedAt: string;
}
