import { NextRequest, NextResponse } from "next/server";
import { calculateListPrices } from "@/lib/price-engine";
import { ensureMonthlyScheduler } from "@/lib/scheduler";
import { DEFAULT_CEP } from "@/lib/categories";

ensureMonthlyScheduler();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cep = String(body?.cep ?? DEFAULT_CEP);
    const items = Array.isArray(body?.items) ? body.items : [];

    const result = await calculateListPrices(cep, items);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao calcular preços",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 400 }
    );
  }
}
