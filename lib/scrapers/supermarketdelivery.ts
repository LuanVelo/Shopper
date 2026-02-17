import axios from "axios";
import { Offer } from "@/types";
import { buildOffersFromRaw, RawProduct } from "@/lib/scrapers/common";

const API_URL = "https://nextgentheadless.instaleap.io/api/v3";
const CLIENT_ID = "TORRE_SUPERMERCADO";
const STORE_REFERENCE = process.env.SUPERMARKETDELIVERY_STORE_REFERENCE ?? "2";

interface GraphqlResponse {
  data?: {
    searchProducts?: {
      products?: SearchProduct[];
    };
  };
  errors?: Array<{ message?: string }>;
}

interface SearchProduct {
  sku?: string;
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
  brand?: string;
  unit?: string;
  stock?: number;
  ean?: string[] | string;
  categories?: Array<{
    name?: string;
    path?: string;
    reference?: string | null;
    slug?: string | null;
  }>;
}

function buildQuery(): string {
  return `
    query SearchProducts($input: SearchProductsInput!) {
      searchProducts(searchProductsInput: $input) {
        products {
          sku
          name
          slug
          description
          price
          isAvailable
          brand
          unit
          stock
          ean
          categories {
            name
            path
            reference
            slug
          }
        }
      }
    }
  `;
}

function toRawProducts(products: SearchProduct[]): RawProduct[] {
  return (products ?? [])
    .filter((product) => product?.name && Number.isFinite(Number(product?.price)))
    .map((product) => {
      const slug = String(product?.slug ?? "").trim();
      const title = String(product?.name ?? "").trim();
      const price = Number(product?.price ?? 0);
      const categories = Array.isArray(product?.categories)
        ? product.categories.map((category) => category?.name).filter(Boolean)
        : [];

      return {
        title,
        price,
        rawText: JSON.stringify({
          description: product?.description,
          unit: product?.unit,
          stock: product?.stock,
          ean: product?.ean,
          categories
        }),
        url: slug ? `https://www.supermarketdelivery.com.br/p/${slug}` : undefined
      } satisfies RawProduct;
    });
}

async function fetchGraphqlPage(term: string, page: number, pageSize: number): Promise<RawProduct[]> {
  const response = await axios.post<GraphqlResponse>(
    API_URL,
    {
      query: buildQuery(),
      variables: {
        input: {
          clientId: CLIENT_ID,
          storeReference: STORE_REFERENCE,
          pageSize,
          currentPage: page,
          search: [{ query: term }]
        }
      }
    },
    {
      timeout: 20000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      }
    }
  );

  const body = response.data;
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    return [];
  }

  return toRawProducts(body?.data?.searchProducts?.products ?? []);
}

export async function scrapeSupermarketDelivery(term: string): Promise<Offer[]> {
  const maxPages = 3;
  const pageSize = 24;
  const collected: RawProduct[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    let pageProducts: RawProduct[] = [];
    try {
      pageProducts = await fetchGraphqlPage(term, page, pageSize);
    } catch {
      break;
    }

    if (pageProducts.length === 0) break;
    collected.push(...pageProducts);
    if (pageProducts.length < pageSize) break;
  }

  if (collected.length === 0) {
    return [];
  }

  return buildOffersFromRaw("supermarketdelivery", term, collected);
}
