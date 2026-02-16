import * as cheerio from "cheerio";
import { Offer } from "@/types";
import { buildOffersFromRaw, fallbackOffers, fetchHtml, parsePriceText, RawProduct } from "@/lib/scrapers/common";

export async function scrapeExtra(term: string): Promise<Offer[]> {
  const encodedTerm = encodeURIComponent(term);
  const searchUrls = [
    `https://www.extramercado.com.br/busca?ft=${encodedTerm}`,
    `https://www.extramercado.com.br/${encodedTerm}?map=ft`
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

        products.push({ title, price: parsedPrice, rawText: $(el).text().trim() });
      });

      if (products.length > 0) {
        return buildOffersFromRaw("extra", term, products).slice(0, 6);
      }
    } catch {
      // Try the next URL.
    }
  }

  return fallbackOffers("extra", term);
}
