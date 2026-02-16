import { NextResponse } from "next/server";
import { SOURCE_CATEGORIES } from "@/lib/categories";

export async function GET() {
  return NextResponse.json({ sources: SOURCE_CATEGORIES });
}
