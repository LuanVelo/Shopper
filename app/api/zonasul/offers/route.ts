import { NextRequest, NextResponse } from "next/server";
import { loadLatestMarketSnapshot } from "@/lib/storage/market-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const categoryId = Number(request.nextUrl.searchParams.get("categoryId"));
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "0");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 0;
    const includeRaw = request.nextUrl.searchParams.get("includeRaw") === "1";

    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { error: "Informe categoryId como inteiro positivo." },
        { status: 400 }
      );
    }

    const snapshot = await loadLatestMarketSnapshot("zonasul", categoryId);
    if (!snapshot) {
      return NextResponse.json(
        {
          error: "Nenhum snapshot encontrado para essa categoria.",
          hint: "Execute primeiro POST /api/zonasul/ingest"
        },
        { status: 404 }
      );
    }

    const baseOffers = limit > 0 ? snapshot.offers.slice(0, limit) : snapshot.offers;
    const offers = includeRaw
      ? baseOffers
      : baseOffers.map((offer) => {
          const { rawPayload: _rawPayload, ...withoutRaw } = offer;
          return withoutRaw;
        });

    return NextResponse.json({
      market: snapshot.market,
      categoryId: snapshot.categoryId,
      snapshotId: snapshot.snapshotId,
      capturedAt: snapshot.capturedAt,
      offersCount: snapshot.offersCount,
      includeRaw,
      offers
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao carregar ofertas persistidas",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}
