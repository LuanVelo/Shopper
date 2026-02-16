import { NextRequest, NextResponse } from "next/server";
import { ingestZonaSulCategory } from "@/lib/pipeline/zonasul-ingest";

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const categoryId = Number(body?.categoryId);
    const page = parsePositiveInt(body?.page ? String(body.page) : null, 1);
    const pageSize = parsePositiveInt(body?.pageSize ? String(body.pageSize) : null, 24);

    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { error: "categoryId é obrigatório e precisa ser inteiro positivo." },
        { status: 400 }
      );
    }

    const snapshot = await ingestZonaSulCategory({ categoryId, page, pageSize });

    return NextResponse.json({
      ok: true,
      snapshotId: snapshot.snapshotId,
      market: snapshot.market,
      categoryId: snapshot.categoryId,
      capturedAt: snapshot.capturedAt,
      offersCount: snapshot.offersCount
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao executar ingestão do Zona Sul",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}

