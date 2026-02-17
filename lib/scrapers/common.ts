import axios from "axios";
import { Offer, SourceName, Unit } from "@/types";
import { normalizeItemName, parsePackageFromTitle } from "@/lib/normalization";

export interface RawProduct {
  title: string;
  price: number;
  listPrice?: number;
  unitMultiplier?: number;
  measurementUnit?: string;
  rawText?: string;
  url?: string;
}

const WEIGHT_ITEM_REGEX =
  /\b(ancho|bife|contra|file|filé|picanha|alcatra|maminha|fraldinha|patinho|ac[eé]m|costela|cupim|m[uú]sculo|cox[aã]o|lagarto|lingui[cç]a|carne|frango|coxa|sobrecoxa|asa|peixe|salm[aã]o|til[aá]pia|su[ií]n|porco)\b/;
const BUTCHER_CATEGORY_REGEX =
  /\b(ancho|bife|contra|file|picanha|alcatra|maminha|fraldinha|patinho|acem|costela|cupim|musculo|coxao|lagarto|linguica|carne|frango|coxa|sobrecoxa|asa|peixe|salmao|tilapia|suin|porco|bovino|resfriado)\b/;

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

export function toAbsoluteProductUrl(baseUrl: string, href: string | undefined): string | undefined {
  if (!href || !href.trim()) return undefined;
  const value = href.trim();
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${baseUrl}${value}`;
  return `${baseUrl}/${value}`;
}

export function makeSourceSearchUrl(source: SourceName, term: string): string {
  const encoded = encodeURIComponent(term);
  if (source === "prezunic") return `https://www.prezunic.com.br/busca/?ft=${encoded}`;
  if (source === "zonasul") return `https://www.zonasul.com.br/busca?ft=${encoded}`;
  if (source === "extra") return `https://www.extramercado.com.br/busca?ft=${encoded}`;
  return `https://www.supermarketdelivery.com.br/search?term=${encoded}`;
}

function parsePriceFromVtexProduct(product: any): number | null {
  const firstItem = Array.isArray(product?.items) ? product.items[0] : null;
  const firstSeller = Array.isArray(firstItem?.sellers) ? firstItem.sellers[0] : null;
  const offer = firstSeller?.commertialOffer ?? firstSeller?.commercialOffer ?? {};

  const priceFromSeller = Number(offer?.Price);
  if (Number.isFinite(priceFromSeller) && priceFromSeller > 0) return priceFromSeller;

  const rangePrice = Number(product?.priceRange?.sellingPrice?.lowPrice);
  if (Number.isFinite(rangePrice) && rangePrice > 0) return rangePrice;

  return null;
}

function parseListPriceFromVtexProduct(product: any): number | undefined {
  const firstItem = Array.isArray(product?.items) ? product.items[0] : null;
  const firstSeller = Array.isArray(firstItem?.sellers) ? firstItem.sellers[0] : null;
  const offer = firstSeller?.commertialOffer ?? firstSeller?.commercialOffer ?? {};

  const listFromSeller = Number(offer?.ListPrice);
  if (Number.isFinite(listFromSeller) && listFromSeller > 0) return listFromSeller;

  const rangeList = Number(product?.priceRange?.listPrice?.highPrice);
  if (Number.isFinite(rangeList) && rangeList > 0) return rangeList;

  return undefined;
}

function parseUnitDataFromVtexProduct(product: any): { unitMultiplier?: number; measurementUnit?: string } {
  const firstItem = Array.isArray(product?.items) ? product.items[0] : null;
  const unitMultiplier = Number(firstItem?.unitMultiplier);
  const measurementUnit =
    typeof firstItem?.measurementUnit === "string" ? firstItem.measurementUnit.trim().toLowerCase() : undefined;

  return {
    unitMultiplier: Number.isFinite(unitMultiplier) && unitMultiplier > 0 ? unitMultiplier : undefined,
    measurementUnit: measurementUnit || undefined
  };
}

function mapVtexProductToRaw(baseUrl: string, product: any): RawProduct | null {
  const title = String(product?.productName ?? "").trim();
  if (!title) return null;

  const price = parsePriceFromVtexProduct(product);
  if (!price) return null;

  const pathCandidate = product?.link ?? product?.linkText ?? "";
  const productUrl = toAbsoluteProductUrl(baseUrl, typeof pathCandidate === "string" ? pathCandidate : undefined);
  const unitData = parseUnitDataFromVtexProduct(product);

  return {
    title,
    price,
    listPrice: parseListPriceFromVtexProduct(product),
    unitMultiplier: unitData.unitMultiplier,
    measurementUnit: unitData.measurementUnit,
    rawText: JSON.stringify({
      productName: product?.productName,
      categories: product?.categories,
      measurementUnit: unitData.measurementUnit,
      unitMultiplier: unitData.unitMultiplier
    }),
    url: productUrl
  };
}

function parseSearchPayload(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray((payload as any).products)) {
    return (payload as any).products;
  }
  return [];
}

