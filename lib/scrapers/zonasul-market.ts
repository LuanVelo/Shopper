import axios from "axios";
import { parsePackageFromTitle } from "@/lib/normalization";

const BASE_URL = "https://www.zonasul.com.br";

export interface ZonaSulCategory {
  id: number;
  name: string;
  url: string;
  title?: string;
  hasChildren: boolean;
  children?: ZonaSulCategory[];
}

export interface ZonaSulCategoryFlat {
  id: number;
  name: string;
  url: string;
  path: string;
  depth: number;
}

export interface ZonaSulMarketItem {
  categoryPath: string | null;
  itemName: string;
  priceFrom: number | null;
  priceBy: number | null;
  pricePerUnit: number | null;
  unit: string;
  productUrl: string | null;
}

export interface ZonaSulProductsByCategoryResult {
  strategy: "vtex-catalog-api" | "vtex-intelligent-search-api";
  endpoint: string;
  categoryId: number;
  page: number;
  pageSize: number;
  items: ZonaSulMarketItem[];
}

interface VtexCategoryNode {
  id: number | string;
  name: string;
  url?: string;
  title?: string;
  children?: VtexCategoryNode[];
}

interface PriceContext {
  priceFrom: number | null;
  priceBy: number | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function normalizeUnit(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "un";
  return value.trim().toLowerCase();
}

function makeAbsoluteUrl(pathOrUrl: unknown): string | null {
  if (typeof pathOrUrl !== "string" || !pathOrUrl.trim()) return null;
  const value = pathOrUrl.trim();
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${BASE_URL}${value}`;
  return `${BASE_URL}/${value}`;
}

function parsePriceContext(product: any): PriceContext {
  const firstItem = Array.isArray(product?.items) ? product.items[0] : null;
  const firstSeller = Array.isArray(firstItem?.sellers) ? firstItem.sellers[0] : null;
  const offer = firstSeller?.commertialOffer ?? firstSeller?.commercialOffer ?? {};

  const priceByFromSeller = toNumber(offer.Price);
  const listPriceFromSeller = toNumber(offer.ListPrice);
  const priceByFromRange = toNumber(product?.priceRange?.sellingPrice?.lowPrice);
  const listPriceFromRange = toNumber(product?.priceRange?.listPrice?.highPrice);

  const priceBy = priceByFromSeller ?? priceByFromRange ?? null;
  const listPrice = listPriceFromSeller ?? listPriceFromRange ?? null;
  const priceFrom = listPrice && priceBy && listPrice > priceBy ? listPrice : null;

  return { priceFrom, priceBy };
}

function resolvePackageInfo(product: any): { quantity: number; unit: string } {
  const firstItem = Array.isArray(product?.items) ? product.items[0] : null;
  const unitFromItem = normalizeUnit(firstItem?.measurementUnit);
  const multiplier = toNumber(firstItem?.unitMultiplier);

  if (multiplier && unitFromItem !== "un") {
    return { quantity: multiplier, unit: unitFromItem };
  }

  const parsedFromName = parsePackageFromTitle(String(product?.productName ?? ""));
  if (parsedFromName && parsedFromName.quantity > 0) {
    return {
      quantity: parsedFromName.quantity,
      unit: parsedFromName.unit
    };
  }

  if (multiplier && multiplier > 0) {
    return { quantity: multiplier, unit: unitFromItem };
  }

  return { quantity: 1, unit: unitFromItem || "un" };
}

function mapProductToMarketItem(product: any): ZonaSulMarketItem {
  const { priceFrom, priceBy } = parsePriceContext(product);
  const packageInfo = resolvePackageInfo(product);
  const pricePerUnit =
    priceBy && packageInfo.quantity > 0 ? Number((priceBy / packageInfo.quantity).toFixed(2)) : null;

  const categories = Array.isArray(product?.categories) ? product.categories : [];
  const categoryPath = categories.length ? String(categories[0]) : null;

  const productPath = product?.link ?? product?.linkText ?? null;
  const productUrl = makeAbsoluteUrl(productPath);

  return {
    categoryPath,
    itemName: String(product?.productName ?? "").trim(),
    priceFrom,
    priceBy,
    pricePerUnit,
    unit: packageInfo.unit,
    productUrl
  };
}

async function getJson<T>(url: string): Promise<T> {
  const response = await axios.get<T>(url, {
    timeout: 15000,
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    }
  });

  return response.data;
}

function toCategory(node: VtexCategoryNode): ZonaSulCategory {
  const children = Array.isArray(node.children) ? node.children.map(toCategory) : [];
  return {
    id: Number(node.id),
    name: node.name,
    url: node.url ?? "",
    title: node.title,
    hasChildren: children.length > 0,
    ...(children.length ? { children } : {})
  };
}

function flattenCategories(
  categories: ZonaSulCategory[],
  depth = 1,
  parentPath = ""
): ZonaSulCategoryFlat[] {
  const output: ZonaSulCategoryFlat[] = [];

  for (const category of categories) {
    const path = parentPath ? `${parentPath} > ${category.name}` : category.name;
    output.push({
      id: category.id,
      name: category.name,
      url: category.url,
      path,
      depth
    });

    if (category.children?.length) {
      output.push(...flattenCategories(category.children, depth + 1, path));
    }
  }

  return output;
}

export async function fetchZonaSulCategoryTree(level = 3): Promise<ZonaSulCategory[]> {
  const safeLevel = Math.min(Math.max(level, 1), 5);
  const url = `${BASE_URL}/api/catalog_system/pub/category/tree/${safeLevel}`;
  const data = await getJson<VtexCategoryNode[]>(url);
  return (Array.isArray(data) ? data : []).map(toCategory);
}

export async function fetchZonaSulFlatCategories(level = 3): Promise<ZonaSulCategoryFlat[]> {
  const tree = await fetchZonaSulCategoryTree(level);
  return flattenCategories(tree);
}

export async function fetchZonaSulProductsByCategory(
  categoryId: number,
  page = 1,
  pageSize = 24
): Promise<ZonaSulProductsByCategoryResult> {
  const safeCategoryId = Number(categoryId);
  if (!Number.isFinite(safeCategoryId) || safeCategoryId <= 0) {
    throw new Error("categoryId inválido");
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;

  const strategies: Array<{
    name: ZonaSulProductsByCategoryResult["strategy"];
    endpoint: string;
    parse: (payload: unknown) => any[];
  }> = [
    {
      name: "vtex-catalog-api",
      endpoint: `${BASE_URL}/api/catalog_system/pub/products/search?fq=C:/${safeCategoryId}/&_from=${from}&_to=${to}`,
      parse: (payload) => (Array.isArray(payload) ? payload : [])
    },
    {
      name: "vtex-intelligent-search-api",
      endpoint: `${BASE_URL}/api/io/_v/api/intelligent-search/product_search?fq=C:/${safeCategoryId}/&from=${from}&to=${to}`,
      parse: (payload) => {
        if (Array.isArray(payload)) return payload;
        if (payload && typeof payload === "object" && Array.isArray((payload as any).products)) {
          return (payload as any).products;
        }
        return [];
      }
    }
  ];

  const errors: string[] = [];

  for (const strategy of strategies) {
    try {
      const payload = await getJson<unknown>(strategy.endpoint);
      const products = strategy.parse(payload).filter(Boolean);
      const items = products.map(mapProductToMarketItem).filter((item) => item.itemName);

      return {
        strategy: strategy.name,
        endpoint: strategy.endpoint,
        categoryId: safeCategoryId,
        page: safePage,
        pageSize: safeSize,
        items
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      errors.push(`${strategy.name}: ${message}`);
    }
  }

  throw new Error(`Falha ao buscar produtos por categoria no Zona Sul. ${errors.join(" | ")}`);
}
