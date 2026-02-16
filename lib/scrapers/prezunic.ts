import * as cheerio from "cheerio";
import { Offer } from "@/types";
import {
  buildOffersFromRaw,
  fetchVtexProductsByTerm,
  fetchHtml,
  parsePriceText,
  RawProduct,
  toAbsoluteProductUrl
} from "@/lib/scrapers/common";

export async function scrapePrezunic(term: string): Promise<Offer[]> {
  const baseUrl = "https://www.prezunic.com.br";
  const apiProducts = await fetchVtexProductsByTerm(baseUrl, term, 24, 3);
  if (apiProducts.length > 0) {
    return buildOffersFromRaw("prezunic", term, apiProducts);
  }

  const encodedTerm = encodeURIComponent(term);
  const searchUrls = [
    `https://www.prezunic.com.br/busca/?ft=${encodedTerm}`,
    `https://www.prezunic.com.br/${encodedTerm}?map=ft`
  ];

  for (const url of searchUrls) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const products: RawProduct[] = [];

      $(".vtex-search-result-3-x-galleryItem, .product-item, li[layout]").each((_, el) => {
        const title =
          $(el).find(".vtex-product-summary-2-x-productBrand").text().trim() ||
          $(el).find(".product-item__name").text().trim() ||
          $(el).find("h3, h2").first().text().trim();

        const priceText =
          $(el).find(".vtex-product-price-1-x-currencyContainer").first().text().trim() ||
          $(el).find(".price, .product-item__price").first().text().trim() ||
          $(el).text();

        if (!title || !priceText) return;
        const parsedPrice = parsePriceText(priceText);
        if (!parsedPrice) return;
        const productHref =
          $(el).find("a.vtex-product-summary-2-x-clearLink").attr("href") ||
          $(el).find("a.product-item__name").attr("href") ||
          $(el).find("a").first().attr("href");

        products.push({
          title,
          price: parsedPrice,
          rawText: $(el).text().trim(),
          url: toAbsoluteProductUrl(baseUrl, productHref)
        });
      });

      if (products.length > 0) {
        return buildOffersFromRaw("prezunic", term, products);
      }
    } catch {
      // Try the next URL.
    }
  }

  return [];
}
