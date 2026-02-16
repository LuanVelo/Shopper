import { promises as fs } from "node:fs";
import path from "node:path";
import { MarketName, MarketSnapshotFile, NormalizedMarketOffer } from "@/lib/market/schema";

const ROOT_DIR = path.join(process.cwd(), "data", "market");
const SNAPSHOT_DIR = path.join(ROOT_DIR, "snapshots");
const INDEX_DIR = path.join(ROOT_DIR, "indexes");

function asSafeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeSnapshotId(market: MarketName, categoryId: number, capturedAt: string): string {
  const stamp = capturedAt.replace(/[:.]/g, "-");
  return `${market}-c${categoryId}-${stamp}`;
}

function snapshotPath(snapshotId: string): string {
  return path.join(SNAPSHOT_DIR, `${snapshotId}.json`);
}

function latestIndexPath(market: MarketName, categoryId: number): string {
  const key = `${asSafeSegment(market)}-c${categoryId}.json`;
  return path.join(INDEX_DIR, key);
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  await fs.mkdir(INDEX_DIR, { recursive: true });
}

export async function saveMarketSnapshot(
  payload: Omit<MarketSnapshotFile, "snapshotId" | "offersCount">
): Promise<MarketSnapshotFile> {
  await ensureDirs();

  const snapshotId = makeSnapshotId(payload.market, payload.categoryId, payload.capturedAt);
  const file: MarketSnapshotFile = {
    ...payload,
    snapshotId,
    offersCount: payload.offers.length
  };

  const fullPath = snapshotPath(snapshotId);
  await fs.writeFile(fullPath, JSON.stringify(file, null, 2), "utf-8");

  const indexPayload = {
    snapshotId,
    market: payload.market,
    categoryId: payload.categoryId,
    capturedAt: payload.capturedAt,
    offersCount: file.offersCount
  };
  await fs.writeFile(latestIndexPath(payload.market, payload.categoryId), JSON.stringify(indexPayload, null, 2), "utf-8");

  return file;
}

export async function loadMarketSnapshot(snapshotId: string): Promise<MarketSnapshotFile | null> {
  try {
    const file = await fs.readFile(snapshotPath(snapshotId), "utf-8");
    return JSON.parse(file) as MarketSnapshotFile;
  } catch {
    return null;
  }
}

export async function loadLatestMarketSnapshot(
  market: MarketName,
  categoryId: number
): Promise<MarketSnapshotFile | null> {
  try {
    const index = JSON.parse(await fs.readFile(latestIndexPath(market, categoryId), "utf-8")) as {
      snapshotId: string;
    };
    return loadMarketSnapshot(index.snapshotId);
  } catch {
    return null;
  }
}

export async function loadLatestOffers(
  market: MarketName,
  categoryId: number
): Promise<NormalizedMarketOffer[]> {
  const snapshot = await loadLatestMarketSnapshot(market, categoryId);
  return snapshot?.offers ?? [];
}