export async function fetchVtexProductsByTerm(
  baseUrl: string,
  term: string,
  pageSize = 24,
  maxPages = 3
): Promise<RawProduct[]> {
  const safePageSize = Math.max(1, Math.min(50, Math.floor(pageSize)));
  const safeMaxPages = Math.max(1, Math.min(6, Math.floor(maxPages)));
  const encodedTerm = encodeURIComponent(term);

  const endpoints = [
    (from: number, to: number) =>
      `${baseUrl}/api/catalog_system/pub/products/search?ft=${encodedTerm}&_from=${from}&_to=${to}`,
    (from: number, to: number) =>
      `${baseUrl}/api/io/_v/api/intelligent-search/product_search?ft=${encodedTerm}&from=${from}&to=${to}`
  ];

  const seenTitles = new Set<string>();
  const output: RawProduct[] = [];

  for (const endpointBuilder of endpoints) {
    for (let page = 0; page < safeMaxPages; page += 1) {
      const from = page * safePageSize;
      const to = from + safePageSize - 1;
      const endpoint = endpointBuilder(from, to);
      try {
        const response = await axios.get(endpoint, {
          timeout: 15000,
          headers: {
            Accept: "application/json,text/plain,*/*",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
          }
        });
        const products = parseSearchPayload(response.data);
        if (!products.length) break;

        for (const product of products) {
          const mapped = mapVtexProductToRaw(baseUrl, product);
          if (!mapped) continue;
          const dedupeKey = `${mapped.title.toLowerCase()}|${mapped.price}`;
          if (seenTitles.has(dedupeKey)) continue;
          seenTitles.add(dedupeKey);
          output.push(mapped);
        }

        if (products.length < safePageSize) break;
      } catch {
        break;
      }
    }
    if (output.length > 0) return output;
  }

  return output;
}

function normalizeLoose(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTokenAsWord(text: string, token: string): boolean {
  const safeToken = escapeRegex(token.trim());
  if (!safeToken) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${safeToken}([^a-z0-9]|$)`);
  return pattern.test(text);
}

function isRelevantForTerm(term: string, title: string): boolean {
  const normalizedTerm = normalizeLoose(term).trim();
  const normalizedTitle = normalizeLoose(title);
  if (!normalizedTerm || !normalizedTitle) return false;

  const tokens = normalizedTerm.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const allTokensPresent = tokens.every((token) =>
      token.length >= 3 ? containsTokenAsWord(normalizedTitle, token) : normalizedTitle.includes(token)
    );
    if (!allTokensPresent) return false;
  } else {
    const token = tokens[0] ?? normalizedTerm;
    if (token.length >= 3) {
      if (!containsTokenAsWord(normalizedTitle, token)) return false;
    } else if (!normalizedTitle.includes(normalizedTerm)) {
      return false;
    }
  }

  // Se o termo é de açougue, restringe resultados para itens de açougue.
  if (BUTCHER_CATEGORY_REGEX.test(normalizedTerm) && !BUTCHER_CATEGORY_REGEX.test(normalizedTitle)) {
    return false;
  }

  // Regra específica para "leite": manter apenas leite líquido/UHT e excluir derivados.
  if (normalizedTerm === "leite") {
    if (!/\bleite\b/.test(normalizedTitle)) return false;

    const negativeMilk =
      /\b(doce|condensado|coco|fermentado|po|chocolate|biscoito|sabonete|desodorante|creme|pudim|whey|bala|sorvete|licor|pao|sonho|fondant|bombom|cookies?)\b/;
    if (negativeMilk.test(normalizedTitle)) return false;

    const positiveMilk =
      /\b(uht|longa vida|integral|desnatado|semidesnatado|zero lactose|lactose|a2|liquido|liquida|litro|[0-9]+l)\b/;
    return positiveMilk.test(normalizedTitle);
  }

  return true;
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
      if (!isRelevantForTerm(normalizedTerm, product.title)) return null;
      const basePackageInfo = parsePackageFromTitle(product.title);
      if (!basePackageInfo) return null;
      if (!basePackageInfo.quantity || basePackageInfo.quantity <= 0) return null;
      const weightedItem = isWeightBasedItem(term, product.title);
      let packageInfo = basePackageInfo;
      const unitPriceFromCard = product.rawText ? extractUnitPriceFromText(product.rawText) : null;
      const hasExplicitMeasurePrice = Boolean(unitPriceFromCard);

      if (weightedItem && packageInfo.unit === "un") {
        packageInfo = { quantity: 1, unit: "kg" };
      } else if (weightedItem && packageInfo.unit === "g") {
        packageInfo = { quantity: packageInfo.quantity / 1000, unit: "kg" };
      }

      if (product.unitMultiplier && product.unitMultiplier > 0 && product.measurementUnit) {
        const possibleUnit = product.measurementUnit as Unit;
        if (["un", "g", "kg", "ml", "l"].includes(possibleUnit)) {
          const shouldOverrideByVtexUnit = possibleUnit !== "un" || packageInfo.unit === "un";
          if (shouldOverrideByVtexUnit) {
            packageInfo = { quantity: product.unitMultiplier, unit: possibleUnit };
          }
        }
      }

      // Regra de compra: se o card não informar preço por medida (ex.: R$/kg, R$/L),
      // tratar como item por unidade (pacote), mesmo que o título contenha "450g", "1L", etc.
      if (!weightedItem && !hasExplicitMeasurePrice && packageInfo.unit !== "un") {
        packageInfo = { quantity: 1, unit: "un" };
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
        isFallback: false,
        collectedAt: new Date().toISOString()
      } as Offer;
    })
    .filter((offer): offer is Offer => Boolean(offer));
}
