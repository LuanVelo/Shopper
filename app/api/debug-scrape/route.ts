import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { scrapeExtra } from "@/lib/scrapers/extra";
import { scrapePrezunic } from "@/lib/scrapers/prezunic";
import { scrapeZonaSul } from "@/lib/scrapers/zonasul";
import { normalizeItemName } from "@/lib/normalization";

function safeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET(request: NextRequest) {
  try {
    const term = request.nextUrl.searchParams.get("term")?.trim() ?? "";
    if (!term) {
      return NextResponse.json({ error: "Informe o parâmetro term" }, { status: 400 });
    }

    const normalizedTerm = normalizeItemName(term);
    const [prezunic, zonasul, extra] = await Promise.all([
      scrapePrezunic(normalizedTerm),
      scrapeZonaSul(normalizedTerm),
      scrapeExtra(normalizedTerm)
    ]);

    const payload = {
      term,
      normalizedTerm,
      generatedAt: new Date().toISOString(),
      markets: {
        prezunic,
        zonasul,
        extra
      }
    };

    const debugDir = path.join(process.cwd(), "data", "scrape-debug");
    await fs.mkdir(debugDir, { recursive: true });

    const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeName(term)}.json`;
    const filePath = path.join(debugDir, filename);
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");

    return NextResponse.json({
      ...payload,
      savedTo: filePath
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao gerar auditoria de scrape",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}
