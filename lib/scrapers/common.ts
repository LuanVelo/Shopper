import axios from "axios";
import { Offer, SourceName, Unit } from "@/types";
import { normalizeItemName, parsePackageFromTitle } from "@/lib/normalization";

export interface RawProduct {
  title: string;
  price: number;
  rawText?: string;
  url?: string;
}

const FALLBACK_BASE: Record<SourceName, number> = {
  prezunic: 1,
  zonasul: 1.08,
  extra: 0.96
};

const WEIGHT_ITEM_REGEX =
  /\b(ancho|bife|contra|file|filé|picanha|alcatra|maminha|fraldinha|patinho|ac[eé]m|costela|cupim|m[uú]sculo|cox[aã]o|lagarto|lingui[cç]a|carne|frango|coxa|sobrecoxa|asa|peixe|salm[aã]o|til[aá]pia|su[ií]n|porco)\b/;

export async function fetchHtml(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    timeout: 12000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml"
    }
  });

  return response.data;
}

export function parsePriceText(text: string): number | null {
  const compact = text.replace(/\s+/g, " ").trim();
  const brlLike =
    compact.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/) ??
    compact.match(/(\d+[.,]\d{2})/) ??
    compact.match(/(\d+)/);

  if (!brlLike) return null;
  const parsed = Number(brlLike[1].replace(/\.(?=\d{3})/g, "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeLoose(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function isWeightBasedItem(term: string, title: string): boolean {
  return WEIGHT_ITEM_REGEX.test(normalizeLoose(`${term} ${title}`));
}

function extractUnitPriceFromText(rawText: string): { price: number; unit: Unit } | null {
  const normalized = normalizeLoose(rawText);
  const patterns: Array<{ regex: RegExp; unit: Unit }> = [
    { regex: /(\d+[\.,]\d{2})\s*\/\s*kg\b/, unit: "kg" },
    { regex: /(\d+[\.,]\d{2})\s*\/\s*g\b/, unit: "g" },
    { regex: /(\d+[\.,]\d{2})\s*\/\s*l\b/, unit: "l" },
    { regex: /(\d+[\.,]\d{2})\s*\/\s*ml\b/, unit: "ml" }
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;
    const price = Number(match[1].replace(",", "."));
    if (Number.isFinite(price) && price > 0) {
      return { price, unit: pattern.unit };
    }
  }

  return null;
}

export function buildOffersFromRaw(
  source: SourceName,
  term: string,
  products: RawProduct[]
): Offer[] {
  const normalizedTerm = normalizeItemName(term);

  return products
    .map((product) => {
      const basePackageInfo = parsePackageFromTitle(product.title);
      if (!basePackageInfo) return null;
      if (!basePackageInfo.quantity || basePackageInfo.quantity <= 0) return null;
      const weightedItem = isWeightBasedItem(term, product.title);
      let packageInfo = basePackageInfo;
      const unitPriceFromCard = product.rawText ? extractUnitPriceFromText(product.rawText) : null;

      if (weightedItem && packageInfo.unit === "un") {
        packageInfo = { quantity: 1, unit: "kg" };
      } else if (weightedItem && packageInfo.unit === "g") {
        packageInfo = { quantity: packageInfo.quantity / 1000, unit: "kg" };
      }

      if (!packageInfo.quantity || packageInfo.quantity <= 0) return null;
      let finalPrice = product.price;
      if (unitPriceFromCard && (weightedItem || unitPriceFromCard.unit === packageInfo.unit)) {
        packageInfo = { quantity: 1, unit: unitPriceFromCard.unit };
        finalPrice = unitPriceFromCard.price;
      }

      // Alguns e-commerces exibem açougue no card como preço por 100g.
      if (weightedItem && packageInfo.unit === "kg" && finalPrice < 15) {
        finalPrice = Number((finalPrice * 10).toFixed(2));
      }

      return {
        source,
        itemName: normalizedTerm,
        productTitle: product.title,
        packageQuantity: packageInfo.quantity,
        packageUnit: packageInfo.unit,
        packagePrice: finalPrice,
        normalizedPricePerUserUnit: finalPrice / packageInfo.quantity,
        productUrl: product.url,
        collectedAt: new Date().toISOString()
      } as Offer;
    })
    .filter((offer): offer is Offer => Boolean(offer));
}

function inferFallbackUnit(term: string): Unit {
  const normalized = normalizeItemName(term);
  if (WEIGHT_ITEM_REGEX.test(normalizeLoose(normalized))) return "kg";
  if (/leite|suco|refrigerante|agua|água|oleo|óleo|vinho|cerveja/.test(normalized)) return "l";
  return "un";
}

export function fallbackOffers(source: SourceName, term: string): Offer[] {
  const normalizedTerm = normalizeItemName(term);
  const now = new Date().toISOString();
  const base = (normalizedTerm.length % 8) + 2.7;
  const multiplier = FALLBACK_BASE[source];
  const unit = inferFallbackUnit(term);

  const prices = [
    Number(((unit === "kg" ? 52 : base) * multiplier).toFixed(2)),
    Number(((unit === "kg" ? 57 : base * 1.1) * multiplier).toFixed(2)),
    Number(((unit === "kg" ? 48 : base * 0.92) * multiplier).toFixed(2))
  ];

  return prices.map((price, idx) => ({
    source,
    itemName: normalizedTerm,
    productTitle: `${term} - referência ${idx + 1}`,
    packageQuantity: 1,
    packageUnit: unit,
    packagePrice: price,
    normalizedPricePerUserUnit: price,
    collectedAt: now
  }));
}
