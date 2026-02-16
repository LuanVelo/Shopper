export type MarketName = "zonasul" | "prezunic" | "extra";

export interface NormalizedMarketOffer {
  market: MarketName;
  categoryId: number;
  categoryPath: string | null;
  productIdMarket: string | null;
  productName: string;
  brand: string | null;
  packageQuantity: number | null;
  packageUnit: string;
  priceFrom: number | null;
  priceBy: number | null;
  pricePerUnit: number | null;
  currency: "BRL";
  productUrl: string | null;
  inStock: boolean | null;
  capturedAt: string;
  rawPayload: unknown;
}

export interface MarketSnapshotFile {
  snapshotId: string;
  market: MarketName;
  categoryId: number;
  strategy: string;
  endpoint: string;
  page: number;
  pageSize: number;
  capturedAt: string;
  offersCount: number;
  offers: NormalizedMarketOffer[];
}

