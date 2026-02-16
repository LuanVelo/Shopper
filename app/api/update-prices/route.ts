import { NextResponse } from "next/server";
import { getLastUpdate, refreshAllCachedPrices } from "@/lib/price-engine";
import { ensureMonthlyScheduler } from "@/lib/scheduler";

ensureMonthlyScheduler();

export async function GET() {
  return NextResponse.json({
    lastUpdate: await getLastUpdate(),
    estimateSeconds: 0
  });
}

export async function POST() {
  try {
    const startedAt = Date.now();
    const result = await refreshAllCachedPrices();
    const elapsed = Math.round((Date.now() - startedAt) / 1000);

    return NextResponse.json({
      ...result,
      elapsedSeconds: elapsed,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha na atualização manual",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}
