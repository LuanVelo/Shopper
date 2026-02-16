import { NextRequest, NextResponse } from "next/server";
import { fetchZonaSulFlatCategories, fetchZonaSulProductsByCategory } from "@/lib/scrapers/zonasul-market";

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
  try {
    const categoryIdRaw = request.nextUrl.searchParams.get("categoryId");
    const level = parsePositiveInt(request.nextUrl.searchParams.get("level"), 3);
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), 24);

    if (!categoryIdRaw) {
      const categories = await fetchZonaSulFlatCategories(level);
      return NextResponse.json({
        source: "zonasul",
        recommendedFormat: "VTEX JSON API por categoria",
        howToUse: {
          step1: "Listar categorias (esta rota sem categoryId)",
          step2: "Buscar produtos por categoria usando ?categoryId=<id>"
        },
        categoriesCount: categories.length,
        categories
      });
    }

    const categoryId = Number(categoryIdRaw);
    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { error: "categoryId inválido. Use um número inteiro positivo." },
        { status: 400 }
      );
    }

    const result = await fetchZonaSulProductsByCategory(categoryId, page, pageSize);

    return NextResponse.json({
      source: "zonasul",
      recommendedFormat: "VTEX JSON API por categoria",
      extractedFields: [
        "itemName",
        "priceFrom",
        "priceBy",
        "pricePerUnit",
        "unit",
        "categoryPath",
        "productUrl"
      ],
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao coletar dados do Zona Sul",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}
